-- Email preferences system
-- Handles user preferences for different types of emails

--[ Up migration ]--

-- Create function for updating timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create enum for email frequency
CREATE TYPE public.email_frequency AS ENUM (
    'immediate',  -- Send as soon as available (e.g., flash reports)
    'daily',     -- Daily digest
    'weekly',    -- Weekly digest
    'never'      -- Opted out
);

-- Create enum for email format
CREATE TYPE public.email_format AS ENUM (
    'html',      -- Rich HTML emails
    'text',      -- Plain text only
    'both'       -- Both HTML and text
);

-- Email categories table
CREATE TABLE IF NOT EXISTS public.email_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    default_frequency email_frequency NOT NULL DEFAULT 'immediate',
    default_format email_format NOT NULL DEFAULT 'both',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User email preferences table
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES public.email_categories(id) ON DELETE CASCADE,
    frequency email_frequency NOT NULL,
    format email_format NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, category_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_user ON public.user_email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_category ON public.user_email_preferences(category_id);
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_enabled ON public.user_email_preferences(enabled);
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_frequency ON public.user_email_preferences(frequency);

-- Add trigger for updating timestamps
DROP TRIGGER IF EXISTS update_email_categories_updated_at ON public.email_categories;
CREATE TRIGGER update_email_categories_updated_at
    BEFORE UPDATE ON public.email_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_email_preferences_updated_at ON public.user_email_preferences;
CREATE TRIGGER update_user_email_preferences_updated_at
    BEFORE UPDATE ON public.user_email_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.email_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Email categories are readable by all authenticated users
CREATE POLICY "Email categories are readable by authenticated users"
    ON public.email_categories FOR SELECT
    TO authenticated
    USING (true);

-- Users can only read their own preferences
CREATE POLICY "Users can read their own preferences"
    ON public.user_email_preferences FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
    ON public.user_email_preferences FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
    ON public.user_email_preferences FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to email categories"
    ON public.email_categories FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to user preferences"
    ON public.user_email_preferences FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Insert default email categories
INSERT INTO public.email_categories (id, name, description, default_frequency, default_format) 
VALUES 
    ('flash-report', 'Flash Reports', 'Immediate alerts for maritime incidents', 'immediate', 'both'),
    ('weekly-report', 'Weekly Reports', 'Weekly summary of maritime activity', 'weekly', 'both'),
    ('platform-updates', 'Platform Updates', 'Updates about new features and changes', 'immediate', 'html'),
    ('marketing', 'Marketing Communications', 'News and promotional content', 'never', 'html')
ON CONFLICT (id) DO NOTHING;

-- Function to initialize user preferences
CREATE OR REPLACE FUNCTION initialize_user_email_preferences(user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.user_email_preferences (user_id, category_id, frequency, format)
    SELECT 
        user_id,
        id as category_id,
        default_frequency as frequency,
        default_format as format
    FROM public.email_categories
    ON CONFLICT (user_id, category_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to initialize preferences for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    PERFORM initialize_user_email_preferences(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to check if user should receive email
CREATE OR REPLACE FUNCTION should_send_email(
    p_user_id UUID,
    p_category_id TEXT
)
RETURNS boolean AS $$
DECLARE
    v_preference RECORD;
BEGIN
    -- Get user's preference for this category
    SELECT * INTO v_preference
    FROM public.user_email_preferences
    WHERE user_id = p_user_id
    AND category_id = p_category_id;

    -- If no preference found, get category defaults
    IF NOT FOUND THEN
        SELECT 
            default_frequency as frequency,
            default_format as format,
            true as enabled
        INTO v_preference
        FROM public.email_categories
        WHERE id = p_category_id;
    END IF;

    -- Check if user should receive email
    RETURN v_preference.enabled 
        AND v_preference.frequency != 'never';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--[ Down migration ]--

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_email_preferences_updated_at ON public.user_email_preferences;
DROP TRIGGER IF EXISTS update_email_categories_updated_at ON public.email_categories;

-- Drop functions
DROP FUNCTION IF EXISTS should_send_email(UUID, TEXT);
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS initialize_user_email_preferences(UUID);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (this will also drop their policies)
DROP TABLE IF EXISTS public.user_email_preferences;
DROP TABLE IF EXISTS public.email_categories;

-- Drop enums
DROP TYPE IF EXISTS public.email_format;
DROP TYPE IF EXISTS public.email_frequency;

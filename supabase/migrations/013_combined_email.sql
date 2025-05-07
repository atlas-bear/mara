-- Combined email migrations (011 and 012)

-- Email preferences system
-- Handles user preferences for different types of emails

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

-- Email queue system
-- Handles email queuing, retries, and rate limiting

-- Create enum for email status
CREATE TYPE public.email_queue_status AS ENUM (
    'queued',        -- Initial state
    'processing',    -- Being processed
    'sent',          -- Successfully sent
    'failed',        -- Failed after all retries
    'cancelled'      -- Manually cancelled
);

-- Create enum for priority
CREATE TYPE public.email_priority AS ENUM (
    'high',      -- Flash reports, security alerts
    'normal',    -- Regular updates, weekly reports
    'low'        -- Marketing, non-urgent communications
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.email_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_limit_key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    current_count INT NOT NULL DEFAULT 0,
    max_count INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(rate_limit_key, window_start)
);

-- Add index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_window 
    ON public.email_rate_limits(rate_limit_key, window_start, window_end);

-- Email queue table
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT REFERENCES public.email_templates(id),
    recipient_email TEXT NOT NULL,
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    category_id TEXT REFERENCES public.email_categories(id),
    subject TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    html TEXT,
    text TEXT,
    priority public.email_priority NOT NULL DEFAULT 'normal',
    status public.email_queue_status NOT NULL DEFAULT 'queued',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    rate_limit_key TEXT,
    rate_limit_window INTERVAL,
    rate_limit_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry ON public.email_queue(next_retry_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON public.email_queue(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient ON public.email_queue(recipient_email, recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_rate_limit ON public.email_queue(rate_limit_key, created_at) 
    WHERE status IN ('queued', 'sent');

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_email_rate_limit(
    p_rate_limit_key TEXT,
    p_window INTERVAL,
    p_max_count INT
) RETURNS boolean AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_window_end TIMESTAMPTZ;
    v_current_count INT;
BEGIN
    -- Calculate window
    v_window_start := date_trunc('second', now() - p_window);
    v_window_end := date_trunc('second', now());

    -- Get or create rate limit record
    INSERT INTO public.email_rate_limits (
        rate_limit_key,
        window_start,
        window_end,
        max_count,
        current_count
    )
    VALUES (
        p_rate_limit_key,
        v_window_start,
        v_window_end,
        p_max_count,
        1
    )
    ON CONFLICT (rate_limit_key, window_start) DO UPDATE
    SET current_count = email_rate_limits.current_count + 1
    RETURNING current_count INTO v_current_count;

    -- Clean up old records
    DELETE FROM public.email_rate_limits
    WHERE window_end < now() - INTERVAL '1 day';

    -- Return true if under limit
    RETURN v_current_count <= p_max_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get next email to process
CREATE OR REPLACE FUNCTION get_next_email_to_process()
RETURNS public.email_queue AS $$
DECLARE
    v_email public.email_queue;
BEGIN
    -- Get and lock next email to process
    SELECT * INTO v_email
    FROM public.email_queue
    WHERE status = 'queued'
    AND scheduled_for <= now()
    AND (next_retry_at IS NULL OR next_retry_at <= now())
    AND (
        rate_limit_key IS NULL 
        OR check_email_rate_limit(
            rate_limit_key,
            rate_limit_window,
            rate_limit_count
        )
    )
    ORDER BY 
        CASE priority
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 3
        END,
        scheduled_for,
        created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- Update status if email found
    IF FOUND THEN
        UPDATE public.email_queue
        SET 
            status = 'processing',
            updated_at = now()
        WHERE id = v_email.id;
    END IF;

    RETURN v_email;
END;
$$ LANGUAGE plpgsql;

-- Function to handle email failure
CREATE OR REPLACE FUNCTION handle_email_failure(
    p_email_id UUID,
    p_error TEXT
) RETURNS void AS $$
DECLARE
    v_email public.email_queue;
BEGIN
    -- Get email record
    SELECT * INTO v_email
    FROM public.email_queue
    WHERE id = p_email_id
    FOR UPDATE;

    -- Update based on retry count
    IF v_email.retry_count >= v_email.max_retries THEN
        UPDATE public.email_queue
        SET 
            status = 'failed',
            error = p_error,
            updated_at = now()
        WHERE id = p_email_id;
    ELSE
        UPDATE public.email_queue
        SET 
            status = 'queued',
            error = p_error,
            retry_count = retry_count + 1,
            next_retry_at = now() + (power(2, retry_count) * interval '1 minute'),
            updated_at = now()
        WHERE id = p_email_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own queued emails"
    ON public.email_queue FOR SELECT
    TO authenticated
    USING (recipient_user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role has full access to email queue"
    ON public.email_queue FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to rate limits"
    ON public.email_rate_limits FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Down migration
DROP FUNCTION IF EXISTS handle_email_failure(UUID, TEXT);
DROP FUNCTION IF EXISTS get_next_email_to_process();
DROP FUNCTION IF EXISTS check_email_rate_limit(TEXT, INTERVAL, INT);
DROP TABLE IF EXISTS public.email_rate_limits;
DROP TABLE IF EXISTS public.email_queue;
DROP TYPE IF EXISTS public.email_priority;
DROP TYPE IF EXISTS public.email_queue_status;

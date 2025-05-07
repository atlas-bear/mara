-- Email queue system
-- Handles email queuing, retries, and rate limiting

--[ Up migration ]--

-- Verify email_categories table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_categories'
    ) THEN
        RAISE EXCEPTION 'email_categories table must exist before creating email queue';
    END IF;
END $$;

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

--[ Down migration ]--

-- Drop functions
DROP FUNCTION IF EXISTS handle_email_failure(UUID, TEXT);
DROP FUNCTION IF EXISTS get_next_email_to_process();
DROP FUNCTION IF EXISTS check_email_rate_limit(TEXT, INTERVAL, INT);

-- Drop tables (this will also drop their policies)
DROP TABLE IF EXISTS public.email_rate_limits;
DROP TABLE IF EXISTS public.email_queue;

-- Drop enums
DROP TYPE IF EXISTS public.email_priority;
DROP TYPE IF EXISTS public.email_queue_status;

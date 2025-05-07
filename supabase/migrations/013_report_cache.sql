-- Report caching system
-- Handles caching for computationally expensive operations like weekly reports

-- Create enum for cache types
CREATE TYPE public.cache_type AS ENUM (
    'weekly_report',
    'monthly_stats',
    'trend_data',
    'regional_stats'
);

-- Cache metadata table
CREATE TABLE IF NOT EXISTS public.cache_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_type cache_type NOT NULL,
    cache_key TEXT NOT NULL,
    parameters JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    version TEXT,
    metadata JSONB DEFAULT '{}',
    UNIQUE(cache_type, cache_key)
);

-- Cache data table (separate from metadata for better performance)
CREATE TABLE IF NOT EXISTS public.cache_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metadata_id UUID NOT NULL REFERENCES public.cache_metadata(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    compressed_data BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cache_metadata_type_key ON public.cache_metadata(cache_type, cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires ON public.cache_metadata(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_data_metadata ON public.cache_data(metadata_id);

-- Add trigger for updating timestamps
DROP TRIGGER IF EXISTS update_cache_metadata_updated_at ON public.cache_metadata;
CREATE TRIGGER update_cache_metadata_updated_at
    BEFORE UPDATE ON public.cache_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Cache metadata is readable by authenticated users"
    ON public.cache_metadata FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Cache data is readable by authenticated users"
    ON public.cache_data FOR SELECT
    TO authenticated
    USING (true);

-- Service role has full access
CREATE POLICY "Service role has full access to cache metadata"
    ON public.cache_metadata FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to cache data"
    ON public.cache_data FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to get cached data with automatic expiry check
CREATE OR REPLACE FUNCTION get_cached_data(
    p_cache_type cache_type,
    p_cache_key TEXT
) RETURNS JSONB AS $$
DECLARE
    v_data JSONB;
BEGIN
    -- Get data if not expired
    SELECT d.data INTO v_data
    FROM public.cache_metadata m
    JOIN public.cache_data d ON d.metadata_id = m.id
    WHERE m.cache_type = p_cache_type
    AND m.cache_key = p_cache_key
    AND m.expires_at > now();

    -- Clean up expired cache entries in the background
    -- This won't block the current transaction
    PERFORM pg_notify(
        'cache_cleanup',
        json_build_object(
            'cache_type', p_cache_type,
            'older_than', now()
        )::text
    );

    RETURN v_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to store cached data
CREATE OR REPLACE FUNCTION store_cached_data(
    p_cache_type cache_type,
    p_cache_key TEXT,
    p_data JSONB,
    p_parameters JSONB,
    p_ttl INTERVAL,
    p_version TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_metadata_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Calculate expiry
    v_expires_at := now() + p_ttl;

    -- Insert or update metadata
    INSERT INTO public.cache_metadata (
        cache_type,
        cache_key,
        parameters,
        expires_at,
        version,
        metadata
    )
    VALUES (
        p_cache_type,
        p_cache_key,
        p_parameters,
        v_expires_at,
        p_version,
        p_metadata
    )
    ON CONFLICT (cache_type, cache_key) DO UPDATE
    SET
        parameters = EXCLUDED.parameters,
        expires_at = EXCLUDED.expires_at,
        version = EXCLUDED.version,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    RETURNING id INTO v_metadata_id;

    -- Store the actual data
    INSERT INTO public.cache_data (
        metadata_id,
        data
    )
    VALUES (
        v_metadata_id,
        p_data
    )
    ON CONFLICT (metadata_id) DO UPDATE
    SET data = EXCLUDED.data;

    RETURN v_metadata_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invalidate cache entries
CREATE OR REPLACE FUNCTION invalidate_cache(
    p_cache_type cache_type,
    p_cache_key TEXT DEFAULT NULL
) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    IF p_cache_key IS NULL THEN
        -- Invalidate all entries of the specified type
        DELETE FROM public.cache_metadata
        WHERE cache_type = p_cache_type;
    ELSE
        -- Invalidate specific cache entry
        DELETE FROM public.cache_metadata
        WHERE cache_type = p_cache_type
        AND cache_key = p_cache_key;
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache(
    p_older_than TIMESTAMPTZ DEFAULT now()
) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM public.cache_metadata
    WHERE expires_at < p_older_than;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

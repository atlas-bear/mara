-- Migration to clean up unused processing status enum
-- The snake_case version (processing_status) is the one being used in production

DO $$
DECLARE
    v_column_count int;
    v_function_count int;
BEGIN
    -- Check if any columns use the enum
    SELECT COUNT(*)
    INTO v_column_count
    FROM information_schema.columns
    WHERE udt_schema = 'cser'
    AND udt_name = 'processing_status_enum';

    -- Check if any functions reference the enum
    SELECT COUNT(*)
    INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname IN ('public', 'cser')
    AND pg_get_functiondef(p.oid)::text ~* 'processing_status_enum';

    -- Only proceed if no dependencies found
    IF v_column_count = 0 AND v_function_count = 0 THEN
        -- Drop the unused enum
        DROP TYPE IF EXISTS cser.processing_status_enum;
        
        RAISE NOTICE 'Successfully dropped unused processing_status_enum';
    ELSE
        RAISE EXCEPTION 'Cannot drop enum: still in use by % columns and % functions', 
            v_column_count, v_function_count;
    END IF;
END $$;

-- Down migration
-- We don't recreate the enum in down migration since it's unused
-- and the proper enum (processing_status) is already in place

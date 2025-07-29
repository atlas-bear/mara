-- Migration to clean up unused processing status enum
-- The snake_case version (processing_status) is the one being used in production

-- Check if the enum is actually unused and drop it
DO $$
BEGIN
    -- Try to drop the enum - if it fails, it means it's still in use
    BEGIN
        DROP TYPE IF EXISTS cser.processing_status_enum;
        RAISE NOTICE 'Successfully dropped unused processing_status_enum';
    EXCEPTION
        WHEN dependent_objects_still_exist THEN
            RAISE NOTICE 'processing_status_enum is still in use, skipping cleanup';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop processing_status_enum: %', SQLERRM;
    END;
END $$;

-- Down migration
-- We don't recreate the enum in down migration since it's unused
-- and the proper enum (processing_status) is already in place

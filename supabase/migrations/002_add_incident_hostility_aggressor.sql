-- Migration Script to add legacy fields to cser.incident
-- Version: 1.2
-- Date: 2025-04-10

BEGIN;

ALTER TABLE cser.incident
ADD COLUMN hostility text NULL,
ADD COLUMN aggressor_legacy_info text NULL;

COMMENT ON COLUMN cser.incident.hostility IS 'Legacy hostility information migrated from old data source.';
COMMENT ON COLUMN cser.incident.aggressor_legacy_info IS 'Legacy aggressor name/info migrated from old data source (linked record).';

COMMIT;

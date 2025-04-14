-- Add temporary column to store Airtable Record ID during migration
ALTER TABLE cser.incident
ADD COLUMN airtable_record_id TEXT NULL;

-- Add temporary column to store Airtable Record ID during migration
ALTER TABLE cser.raw_data
ADD COLUMN airtable_record_id TEXT NULL;

-- Migration to update processing_status enum values to snake_case

-- Drop existing enum if it exists
do $$ 
begin
    if exists (select 1 from pg_type where typname = 'processing_status') then
        alter table cser.raw_data alter column processing_status drop default;
        drop type cser.processing_status;
    end if;
end $$;

-- Create the enum type with snake_case values
create type cser.processing_status as enum (
    'new',
    'deduplicating',
    'ready',
    'processing',
    'complete',
    'error'
);

-- Set default value for the column
alter table cser.raw_data 
    alter column processing_status type cser.processing_status 
    using 'new'::cser.processing_status,
    alter column processing_status set default 'new'::cser.processing_status;

-- Add comment explaining the enum values
comment on type cser.processing_status is 
    'Status of raw data processing: new -> deduplicating -> ready -> processing -> complete (or error)';

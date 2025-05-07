-- Migration to fix processing status values

-- First check all enum values in cser schema
do $$
declare
    r record;
begin
    for r in (
        select n.nspname as schema,
               t.typname as enum_name,
               e.enumlabel as enum_value
        from pg_type t
        join pg_enum e on t.oid = e.enumtypid
        join pg_catalog.pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'cser'
        order by enum_name, e.enumsortorder
    ) loop
        raise notice '% % %', r.schema, r.enum_name, r.enum_value;
    end loop;

    -- Update records that should be complete and get count
    with updated as (
        update cser.raw_data
        set processing_status = 'complete'::cser.processing_status
        where merge_status = 'merged'
           or merge_status = 'merged_into'
        returning id
    )
    select count(*) into r from updated;

    raise notice 'Updated % records to complete status', r;
end $$;

-- Add comment explaining the fix
comment on table cser.raw_data is 
    'Raw data records from various sources. Processing status was fixed to restore complete/merged states.';

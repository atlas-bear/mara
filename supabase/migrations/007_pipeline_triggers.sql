-- Pipeline triggers migration
-- Combines trigger setup and rollback into a single file

--[ Up migration ]--

-- Check for existing triggers before proceeding
do $$
declare
    raw_data_trigger_exists boolean;
    incident_trigger_exists boolean;
    trigger_info text;
begin
    -- Check for existing raw data triggers
    select exists (
        select 1 from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        join pg_namespace n on c.relnamespace = n.oid
        where n.nspname = 'cser'
        and c.relname = 'raw_data'
        and t.tgname in ('tg_raw_data_process', 'tg_raw_data_deduplicate')
    ) into raw_data_trigger_exists;

    -- Check for existing incident trigger
    select exists (
        select 1 from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        join pg_namespace n on c.relnamespace = n.oid
        where n.nspname = 'cser'
        and c.relname = 'incident'
        and t.tgname = 'tg_incident_flash_report'
    ) into incident_trigger_exists;

    -- Build info message about existing triggers
    trigger_info := case
        when raw_data_trigger_exists and incident_trigger_exists then
            'Both raw_data and incident triggers already exist'
        when raw_data_trigger_exists then
            'Raw data triggers already exist'
        when incident_trigger_exists then
            'Incident trigger already exists'
        else
            'No existing pipeline triggers found'
    end;

    raise notice 'Trigger check: %', trigger_info;
end $$;

-- Enable pg_net extension for making HTTP calls from triggers
create extension if not exists pg_net with schema extensions;

-- Create a function to invoke edge functions via HTTP
create or replace function cser.invoke_edge_function(
    function_name text,
    payload jsonb
) returns void
language plpgsql
security definer
as $$
declare
  edge_function_base_url text;
  service_role_key text;
begin
  -- Get edge function base URL from environment variable
  edge_function_base_url := current_setting('SUPABASE_URL') || '/functions';

  -- Get service role key from environment variable
  service_role_key := current_setting('SUPABASE_SERVICE_KEY');

  -- Validate URL format
  if edge_function_base_url is null or edge_function_base_url !~ '^https?://.+' then
    raise exception 'Invalid edge function base URL: %', coalesce(edge_function_base_url, 'not set');
  end if;

  -- Validate service role key format (basic check)
  if service_role_key is null or length(service_role_key) < 32 then
    raise exception 'Invalid service role key format';
  end if;

  -- Validate function name
  if function_name !~ '^[a-z0-9-]+$' then
    raise exception 'Invalid function name format: %', function_name;
  end if;

  -- Make HTTP call to edge function with retries
  declare
    max_retries constant int := 3;
    retry_count int := 0;
    success boolean := false;
  begin
    while retry_count < max_retries and not success loop
      begin
        perform net.http_post(
          url := edge_function_base_url || '/' || function_name,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
          ),
          body := payload
        );
        success := true;
      exception
        when others then
          retry_count := retry_count + 1;
          if retry_count = max_retries then
            raise warning 'Failed to invoke edge function % after % attempts: %', 
              function_name, max_retries, sqlerrm;
          else
            -- Wait briefly before retry (exponential backoff)
            perform pg_sleep(power(2, retry_count)::int);
          end if;
      end;
    end loop;
  end;
end;
$$;

-- Trigger function for deduplication
create or replace function cser.tg_raw_data_deduplicate()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only deduplicate if status is 'new'
  if new.processing_status = 'new' then
    -- Update status to deduplicating
    update cser.raw_data 
    set processing_status = 'deduplicating',
        last_processed = current_timestamp,
        processing_notes = 'Started deduplication'
    where id = new.id;

    -- Invoke deduplicate-cross-source edge function
    perform cser.invoke_edge_function(
      'deduplicate-cross-source',
      jsonb_build_object('id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Trigger function for processing raw data
create or replace function cser.tg_raw_data_process()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Process if status is 'ready' (after deduplication)
  if new.processing_status = 'ready' then
    -- Update status to processing
    update cser.raw_data 
    set processing_status = 'processing',
        last_processed = current_timestamp,
        processing_notes = coalesce(
          case 
            when merge_status = 'merged_into' then 'Processing merged record to update incident'
            else 'Processing new record'
          end,
          'Processing record'
        )
    where id = new.id;

    -- Invoke process-raw-data edge function
    perform cser.invoke_edge_function(
      'process-raw-data',
      jsonb_build_object(
        'id', new.id,
        'is_merged', new.merge_status = 'merged_into'
      )
    );
  end if;
  return new;
end;
$$;

-- Trigger function for incident updates
create or replace function cser.tg_incident_flash_report()
returns trigger
language plpgsql
security definer
as $$
declare
  incident_date timestamp;
  days_threshold integer := 9; -- Configure flash report window
begin
  -- Get the incident date
  incident_date := new.date_time_utc;
  
  -- Check if incident is within flash report window
  if incident_date >= (current_timestamp - (days_threshold || ' days')::interval) then
    -- Invoke flash-report edge function
    perform cser.invoke_edge_function(
      'send-flash-report',
      jsonb_build_object(
        'incident_id', new.id,
        'is_update', TG_OP = 'UPDATE'
      )
    );
  end if;
  return new;
end;
$$;

-- Create triggers for raw data pipeline
drop trigger if exists tg_raw_data_deduplicate on cser.raw_data;
create trigger tg_raw_data_deduplicate
  after insert
  on cser.raw_data
  for each row
  execute function cser.tg_raw_data_deduplicate();

drop trigger if exists tg_raw_data_process on cser.raw_data;
create trigger tg_raw_data_process
  after update of processing_status
  on cser.raw_data
  for each row
  when (new.processing_status = 'ready')
  execute function cser.tg_raw_data_process();

-- Create trigger for flash reports
drop trigger if exists tg_incident_flash_report on cser.incident;
create trigger tg_incident_flash_report
  after insert or update
  on cser.incident
  for each row
  execute function cser.tg_incident_flash_report();

-- Add comments explaining the triggers
comment on function cser.tg_raw_data_deduplicate() is 
  'Trigger function to run deduplication on new raw data records';
comment on function cser.tg_raw_data_process() is 
  'Trigger function to process raw data records after deduplication';
comment on function cser.tg_incident_flash_report() is 
  'Trigger function to check if a flash report should be sent for new or updated incidents within the configured time window';

--[ Down migration ]--

-- Reset any in-progress raw data records
update cser.raw_data
set processing_status = 'new',
    processing_notes = 'Reset by rollback',
    last_processed = null
where processing_status in ('deduplicating', 'processing');

-- Drop triggers first
drop trigger if exists tg_raw_data_deduplicate on cser.raw_data;
drop trigger if exists tg_raw_data_process on cser.raw_data;
drop trigger if exists tg_incident_flash_report on cser.incident;

-- Drop trigger functions
drop function if exists cser.tg_raw_data_deduplicate();
drop function if exists cser.tg_raw_data_process();
drop function if exists cser.tg_incident_flash_report();
drop function if exists cser.invoke_edge_function(text, jsonb);

-- Note: We don't drop the pg_net extension as it might be used by other functions

-- Log rollback completion
do $$
begin
    raise notice 'Pipeline triggers and functions rolled back successfully';
end $$;

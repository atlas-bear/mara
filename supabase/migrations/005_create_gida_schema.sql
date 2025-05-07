-- Migration script to create the gida schema and initial reference tables

-- Enable required extensions
create extension if not exists moddatetime with schema extensions;

-- 1. Create the gida schema
create schema if not exists gida;

-- Grant usage to necessary roles
grant usage on schema gida to postgres, anon, authenticated, service_role;
-- Grant select permission for reading reference data
grant select on all tables in schema gida to anon, authenticated, service_role;

-- Alter default privileges for future tables in gida schema
alter default privileges in schema gida grant select on tables to anon, authenticated, service_role;

-- 2. Create gida.maritime_region table
create table gida.maritime_region (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    -- navarea_id uuid references gida.navarea(id), -- Link to navarea table (create navarea table first if needed)
    subregion text, -- Name of the subregion
    threat_level text, -- Subjective threat level assessment
    lat_min numeric,
    lat_max numeric,
    lng_min numeric,
    lng_max numeric,
    -- Add geometry column if PostGIS is needed later for spatial queries
    -- geom geometry(Polygon, 4326),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    airtable_record_id text -- Optional: To store original Airtable ID during migration
);

-- Add comments to clarify columns
comment on column gida.maritime_region.name is 'Name of the maritime region.';
comment on column gida.maritime_region.subregion is 'Name of the subregion within the main region.';
comment on column gida.maritime_region.threat_level is 'Subjective threat level assessment.';
comment on column gida.maritime_region.lat_min is 'Minimum latitude for the bounding box.';
comment on column gida.maritime_region.lat_max is 'Maximum latitude for the bounding box.';
comment on column gida.maritime_region.lng_min is 'Minimum longitude for the bounding box.';
comment on column gida.maritime_region.lng_max is 'Maximum longitude for the bounding box.';

-- 3. Create gida.vessel_type table
create table gida.vessel_type (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    prefix text,
    description text, -- Use text for potentially long descriptions
    typical_size text,
    primary_use text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    airtable_record_id text -- Optional: To store original Airtable ID during migration
);

-- Add comments
comment on column gida.vessel_type.name is 'Name of the vessel type (e.g., Tanker, Bulk Carrier).';
comment on column gida.vessel_type.prefix is 'Common prefix used for the vessel type (e.g., MT, MV).';
comment on column gida.vessel_type.description is 'Description of the vessel type.';
comment on column gida.vessel_type.typical_size is 'Typical size range or classification.';
comment on column gida.vessel_type.primary_use is 'Primary purpose or use of the vessel type.';

-- Drop existing triggers if they exist
drop trigger if exists handle_updated_at on gida.maritime_region;
drop trigger if exists handle_updated_at on gida.vessel_type;

-- Create triggers to update 'updated_at' timestamp
create trigger handle_updated_at before update on gida.maritime_region
  for each row execute procedure extensions.moddatetime(updated_at);

create trigger handle_updated_at before update on gida.vessel_type
  for each row execute procedure extensions.moddatetime(updated_at);

-- Grant permissions again for the new tables specifically
grant select on table gida.maritime_region to anon, authenticated, service_role;
grant select on table gida.vessel_type to anon, authenticated, service_role;

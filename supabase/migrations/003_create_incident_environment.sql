-- Migration Script to create incident_environment table
-- Version: 1.3
-- Date: 2025-04-10

BEGIN;

-- Stores legacy environmental data associated with an incident
CREATE TABLE cser.incident_environment (
    incident_id uuid PRIMARY KEY,                 -- Primary Key and Foreign Key to cser.incident
    sea_state text NULL,                          -- e.g., "1 - Calm (Rippled)"
    visibility text NULL,                         -- e.g., "24.14km"
    moon_details text NULL,                       -- e.g., "67.38%<br>Waxing gibbous<br>Rise: 06:22<br>Set: 18:51"
    moon_fraction numeric NULL,                   -- e.g., 0.67375142
    sun_details text NULL,                        -- e.g., "Rise: 05:40<br>Set: 17:52"
    wave_details text NULL,                       -- e.g., "191.13°<br>1.21m<br>5.01s"
    wind_details text NULL,                       -- e.g., "215.7°<br>5.08m/s"
    created_at timestamptz DEFAULT now() NOT NULL, -- Timestamp for record creation/migration

    -- Foreign Key constraint defined via PRIMARY KEY reference
    CONSTRAINT fk_incident FOREIGN KEY(incident_id) REFERENCES cser.incident(id) ON DELETE CASCADE
);

COMMENT ON TABLE cser.incident_environment IS 'Stores legacy environmental data associated with an incident (CSER pillar). Linked 1-to-1 with cser.incident.';
COMMENT ON COLUMN cser.incident_environment.incident_id IS 'Links to the specific incident.';
COMMENT ON COLUMN cser.incident_environment.created_at IS 'Timestamp when the environmental data record was created (likely during migration).';

COMMIT;

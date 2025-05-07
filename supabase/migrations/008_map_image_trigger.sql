-- Migration to remove map_image jsonb field and add map generation trigger

-- Remove the map_image jsonb column since we're only using map_image_url now
ALTER TABLE cser.incident 
    DROP COLUMN map_image;

-- Add pg_net extension if not exists (required for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to get edge function URL for map generation
CREATE OR REPLACE FUNCTION cser.get_edge_function_url()
RETURNS text AS $$
BEGIN
    RETURN current_setting('SUPABASE_URL') || '/functions/v1';
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to handle map generation
CREATE OR REPLACE FUNCTION cser.handle_map_generation()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if we have coordinates but no map image
    IF (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.map_image_url IS NULL) THEN
        -- Invoke edge function via pg_net (requires pg_net extension)
        PERFORM net.http_post(
            url := cser.get_edge_function_url() || '/generate-map',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('SUPABASE_SERVICE_ROLE_KEY')
            ),
            body := jsonb_build_object(
                'incident_id', NEW.id,
                'latitude', NEW.latitude,
                'longitude', NEW.longitude,
                'reference_id', NEW.reference_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after insert or update on incident table
CREATE TRIGGER trigger_map_generation
    AFTER INSERT OR UPDATE OF latitude, longitude, map_image_url
    ON cser.incident
    FOR EACH ROW
    EXECUTE FUNCTION cser.handle_map_generation();

-- Add comment explaining the trigger
COMMENT ON FUNCTION cser.handle_map_generation() IS 
    'Triggers map generation via Edge Function when an incident has coordinates but no map image URL';

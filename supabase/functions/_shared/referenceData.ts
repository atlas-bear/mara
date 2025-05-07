/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { supabaseAdmin } from './supabaseClient.ts';
import { log } from './logger.ts';

// Define interfaces for the expected structure of reference data
interface VesselType {
    id: string;
    name: string; // Expect lowercase name for matching
    // Add other fields if needed from the vessel_type table
}

interface MaritimeRegion {
    id: string;
    name: string;
    // How bounds are stored needs confirmation (min/max fields or geometry?)
    bounds?: {
        lat_min?: number;
        lat_max?: number;
        lng_min?: number;
        lng_max?: number;
    };
    geometry?: unknown; // Placeholder for potential PostGIS geometry
}

interface IncidentType {
    id: string;
    name: string;
    // Add other fields if needed
}

interface AllReferenceData {
    vesselTypes: VesselType[];
    maritimeRegions: MaritimeRegion[];
    incidentTypes: IncidentType[];
}

// Cache for reference data within a single function invocation (simple in-memory)
let memoryCache: AllReferenceData | null = null;
let cacheTimestamp: number | null = null;
const MEMORY_CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes within function lifetime

class ReferenceDataManager {

  // Fetches vessel types from Supabase gida schema
  async getVesselTypes(): Promise<VesselType[]> {
    log.info('Fetching Vessel Types from Supabase gida schema...');
    const tableName = 'vessel_type';
    const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('id, name') // Select necessary fields
        .schema('gida'); // Specify the gida schema

    if (error) {
      log.error(`Error fetching ${tableName} from gida`, { error });
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
    }
    // Transform data (e.g., ensure name is lowercase)
    // Add type annotation for item based on the select query
    return (data || []).map((item: { id: string; name: string | null }) => ({
        id: item.id,
        name: item.name?.toLowerCase() || '', // Ensure lowercase for matching
    }));
  }

  // Fetches maritime regions from Supabase gida schema
  async getMaritimeRegions(): Promise<MaritimeRegion[]> {
    log.info('Fetching Maritime Regions from Supabase gida schema...');
    const tableName = 'maritime_region';
    // Select fields including bounds or geometry representation
    const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('id, name, lat_min, lat_max, lng_min, lng_max, geometry') // Example selection
        .schema('gida'); // Specify the gida schema

    if (error) {
      log.error(`Error fetching ${tableName} from gida`, { error });
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
    }
     // Transform data to match the MaritimeRegion interface
     // Add type annotation for item based on the select query
     return (data || []).map((item: { id: string; name: string; lat_min?: number; lat_max?: number; lng_min?: number; lng_max?: number; geometry?: unknown }) => ({
        id: item.id,
        name: item.name,
        bounds: (item.lat_min !== undefined && item.lat_max !== undefined && item.lng_min !== undefined && item.lng_max !== undefined) ? { // Check if all bounds exist
            lat_min: item.lat_min,
            lat_max: item.lat_max,
            lng_min: item.lng_min,
            lng_max: item.lng_max,
        } : undefined,
        geometry: item.geometry, // Include geometry if it exists
    }));
  }

  // Fetches incident types from Supabase cser schema
  async getIncidentTypes(): Promise<IncidentType[]> {
    log.info('Fetching Incident Types from Supabase cser schema...');
    const tableName = 'incident_type';
    const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('id, name')
        .schema('cser'); // Specify the cser schema

    if (error) {
      log.error(`Error fetching ${tableName} from cser schema`, { error });
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
    }
     // Transform data (e.g., ensure name is lowercase for matching if needed)
     // Add type annotation for item based on the select query
     return (data || []).map((item: { id: string; name: string | null }) => ({
        id: item.id,
        name: item.name?.toLowerCase() || '', // Lowercase for consistent matching? Adjust if needed
    }));
  }

  // Fetches all reference data, using in-memory cache for the duration of an invocation
  async getAllReferenceData(): Promise<AllReferenceData> {
    const now = Date.now();
    if (memoryCache && cacheTimestamp && (now - cacheTimestamp < MEMORY_CACHE_DURATION_MS)) {
        log.info('Returning reference data from memory cache.');
        return memoryCache;
    }

    log.info('Fetching all reference data from Supabase...');
    try {
      // Fetch all data concurrently
      const [vesselTypes, maritimeRegions, incidentTypes] = await Promise.all([
        this.getVesselTypes(),
        this.getMaritimeRegions(),
        this.getIncidentTypes(),
      ]);

      memoryCache = {
        vesselTypes,
        maritimeRegions,
        incidentTypes,
      };
      cacheTimestamp = now; // Update timestamp

      log.info('Successfully fetched and cached reference data in memory.');
      return memoryCache;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Error fetching all reference data', { error: error.message });
      // Clear cache on error to force refetch next time
      memoryCache = null;
      cacheTimestamp = null;
      throw error; // Re-throw error
    }
  }

  // Helper method to find region by coordinates (adapted from original)
  // This needs refinement based on how region boundaries are stored (bounds vs geometry)
  async findRegionByCoordinates(lat: number, lng: number): Promise<MaritimeRegion | null> {
    const { maritimeRegions } = await this.getAllReferenceData(); // Use cached data

    // Prioritize geometry check if available (requires PostGIS setup)
    // TODO: Implement PostGIS check if 'geometry' field is used
    // Example (conceptual):
    // const { data: region } = await supabaseAdmin.rpc('find_region_for_point', { lon: lng, lat: lat });
    // if (region) return region;

    // Fallback to simple bounding box check if bounds exist
    for (const region of maritimeRegions) {
      if (region.bounds) {
        const bounds = region.bounds;
        // Ensure all bounds properties are numbers before comparing
        const latMin = typeof bounds.lat_min === 'number' ? bounds.lat_min : -Infinity;
        const latMax = typeof bounds.lat_max === 'number' ? bounds.lat_max : Infinity;
        const lngMin = typeof bounds.lng_min === 'number' ? bounds.lng_min : -Infinity;
        const lngMax = typeof bounds.lng_max === 'number' ? bounds.lng_max : Infinity;

        const latOk = lat >= latMin && lat <= latMax;
        const lngOk = lng >= lngMin && lng <= lngMax;

        if (latOk && lngOk) {
          log.info(`Coordinate matched region by bounds: ${region.name}`, { lat, lng });
          return region;
        }
      }
    }

    log.info('Coordinate did not match any region bounds.', { lat, lng });
    return null; // No region found
  }

  // --- Specific List Fetchers for Prompts ---

  async getWeaponNames(): Promise<string[]> {
    log.info('Fetching Weapon Names from Supabase cser schema...');
    const { data, error } = await supabaseAdmin.from('weapon').select('name').schema('cser');
    if (error) {
      log.error(`Error fetching weapon names`, { error });
      return []; // Return empty on error
    }
    return (data || []).map((item: { name: string | null }) => item.name || '').filter(Boolean);
  }

  async getItemStolenNames(): Promise<string[]> {
    log.info('Fetching Item Stolen Names from Supabase cser schema...');
    const { data, error } = await supabaseAdmin.from('item_stolen').select('name').schema('cser');
     if (error) {
      log.error(`Error fetching item stolen names`, { error });
      return [];
    }
    return (data || []).map((item: { name: string | null }) => item.name || '').filter(Boolean);
  }

  async getResponseTypeNames(): Promise<string[]> {
     log.info('Fetching Response Type Names from Supabase cser schema...');
     const { data, error } = await supabaseAdmin.from('response_type').select('name').schema('cser');
     if (error) {
      log.error(`Error fetching response type names`, { error });
      return [];
    }
    return (data || []).map((item: { name: string | null }) => item.name || '').filter(Boolean);
  }

   async getAuthorityNames(): Promise<string[]> {
     log.info('Fetching Authority Names from Supabase cser schema...');
     const { data, error } = await supabaseAdmin.from('authority').select('name').schema('cser');
     if (error) {
      log.error(`Error fetching authority names`, { error });
      return [];
    }
    return (data || []).map((item: { name: string | null }) => item.name || '').filter(Boolean);
  }

}

// Export a singleton instance
export const referenceData = new ReferenceDataManager();

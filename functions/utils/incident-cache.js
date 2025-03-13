import { cacheOps } from './cache.js';
import { getIncident } from './incident-utils.js';

// Constants
const CACHE_TTL_HOURS = 24; // Default cache time-to-live in hours
const CACHE_PREFIX = 'incident:';

/**
 * Gets an incident from cache or fetches it from Airtable if not in cache
 * @param {string} incidentId - The ID of the incident to get
 * @param {Object} options - Optional configuration
 * @param {boolean} options.forceRefresh - If true, bypasses cache and forces a fresh fetch
 * @param {number} options.ttlHours - Override the default TTL for this specific request
 * @param {boolean} options.returnRaw - If true, returns the raw data without enrichment
 * @returns {Object} The incident data with consistent format
 */
export async function getCachedIncident(incidentId, options = {}) {
  if (!incidentId) {
    throw new Error('Incident ID is required');
  }
  
  console.log(`getCachedIncident called with incidentId: ${incidentId}, type: ${typeof incidentId}`);
  
  // Validate incidentId format
  if (typeof incidentId !== 'string') {
    console.error(`Invalid incidentId type: ${typeof incidentId}, converting to string`);
    incidentId = String(incidentId);
  }

  const {
    forceRefresh = false,
    ttlHours = CACHE_TTL_HOURS,
    returnRaw = false
  } = options;

  const cacheKey = `${CACHE_PREFIX}${incidentId}`;
  console.log(`Getting incident ${incidentId} (forceRefresh: ${forceRefresh})`);

  // Try to get from cache first (unless forceRefresh is true)
  if (!forceRefresh) {
    const cacheData = await cacheOps.get(cacheKey);
    if (cacheData) {
      // Check if cache has expired based on our TTL
      const cacheTime = new Date(cacheData.timestamp).getTime();
      const now = new Date().getTime();
      const ttlMs = ttlHours * 60 * 60 * 1000;
      
      if (now - cacheTime <= ttlMs) {
        console.log(`Cache hit for incident ${incidentId} (age: ${Math.round((now - cacheTime) / 1000 / 60)} minutes)`);
        return returnRaw ? cacheData : cacheData.data;
      } else {
        console.log(`Cache expired for incident ${incidentId}, refreshing...`);
      }
    } else {
      console.log(`Cache miss for incident ${incidentId}, fetching from source...`);
    }
  } else {
    console.log(`Force refreshing incident ${incidentId} from source...`);
  }

  // If we're here, we need to fetch fresh data from Airtable
  try {
    console.log(`Fetching fresh incident data for ${incidentId} from Airtable...`);
    const incidentData = await getIncident(incidentId);
    
    if (!incidentData) {
      console.log(`No incident found with ID ${incidentId}`);
      return null;
    }
    
    // Debug what we got from Airtable
    console.log('RECEIVED DATA FROM AIRTABLE:');
    console.log('- Has incident:', !!incidentData.incident);
    console.log('- Has vessel:', !!incidentData.vessel);
    console.log('- Has incidentVessel:', !!incidentData.incidentVessel);
    console.log('- Has incidentType:', !!incidentData.incidentType);
    
    if (incidentData.incident) {
      console.log('- Incident fields available:', Object.keys(incidentData.incident.fields || {}).join(', '));
    }
    
    // Check if we have valid incident data before enriching
    if (!incidentData.incident || !incidentData.incident.fields || Object.keys(incidentData.incident.fields).length === 0) {
      console.error(`Invalid incident data structure received from Airtable for ${incidentId}`);
      console.log('Raw incident data:', JSON.stringify(incidentData).substring(0, 500));
      return null;
    }
    
    // Enrich and standardize the data
    const enrichedData = enrichIncidentData(incidentData);
    
    // Validate enriched data before storing
    if (!enrichedData || !enrichedData.id) {
      console.error('Enrichment failed to produce valid data for caching');
      console.log('Enriched data:', JSON.stringify(enrichedData));
      
      // Don't cache invalid data
      return null;
    }
    
    console.log(`Successfully enriched data for incident ${incidentId} with fields:`, 
                Object.keys(enrichedData).join(', '));
    
    // Store in cache with timestamp
    await cacheOps.store(cacheKey, { data: enrichedData });
    
    return returnRaw ? { data: enrichedData, timestamp: new Date().toISOString() } : enrichedData;
  } catch (error) {
    console.error(`Error fetching incident ${incidentId} from source:`, error);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Enriches incident data to provide a standard format with both nested and flat data
 * This function converts Airtable's raw nested data into a more usable format for templates and components
 * @param {Object} rawData - The raw incident data from Airtable
 * @returns {Object} Enriched and standardized incident data
 */
export function enrichIncidentData(rawData) {
  // Handle case where rawData is null
  if (!rawData) return null;
  
  console.log('Enriching incident data...');
  
  // Extract the individual components
  const { incident, vessel, incidentVessel, incidentType } = rawData;
  const incidentFields = incident ? incident.fields || {} : {};
  const vesselFields = vessel ? vessel.fields || {} : {};
  const incidentVesselFields = incidentVessel ? incidentVessel.fields || {} : {};
  const incidentTypeFields = incidentType ? incidentType.fields || {} : {};
  
  // Log available fields for debugging
  console.log('Available fields in incident:', Object.keys(incidentFields).join(', '));
  if (vesselFields) console.log('Available fields in vessel:', Object.keys(vesselFields).join(', '));
  if (incidentVesselFields) console.log('Available fields in incidentVessel:', Object.keys(incidentVesselFields).join(', '));
  
  // 1. Create the nested structure (for server-side templates like email)
  const nestedData = {
    incident: { fields: incidentFields },
    vessel: { fields: vesselFields },
    incidentVessel: { fields: incidentVesselFields },
    incidentType: { fields: incidentTypeFields }
  };
  
  // Extract coordinates
  const latitude = parseFloat(incidentFields.latitude) || 0;
  const longitude = parseFloat(incidentFields.longitude) || 0;
  
  // 2. Create the flat structure (for client-side components)
  const flatData = {
    id: incidentFields.id,
    type: incidentTypeFields.name || getIncidentTypeFromTitle(incidentFields.title),
    title: incidentFields.title,
    description: incidentFields.description,
    date: incidentFields.date_time_utc || incidentFields.date,
    location: incidentFields.location_name || incidentFields.location || 'Unknown Location',
    coordinates: {
      latitude: latitude,
      longitude: longitude
    },
    
    // Vessel data
    vesselName: vesselFields.name,
    vesselType: vesselFields.type,
    vesselFlag: vesselFields.flag,
    vesselIMO: vesselFields.imo,
    
    // Incident-Vessel relationship data
    status: incidentVesselFields.vessel_status_during_incident,
    crewStatus: incidentVesselFields.crew_impact,
    destination: incidentVesselFields.vessel_destination || incidentFields.vessel_destination,
    
    // Lookup fields from resolved relationships
    responseActions: incidentFields.response_type_names || [],
    authoritiesNotified: incidentFields.authorities_notified_names || [],
    itemsStolen: incidentFields.items_stolen_names || [],
    weaponsUsed: incidentFields.weapons_used_names || [],
    
    // Analysis
    analysis: incidentFields.analysis,
    recommendations: incidentFields.recommendations,
    
    // Map image
    mapImageUrl: incidentFields.map_image_url,
    
    // Raw ids for references
    vesselId: vesselFields.id,
    incidentVesselId: incidentVesselFields.id,
    incidentTypeId: incidentTypeFields.id
  };
  
  // Combine both structures into a single enriched object
  return {
    ...flatData,
    nested: nestedData
  };
}

/**
 * Invalidates the cache for a specific incident
 * @param {string} incidentId - The ID of the incident to invalidate in cache
 * @returns {Promise<boolean>} True if successfully invalidated, false otherwise
 */
export async function invalidateIncidentCache(incidentId) {
  if (!incidentId) {
    throw new Error('Incident ID is required');
  }
  
  const cacheKey = `${CACHE_PREFIX}${incidentId}`;
  console.log(`Invalidating cache for incident ${incidentId}`);
  
  try {
    await cacheOps.delete(cacheKey);
    console.log(`Successfully invalidated cache for incident ${incidentId}`);
    return true;
  } catch (error) {
    console.error(`Error invalidating cache for incident ${incidentId}:`, error);
    return false;
  }
}

/**
 * Updates the cache for a specific incident with new data
 * Useful for webhook handlers that receive updates from Airtable
 * @param {string} incidentId - The ID of the incident to update
 * @param {Object} newData - The new data to store (can be partial)
 * @returns {Promise<boolean>} True if successfully updated, false otherwise
 */
export async function updateIncidentCache(incidentId, newData) {
  if (!incidentId) {
    throw new Error('Incident ID is required');
  }
  
  if (!newData) {
    throw new Error('New data is required');
  }
  
  const cacheKey = `${CACHE_PREFIX}${incidentId}`;
  console.log(`Updating cache for incident ${incidentId}`);
  
  try {
    // Get current cached data if it exists
    const currentCache = await cacheOps.get(cacheKey);
    
    // If there's existing data, merge with new data
    // Otherwise just use the new data
    const updatedData = currentCache 
      ? { ...currentCache.data, ...newData }
      : newData;
    
    // Enrich the combined data
    const enrichedData = enrichIncidentData(updatedData);
    
    // Store the updated data
    await cacheOps.store(cacheKey, { data: enrichedData });
    console.log(`Successfully updated cache for incident ${incidentId}`);
    return true;
  } catch (error) {
    console.error(`Error updating cache for incident ${incidentId}:`, error);
    return false;
  }
}

/**
 * Helper function to extract incident type from title when not available from relationship
 * @param {string} title - The incident title
 * @returns {string} The extracted incident type or default value
 */
function getIncidentTypeFromTitle(title) {
  if (!title) return 'Incident';
  
  const lowerTitle = title.toLowerCase();
  
  // Common incident types based on title patterns
  const typePatterns = [
    { pattern: /robbery/i, type: 'Robbery' },
    { pattern: /armed/i, type: 'Armed Attack' },
    { pattern: /attack/i, type: 'Attack' },
    { pattern: /boarding/i, type: 'Boarding' },
    { pattern: /attempt/i, type: 'Attempted Boarding' },
    { pattern: /suspicious/i, type: 'Suspicious Approach' },
    { pattern: /piracy/i, type: 'Piracy' },
    { pattern: /hijack/i, type: 'Hijacking' }
  ];
  
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(lowerTitle)) {
      return type;
    }
  }
  
  // Default fallback - take first two words
  const words = title.split(' ');
  if (words.length >= 2) {
    return words.slice(0, 2).join(' ');
  }
  
  return 'Incident';
}
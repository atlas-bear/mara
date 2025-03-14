import { cacheOps } from './cache.js';
import axios from 'axios';

// Constants
const CACHE_TTL_HOURS = 24; // Default cache time-to-live in hours 
const CACHE_PREFIX = 'incident:';
const AIRTABLE_BASE_ID = process.env.AT_BASE_ID_CSER;
const AIRTABLE_API_KEY = process.env.AT_API_KEY;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

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
  
  // Force-clear any potentially stale cache for test incident
  if (incidentId === '20250302-2100-SIN') {
    console.log('Clearing cache for 20250302-2100-SIN to ensure fresh data from Airtable');
    try {
      await cacheOps.delete(`${CACHE_PREFIX}${incidentId}`);
    } catch (error) {
      console.log('Note: Cache clear error, but will continue with fresh fetch', error.message);
    }
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
    
    // Using the approach from fetch-incident.js which successfully gets all related data
    const incidentData = await fetchIncidentDataComprehensive(incidentId);
    
    if (!incidentData) {
      console.log(`No incident found with ID ${incidentId}`);
      return null;
    }
    
    // Debug what we got from Airtable
    console.log('RECEIVED COMPREHENSIVE DATA FROM AIRTABLE:');
    console.log('- Has id:', !!incidentData.id);
    console.log('- Has title:', !!incidentData.title);
    console.log('- Has location:', !!incidentData.location);
    console.log('- Has vessels_involved:', !!incidentData.vessels_involved && Array.isArray(incidentData.vessels_involved));
    
    if (incidentData.vessels_involved) {
      console.log('- Number of vessels involved:', incidentData.vessels_involved.length);
      if (incidentData.vessels_involved.length > 0) {
        console.log('- First vessel data:', JSON.stringify(incidentData.vessels_involved[0]));
      }
    }
    
    // Store in cache with timestamp
    await cacheOps.store(cacheKey, { data: incidentData });
    
    return returnRaw ? { data: incidentData, timestamp: new Date().toISOString() } : incidentData;
  } catch (error) {
    console.error(`Error fetching incident ${incidentId} from source:`, error);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Fetches comprehensive incident data using the approach from fetch-incident.js
 * This includes all related records (vessels, authorities, incident types, etc.)
 * @param {string} incidentId - The ID of the incident to fetch
 * @returns {Object|null} Complete incident data or null if not found
 */
async function fetchIncidentDataComprehensive(incidentId) {
  try {
    // 1. Search for the incident by its custom ID
    const incidentData = await findIncidentByCustomId(incidentId);
    if (!incidentData) {
      return null;
    }
    
    const incidentFields = incidentData.fields;
    
    // 2. Fetch all related records
    // Resolve linked records for authorities, incident types, response types, etc.
    const authorities = await fetchLinkedRecords(
      "authorities_notified",
      incidentFields.authorities_notified
    );
    
    const incidentTypes = await fetchLinkedRecords(
      "incident_type",
      incidentFields.incident_type_name
    );
    
    const responseTypes = await fetchLinkedRecords(
      "response_type",
      incidentFields.response_type
    );
    
    const weaponsUsed = await fetchLinkedRecords(
      "weapons_used",
      incidentFields.weapons_used
    );
    
    const itemsStolen = await fetchLinkedRecords(
      "items_stolen",
      incidentFields.items_stolen
    );
    
    // 3. Fetch linked vessels through incident_vessel junction table
    const incidentVessels = await fetchLinkedRecords(
      "incident_vessel",
      incidentFields.incident_vessel
    );
    
    console.log('Fetched incident_vessel records:', incidentVessels.length);
    console.log('First incident_vessel record:', JSON.stringify(incidentVessels[0] || {}).substring(0, 200));
    
    // Extract vessel IDs from incident_vessels
    const vesselIds = incidentVessels.map((v) => v.vessel_id).flat();
    console.log('Extracted vessel IDs:', vesselIds);
    
    // 4. Fetch vessel records using the IDs
    const vessels = await fetchLinkedRecords("vessel", vesselIds);
    console.log('Fetched vessel records:', vessels.length);
    console.log('First vessel record:', JSON.stringify(vessels[0] || {}).substring(0, 200));
    
    // 5. Construct the response object exactly matching the structure specified
    const responseData = {
      id: incidentId,
      title: incidentFields.title,
      date_time_utc: incidentFields.date_time_utc,
      location: {
        latitude: parseFloat(incidentFields.latitude) || 0,
        longitude: parseFloat(incidentFields.longitude) || 0,
        name: incidentFields.location
      },
      incident_type: incidentTypes.map((t) => t.name),
      description: incidentFields.description,
      analysis: incidentFields.analysis,
      recommendations: incidentFields.recommendations,
      status: incidentFields.status,
      weapons_used: weaponsUsed.map((w) => w.name),
      items_stolen: itemsStolen.map((i) => i.name),
      region: incidentFields.region,
      response_type: responseTypes.map((r) => r.name),
      authorities_notified: authorities.map((a) => a.name),
      map_image_url: incidentFields.map_image_url,
      
      // Include the vessels array exactly as shown in the example
      vessels_involved: vessels.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        flag: v.flag,
        imo: v.imo
      }))
    };
    
    return responseData;
  } catch (error) {
    console.error("Error in fetchIncidentDataComprehensive:", error);
    throw error;
  }
}

/**
 * Find an incident by its custom ID (e.g., '20250302-2100-SIN')
 * @param {string} customId - The custom ID of the incident
 * @returns {Object|null} - The incident record or null if not found
 */
async function findIncidentByCustomId(customId) {
  try {
    console.log(`Looking for incident with custom ID: ${customId}`);
    const response = await axios.get(`${AIRTABLE_URL}/incident`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      params: {
        filterByFormula: `{id}='${customId}'`,
        maxRecords: 1,
      },
    });

    const records = response.data.records;
    if (records.length === 0) {
      console.log(`No incidents found with ID ${customId}`);
      return null;
    }

    console.log(`Found incident with ID ${customId}:`, records[0].id);
    return records[0];
  } catch (error) {
    console.error(`Failed to search incident: ${customId}`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Fetch a specific record by its ID from an Airtable table
 * @param {string} table - The name of the Airtable table
 * @param {string} recordId - The ID of the record to fetch
 * @returns {Object} - The record data
 */
async function fetchAirtableRecord(table, recordId) {
  try {
    console.log(`Fetching record from ${table}: ${recordId}`);
    const response = await axios.get(`${AIRTABLE_URL}/${table}/${recordId}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${table} record: ${recordId}`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    throw error;
  }
}

/**
 * Fetch multiple linked records from an Airtable table
 * @param {string} table - The name of the Airtable table
 * @param {Array<string>} recordIds - The IDs of the records to fetch
 * @returns {Array<Object>} - Array of record fields
 */
async function fetchLinkedRecords(table, recordIds) {
  if (!recordIds || recordIds.length === 0) {
    console.log(`No record IDs provided for table ${table}`);
    return [];
  }

  console.log(`Fetching ${recordIds.length} linked records from ${table}`);
  const records = await Promise.all(
    recordIds.map((id) => fetchAirtableRecord(table, id))
  );
  
  console.log(`Successfully fetched ${records.length} records from ${table}`);
  return records.map((r) => r.fields);
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
    // In this implementation, we simply force a refresh from Airtable
    // This ensures we get the complete data structure rather than trying to
    // merge partial data which could lead to inconsistencies
    console.log(`For update operation, forcing a complete refresh from Airtable`);
    const freshData = await fetchIncidentDataComprehensive(incidentId);
    
    if (!freshData) {
      console.error(`Could not fetch fresh data for incident ${incidentId}`);
      return false;
    }
    
    // Store the fresh data in cache
    await cacheOps.store(cacheKey, { data: freshData });
    console.log(`Successfully updated cache for incident ${incidentId} with fresh data`);
    return true;
  } catch (error) {
    console.error(`Error updating cache for incident ${incidentId}:`, error);
    return false;
  }
}
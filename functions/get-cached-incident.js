import { getCachedIncident } from './utils/incident-cache.js';
import { corsHeaders } from './utils/environment.js';

/**
 * Cached incident fetching endpoint
 * This function uses the caching layer to efficiently retrieve incident data
 * with a standardized format. It's initially being used for flash reports
 * but can be gradually adopted by other parts of the application.
 */
export const handler = async (event) => {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' }),
    };
  }

  if (event.httpMethod !== "GET") {
    return { 
      statusCode: 405, 
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  const { id, forceRefresh } = event.queryStringParameters;
  if (!id) {
    return { 
      statusCode: 400, 
      headers: corsHeaders,
      body: JSON.stringify({ error: "Incident ID is required" }) 
    };
  }

  try {
    console.log(`[get-cached-incident] Fetching incident ${id} (force refresh: ${forceRefresh === 'true'})`);
    
    // Use the cache layer to get standardized incident data
    const incidentData = await getCachedIncident(id, { 
      forceRefresh: forceRefresh === 'true'
    });
    
    // If no incident is found
    if (!incidentData) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Incident not found" }),
      };
    }
    
    console.log(`[get-cached-incident] Incident ${id} successfully retrieved`);
    
    // Return the enriched data which includes both flat and nested formats
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(incidentData),
    };
  } catch (error) {
    console.error("[get-cached-incident] Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to fetch incident data",
        details: error.message,
      }),
    };
  }
};
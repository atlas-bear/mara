/**
 * @fileoverview Serverless function to generate historical trends data for maritime incidents
 * 
 * This function fetches incident data from Airtable for the past 6 months,
 * processes it by region and month, and returns formatted data for charts and analysis.
 */

import axios from "axios";

/**
 * Gets the three-letter month abbreviation for a date string
 * @param {string} dateStr - Date string in ISO format
 * @returns {string} Three-letter month abbreviation (e.g., "Jan", "Feb")
 */
function getMonthName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('default', { month: 'short' });
}

/**
 * Processes incident data to generate historical trends by region and month
 * @async
 * @param {string} baseId - Airtable base ID
 * @param {string} apiKey - Airtable API key
 * @returns {Object|null} Historical trends object or null if processing fails
 */
async function processHistoricalTrends(baseId, apiKey) {
  try {
    // Define regions to track
    const regions = [
      "West Africa",
      "Southeast Asia", 
      "Indian Ocean",
      "Americas",
      "Europe"
    ];
    
    // Get data for last 6 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    
    const formula = `AND(
      {date_time_utc} >= '${formattedStartDate}',
      {date_time_utc} <= '${formattedEndDate}'
    )`;
    
    console.log("Fetching trends with formula:", formula);
    
    // Fetch all incidents within date range
    const response = await axios.get(
      `https://api.airtable.com/v0/${baseId}/incident?filterByFormula=${encodeURIComponent(formula)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    
    // Initialize result object
    const historicalTrends = {};
    regions.forEach(region => {
      historicalTrends[region] = [];
    });
    
    // Group incidents by region and month
    const incidentsByRegionAndMonth = {};
    
    response.data.records.forEach(incident => {
      const region = incident.fields.region;
      if (!regions.includes(region)) return;
      
      const date = new Date(incident.fields.date_time_utc);
      const month = date.toLocaleString('default', { month: 'short' });
      
      if (!incidentsByRegionAndMonth[region]) {
        incidentsByRegionAndMonth[region] = {};
      }
      
      if (!incidentsByRegionAndMonth[region][month]) {
        incidentsByRegionAndMonth[region][month] = 0;
      }
      
      incidentsByRegionAndMonth[region][month]++;
    });
    
    // Convert to required format
    for (const region of regions) {
      // Generate a complete 6-month sequence
      const monthsData = [];
      
      for (let i = 0; i < 6; i++) {
        const date = new Date(endDate);
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });
        
        const value = (incidentsByRegionAndMonth[region] && 
                       incidentsByRegionAndMonth[region][month]) || 0;
                       
        monthsData.unshift({ month, value });
      }
      
      historicalTrends[region] = monthsData;
    }
    
    return historicalTrends;
  } catch (error) {
    console.error("Error processing historical trends:", error);
    return null;
  }
}

/**
 * Netlify serverless function handler
 * @async
 * @param {Object} event - Netlify function event object
 * @returns {Object} Response object with status code and body
 */
export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const historicalTrends = await processHistoricalTrends(
      process.env.AT_BASE_ID_CSER,
      process.env.AT_API_KEY
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600" // Cache for 1 hour
      },
      body: JSON.stringify({ historicalTrends })
    };
  } catch (error) {
    console.error("Error in get-trend-data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch trend data",
        details: error.message
      })
    };
  }
};
/**
 * @fileoverview Serverless function to generate monthly breakdown data for maritime incidents
 * 
 * This function fetches incident data from Airtable for the past 6 months,
 * categorizes incidents by type (robberies, attacks, etc.), and returns
 * formatted data for region-specific monthly charts.
 */

import axios from "axios";

/**
 * Processes incident data to generate monthly breakdown by region and incident type
 * @async
 * @param {string} baseId - Airtable base ID
 * @param {string} apiKey - Airtable API key
 * @returns {Object|null} Regional monthly data object or null if processing fails
 */
async function processRegionalMonthlyData(baseId, apiKey) {
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
    
    // Fetch all incidents within date range
    const response = await axios.get(
      `https://api.airtable.com/v0/${baseId}/incident?filterByFormula=${encodeURIComponent(formula)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    
    // Fetch incident types for categorization
    const typeResponse = await axios.get(
      `https://api.airtable.com/v0/${baseId}/incident_type`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    
    // Map incident type IDs to categories
    const typeMap = {};
    typeResponse.data.records.forEach(type => {
      const name = type.fields.name.toLowerCase();
      let category = 'other';
      
      if (name.includes('robbery') || name.includes('theft')) {
        category = 'robberies';
      } else if (name.includes('attack') || name.includes('fired upon')) {
        category = 'attacks';
      } else if (name.includes('boarding') || name.includes('boarded')) {
        category = 'boardings';
      } else if (name.includes('suspicious')) {
        category = 'suspicious';
      } else if (name.includes('piracy')) {
        category = 'piracy';
      }
      
      typeMap[type.id] = category;
    });
    
    // Initialize result object
    const regionalMonthlyData = {};
    regions.forEach(region => {
      regionalMonthlyData[region] = [];
    });
    
    // Group incidents by region, month and type
    const incidentsByRegionMonthType = {};
    
    response.data.records.forEach(incident => {
      const region = incident.fields.region;
      if (!regions.includes(region)) return;
      
      const date = new Date(incident.fields.date_time_utc);
      const month = date.toLocaleString('default', { month: 'short' });
      
      // Determine incident type category
      let category = 'other';
      if (incident.fields.incident_type_name && incident.fields.incident_type_name.length > 0) {
        category = typeMap[incident.fields.incident_type_name[0]] || 'other';
      }
      
      if (!incidentsByRegionMonthType[region]) {
        incidentsByRegionMonthType[region] = {};
      }
      
      if (!incidentsByRegionMonthType[region][month]) {
        incidentsByRegionMonthType[region][month] = {
          incidents: 0,
          robberies: 0,
          attacks: 0,
          boardings: 0,
          suspicious: 0,
          piracy: 0,
          other: 0
        };
      }
      
      // Increment total incidents and specific category
      incidentsByRegionMonthType[region][month].incidents++;
      incidentsByRegionMonthType[region][month][category]++;
    });
    
    // Convert to required format
    for (const region of regions) {
      // Generate a complete 6-month sequence
      const monthsData = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(endDate);
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });
        
        const monthData = (incidentsByRegionMonthType[region] && 
                          incidentsByRegionMonthType[region][month]) || 
                          { incidents: 0, robberies: 0, attacks: 0, boardings: 0, suspicious: 0, piracy: 0, other: 0 };
                       
        monthsData.push({ 
          month, 
          incidents: monthData.incidents,
          robberies: monthData.robberies,
          attacks: monthData.attacks,
          boardings: monthData.boardings,
          suspicious: monthData.suspicious,
          piracy: monthData.piracy,
          other: monthData.other
        });
      }
      
      regionalMonthlyData[region] = monthsData;
    }
    
    return regionalMonthlyData;
  } catch (error) {
    console.error("Error processing regional monthly data:", error);
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
    const regionalMonthlyData = await processRegionalMonthlyData(
      process.env.AT_BASE_ID_CSER,
      process.env.AT_API_KEY
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600" // Cache for 1 hour
      },
      body: JSON.stringify({ regionalMonthlyData })
    };
  } catch (error) {
    console.error("Error in get-monthly-data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch monthly data",
        details: error.message
      })
    };
  }
};
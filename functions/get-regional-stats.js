/**
 * @fileoverview Serverless function to generate regional statistics for maritime incidents
 * 
 * This function calculates various statistics for each maritime region, including:
 * - Year-to-date incidents
 * - Comparison with previous year (same period)
 * - Weekly incident trends
 * - Change direction indicators (up/down/none)
 */

import axios from "axios";

/**
 * Processes incident data to generate statistics for each region
 * Uses environment variables for Airtable access
 * @async
 * @returns {Object|null} Regional statistics object or null if processing fails
 */
async function processRegionalStats() {
  try {
    // Define regions to track
    const regions = [
      "West Africa",
      "Southeast Asia", 
      "Indian Ocean",
      "Americas",
      "Europe"
    ];
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const previousYear = currentYear - 1;
    
    // Start of current year
    const ytdStartDate = new Date(currentYear, 0, 1);
    const ytdEndDate = new Date();
    
    // Last year's equivalent date range
    const lyStartDate = new Date(previousYear, 0, 1);
    const lyEndDate = new Date(previousYear, 
                              currentDate.getMonth(), 
                              currentDate.getDate());
    
    // Last week (for weekly comparison)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Format dates for Airtable query
    const formattedYtdStartDate = ytdStartDate.toISOString();
    const formattedYtdEndDate = ytdEndDate.toISOString();
    const formattedLyStartDate = lyStartDate.toISOString();
    const formattedLyEndDate = lyEndDate.toISOString();
    const formattedOneWeekAgo = oneWeekAgo.toISOString();
    const formattedCurrentDate = currentDate.toISOString();
    const formattedTwoWeeksAgo = twoWeeksAgo.toISOString();
    
    // Fetch YTD incidents
    const ytdFormula = `AND(
      {date_time_utc} >= '${formattedYtdStartDate}',
      {date_time_utc} <= '${formattedYtdEndDate}'
    )`;
    
    const ytdResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident?filterByFormula=${encodeURIComponent(ytdFormula)}`,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    
    // Fetch last year's incidents for same period
    const lyFormula = `AND(
      {date_time_utc} >= '${formattedLyStartDate}',
      {date_time_utc} <= '${formattedLyEndDate}'
    )`;
    
    const lyResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident?filterByFormula=${encodeURIComponent(lyFormula)}`,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    
    // Fetch last week's incidents
    const lastWeekFormula = `AND(
      {date_time_utc} >= '${formattedOneWeekAgo}',
      {date_time_utc} <= '${formattedCurrentDate}'
    )`;
    
    const lastWeekResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident?filterByFormula=${encodeURIComponent(lastWeekFormula)}`,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    
    // Fetch previous week's incidents (for comparison)
    const prevWeekFormula = `AND(
      {date_time_utc} >= '${formattedTwoWeeksAgo}',
      {date_time_utc} <= '${formattedOneWeekAgo}'
    )`;
    
    const prevWeekResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident?filterByFormula=${encodeURIComponent(prevWeekFormula)}`,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    
    // Calculate statistics for each region
    const regionalStats = {};
    
    regions.forEach(region => {
      // Count YTD incidents for this region
      const ytdIncidents = ytdResponse.data.records.filter(
        incident => incident.fields.region === region
      ).length;
      
      // Count last year incidents for this region
      const lyIncidents = lyResponse.data.records.filter(
        incident => incident.fields.region === region
      ).length;
      
      // Count last week incidents
      const lastWeekIncidents = lastWeekResponse.data.records.filter(
        incident => incident.fields.region === region
      ).length;
      
      // Count previous week incidents
      const prevWeekIncidents = prevWeekResponse.data.records.filter(
        incident => incident.fields.region === region
      ).length;
      
      // Calculate percent change from last year
      let changeFromLastYear = 0;
      let changeDirection = "none";
      
      if (lyIncidents > 0) {
        changeFromLastYear = Math.round(((ytdIncidents - lyIncidents) / lyIncidents) * 100);
        changeDirection = changeFromLastYear > 0 ? "up" : 
                         changeFromLastYear < 0 ? "down" : "none";
      } else if (ytdIncidents > 0) {
        changeFromLastYear = 100; // If there were no incidents last year but there are this year
        changeDirection = "up";
      }
      
      // Make sure we have absolute value for display purposes
      changeFromLastYear = Math.abs(changeFromLastYear);
      
      // Determine weekly change direction
      let weeklyChangeDirection = "none";
      if (lastWeekIncidents > prevWeekIncidents) {
        weeklyChangeDirection = "up";
      } else if (lastWeekIncidents < prevWeekIncidents) {
        weeklyChangeDirection = "down";
      }
      
      // Store the calculated statistics
      regionalStats[region] = {
        ytdIncidents,
        changeFromLastYear,
        lastYearIncidents: lyIncidents,
        changeDirection,
        lastWeekIncidents: prevWeekIncidents, // This is the previous week's incidents
        weeklyChangeDirection
      };
    });
    
    return regionalStats;
  } catch (error) {
    console.error("Error processing regional stats:", error);
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
  // Handle OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }
  
  if (event.httpMethod !== "GET") {
    return { 
      statusCode: 405, 
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: "Method Not Allowed" 
    };
  }

  try {
    const regionalStats = await processRegionalStats();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ regionalStats })
    };
  } catch (error) {
    console.error("Error in get-regional-stats:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch regional stats",
        details: error.message
      })
    };
  }
};
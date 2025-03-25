/**
 * Serverless function to generate weekly report content for Executive Brief
 * Generates automated "Key Developments" and "7-Day Forecast" sections
 * using the LLM service
 */

import { callClaudeWithPrompt } from "./utils/llm-service.js";
import { log } from "./utils/logger.js";
import axios from "axios";

/**
 * Gets regional stats from incidents
 * @param {Array} incidents - Array of incident objects
 * @returns {Object} Stats by region including threat levels
 */
const getRegionalStats = (incidents) => {
  // Group incidents by region
  const regions = ["West Africa", "Southeast Asia", "Indian Ocean", "Americas", "Europe"];
  const regionalData = {};
  
  // Initialize regions
  regions.forEach(region => {
    regionalData[region] = {
      incidents: 0,
      threatLevel: { level: "Low", icon: "●" }
    };
  });
  
  // Count incidents by region
  incidents.forEach(inc => {
    const region = inc.incident.fields.region;
    if (region && regionalData[region]) {
      regionalData[region].incidents++;
    }
  });
  
  // Calculate threat levels
  Object.entries(regionalData).forEach(([region, data]) => {
    // Override threat levels for Southeast Asia and Indian Ocean to "Substantial"
    if (region === "Southeast Asia" || region === "Indian Ocean" || region === "West Africa") {
      data.threatLevel = { level: 'Substantial', icon: '▲' };
    } else if (data.incidents >= 2) {
      data.threatLevel = { level: 'Moderate', icon: '►' };
    } else if (data.incidents >= 1) {
      data.threatLevel = { level: 'Low', icon: '●' };
    }
  });
  
  return regionalData;
};

/**
 * Fetches historical trends data from get-trend-data function
 * @returns {Object} Trend data by region or empty object on failure
 */
const fetchHistoricalTrends = async () => {
  try {
    // Use PUBLIC_URL or SITE_URL if defined, empty string as fallback
    const baseUrl = process.env.PUBLIC_URL || process.env.SITE_URL || '';
    console.log("Base URL for trend data:", baseUrl);
    
    const response = await axios.get(
      `${baseUrl}/.netlify/functions/get-trend-data`,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    if (response.data && response.data.historicalTrends) {
      return response.data.historicalTrends;
    }
    
    return {};
  } catch (error) {
    log.warn("Error fetching historical trends", error);
    return {};
  }
};

export const handler = async (event) => {
  // Add CORS headers for preflight requests
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
    const { start, end } = event.queryStringParameters;
    if (!start || !end) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Missing required parameters",
          message: "start and end dates are required"
        })
      };
    }

    // Parse dates
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Fetch incidents for the week from existing serverless function
    try {
      // Use PUBLIC_URL or SITE_URL if defined, empty string as fallback
      const baseUrl = process.env.PUBLIC_URL || process.env.SITE_URL || '';
      console.log("Base URL for API calls:", baseUrl);
      
      const incidentsResponse = await axios.get(
        `${baseUrl}/.netlify/functions/get-weekly-incidents?start=${start}&end=${end}`
      );
      
      const { incidents } = incidentsResponse.data;
      
      // Get historical trend data
      const trends = await fetchHistoricalTrends();
      
      // Generate regional stats
      const regionalStats = getRegionalStats(incidents);
      
      // Prepare data for the LLM
      const reportData = {
        incidents,
        regionalData: {
          stats: regionalStats,
          trends
        },
        startDate,
        endDate
      };
      
      // Call Claude to generate the weekly report content
      const reportContent = await callClaudeWithPrompt("weeklyReport", reportData);
      
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        },
        body: JSON.stringify(reportContent)
      };
    } catch (error) {
      log.error("Error fetching incidents:", error);
      throw new Error(`Failed to fetch incidents: ${error.message}`);
    }
  } catch (error) {
    log.error("Error generating weekly report content:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: "Failed to generate weekly report content",
        details: error.message
      })
    };
  }
};
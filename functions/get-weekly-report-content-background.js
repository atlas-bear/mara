/**
 * Background function to pre-generate weekly report content
 * Scheduled to run once per week at the end of the reporting period
 * Generates and caches the Key Developments and 7-Day Forecast sections
 */

import { callClaudeWithPrompt } from "./utils/llm-service.js";
import { log } from "./utils/logger.js";
import { weeklyReportCache } from "./utils/weekly-report-cache.js";
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
 * Fetches historical trends data
 * @returns {Object} Trend data by region or empty object on failure
 */
const fetchHistoricalTrends = async () => {
  try {
    // Use PUBLIC_URL or SITE_URL if defined, empty string as fallback
    const baseUrl = process.env.PUBLIC_URL || process.env.SITE_URL || '';
    log.info("Base URL for trend data:", baseUrl);
    
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

/**
 * Gets the start and end dates for the current reporting week
 * Weeks run from Monday to Sunday
 * @returns {Object} Object with start and end dates for the week
 */
const getCurrentReportingPeriod = () => {
  const now = new Date();
  const endDate = new Date(now);
  
  // Set end time to end of current day
  endDate.setHours(23, 59, 59, 999);
  
  // Calculate the most recent Monday (beginning of the week)
  const startDate = new Date(endDate);
  const daysSinceMonday = (startDate.getDay() + 6) % 7; // Monday is 0 in this calculation
  startDate.setDate(startDate.getDate() - daysSinceMonday);
  startDate.setHours(0, 0, 0, 0);
  
  return { startDate, endDate };
};

/**
 * Main function to generate and cache weekly report content
 */
export const handler = async (event) => {
  log.info("Starting weekly report content background generation");
  
  try {
    // Get the current reporting period
    const { startDate, endDate } = getCurrentReportingPeriod();
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    
    log.info(`Generating report for period: ${start} to ${end}`);
    
    // Create cache key for this reporting period
    const cacheKey = weeklyReportCache.getKey(start, end);
    
    // Check if we already have this cached (we shouldn't but just in case)
    const existingCache = await weeklyReportCache.get(cacheKey);
    if (existingCache) {
      log.info(`Report for ${start} to ${end} already exists in cache`);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: "Weekly report content already cached",
          period: { start, end }
        })
      };
    }
    
    // Fetch incidents for the reporting period
    try {
      // Use PUBLIC_URL or SITE_URL if defined, empty string as fallback
      const baseUrl = process.env.PUBLIC_URL || process.env.SITE_URL || '';
      log.info("Base URL for API calls:", baseUrl);
      
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
      log.info("Calling Claude to generate weekly report content");
      const reportContent = await callClaudeWithPrompt("weeklyReport", reportData);
      log.info("Successfully generated weekly report content");
      
      // Cache the generated content with 7-day TTL
      await weeklyReportCache.store(cacheKey, reportContent);
      log.info(`Cached weekly report content for ${start} to ${end}`);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: "Weekly report content generated and cached successfully",
          period: { start, end }
        })
      };
    } catch (error) {
      log.error("Error fetching incidents:", error);
      throw new Error(`Failed to fetch incidents: ${error.message}`);
    }
  } catch (error) {
    log.error("Error generating weekly report content:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to generate weekly report content",
        details: error.message
      })
    };
  }
};
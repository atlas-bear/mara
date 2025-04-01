/**
 * Function to refresh weekly report content by forcing a regeneration
 */

import axios from "axios";
import { log } from "./utils/logger.js";
import { weeklyReportCache } from "./utils/weekly-report-cache.js";

export const handler = async (event) => {
  // Add CORS headers for browser access
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    // Get start and end dates from query parameters or use defaults
    const start = event.queryStringParameters?.start || "2025-03-24T21:00:00.000Z";
    const end = event.queryStringParameters?.end || "2025-03-31T21:00:00.000Z";
    
    // Get the base URL for internal API calls
    const baseUrl = process.env.PUBLIC_URL || process.env.SITE_URL || '';
    log.info(`Using base URL: ${baseUrl} for weekly report refresh`);
    
    // Step 1: Try to delete the cache entry directly
    const cacheKey = weeklyReportCache.getKey(start, end);
    log.info(`Attempting to delete weekly report cache: ${cacheKey}`);
    
    try {
      await weeklyReportCache.delete(cacheKey);
      log.info(`Successfully deleted weekly report cache: ${cacheKey}`);
    } catch (cacheError) {
      log.warn(`Error deleting cache (continuing anyway): ${cacheError.message}`);
    }
    
    // Step 2: Force regeneration by calling get-weekly-report-content
    log.info(`Forcing regeneration of weekly report content for ${start} to ${end}`);
    
    try {
      const response = await axios.get(
        `${baseUrl}/.netlify/functions/get-weekly-report-content?start=${start}&end=${end}`,
        { headers: { "X-Force-Refresh": "true" } }
      );
      
      if (response.status === 200) {
        log.info("Weekly report content refresh successful");
        
        // Get some info about the response
        const regionInfo = [];
        if (response.data.regionalSummary) {
          Object.entries(response.data.regionalSummary).forEach(([region, data]) => {
            regionInfo.push(`${region}: ${data.incidentCount || 0} incidents`);
          });
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: "success",
            message: "Weekly report content refreshed successfully",
            cacheStatus: response.headers["x-cache"] || "Unknown",
            cacheSource: response.headers["x-cache-source"] || "Unknown",
            regions: regionInfo
          })
        };
      } else {
        throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);
      }
    } catch (apiError) {
      log.error("Error calling get-weekly-report-content", apiError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          status: "error",
          message: "Error regenerating content",
          error: apiError.message
        })
      };
    }
  } catch (error) {
    log.error("Unhandled error in refresh-weekly-report", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: "error",
        message: "Internal server error",
        error: error.message
      })
    };
  }
};
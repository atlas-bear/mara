/**
 * Background function to pre-generate weekly report content
 * 
 * @fileoverview This serverless function is scheduled to run once per week at 2100 UTC on Mondays,
 * which marks the end of the weekly reporting period. It generates and caches the Key Developments 
 * and 7-Day Forecast sections for the just-completed reporting week.
 * 
 * The reporting period in this system runs from Monday 2100 UTC to Monday 2100 UTC.
 * For example, the reporting period for Week 12 runs from Mon Mar 17 21:00 UTC to Mon Mar 24 21:00 UTC.
 * 
 * @module get-weekly-report-content-background
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
 * In this system, weeks run from Monday 2100 UTC to Monday 2100 UTC
 * (e.g., Week 12 runs from Mon Mar 17 21:00 UTC to Mon Mar 24 21:00 UTC)
 * @returns {Object} Object with start and end dates for the week
 */
const getCurrentReportingPeriod = () => {
  const now = new Date();
  
  // Find the current/most recent Monday at 2100 UTC
  const endDate = new Date(now);
  
  // Calculate days until next Monday (0 if today is Monday)
  const currentDay = endDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  let daysToAdjust = 0;
  
  if (currentDay === 1) {
    // Today is Monday - check if it's before or after 2100 UTC
    const currentHour = endDate.getUTCHours();
    if (currentHour < 21) {
      // Before 2100 UTC - use previous Monday
      daysToAdjust = -7;
    }
    // After 2100 UTC - use today (daysToAdjust stays 0)
  } else if (currentDay === 0) {
    // Sunday - next Monday is tomorrow
    daysToAdjust = 1;
  } else {
    // Tuesday through Saturday - calculate days until next Monday
    daysToAdjust = 8 - currentDay; // (8 - currentDay) gives days until next Monday
  }
  
  endDate.setDate(endDate.getDate() + daysToAdjust);
  
  // Set to exactly 2100 UTC (9:00 PM)
  endDate.setUTCHours(21, 0, 0, 0);
  
  // Start date is exactly 7 days before end date (previous Monday at 2100 UTC)
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  
  // Get the week number for logging/verification
  const weekNum = getWeekNumber(endDate);
  const year = endDate.getFullYear();
  
  // Format dates for human-readable logging
  const startUTC = `${startDate.getUTCFullYear()}-${(startDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${startDate.getUTCDate().toString().padStart(2, '0')} ${startDate.getUTCHours().toString().padStart(2, '0')}:${startDate.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  const endUTC = `${endDate.getUTCFullYear()}-${(endDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${endDate.getUTCDate().toString().padStart(2, '0')} ${endDate.getUTCHours().toString().padStart(2, '0')}:${endDate.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  
  log.info(`Generating content for week ${year}-${weekNum}`);
  log.info(`Reporting period: ${startUTC} to ${endUTC}`);
  log.info(`ISO dates: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  log.info(`Day of week check - Start: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getDay()]}, End: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][endDate.getDay()]}`);
  
  return { startDate, endDate };
};

/**
 * Calculates week number following ISO week date standard
 * (Same as in src/shared/features/weekly-report/utils/dates.js)
 * @param {Date} date - Date to get week number for
 * @returns {number} Week number (1-53)
 */
const getWeekNumber = (date) => {
  // Create a copy of the date to avoid modifying the input
  const target = new Date(date.valueOf());

  // Find Thursday of the current week
  const dayNum = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);

  // Get first Thursday of the year
  const firstThursday = new Date(target.getFullYear(), 0, 1);
  if (firstThursday.getDay() !== 4) {
    firstThursday.setMonth(0, 1 + ((4 - firstThursday.getDay() + 7) % 7));
  }

  // Calculate week number
  const weekNum = 1 + Math.ceil((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));

  return weekNum;
};

/**
 * Utility function to test the date calculation for a given input date
 * This helps verify our logic is correct across different scenarios
 * @param {string} dateString - ISO date string to test with
 * @returns {Object} The calculated reporting period
 */
const testReportingPeriod = (dateString) => {
  // Create a date object from the input string
  const testDate = new Date(dateString);
  log.info(`Testing reporting period calculation for: ${testDate.toISOString()}`);
  
  // Save the original Date constructor
  const OriginalDate = global.Date;
  
  // Mock the Date constructor to return our test date when called without arguments
  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        // When called with no args (new Date()), return our test date
        return new OriginalDate(testDate);
      }
      // Otherwise use the original constructor
      return new OriginalDate(...args);
    }
  };
  
  // Run our calculation with the mocked date
  const result = getCurrentReportingPeriod();
  
  // Restore the original Date constructor
  global.Date = OriginalDate;
  
  // Format for logging
  const startUTC = `${result.startDate.getUTCFullYear()}-${(result.startDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${result.startDate.getUTCDate().toString().padStart(2, '0')} ${result.startDate.getUTCHours().toString().padStart(2, '0')}:${result.startDate.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  const endUTC = `${result.endDate.getUTCFullYear()}-${(result.endDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${result.endDate.getUTCDate().toString().padStart(2, '0')} ${result.endDate.getUTCHours().toString().padStart(2, '0')}:${result.endDate.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  
  log.info(`Test result for ${dateString}:`);
  log.info(`Reporting period: ${startUTC} to ${endUTC}`);
  
  return result;
};

/**
 * Netlify serverless function handler
 * 
 * @async
 * @param {Object} event - The Netlify function event object
 * @param {Object} event.queryStringParameters - URL query parameters
 * @param {string} [event.queryStringParameters.debug] - If 'true', runs in debug mode to test date calculations
 * @returns {Object} Response object with status code and body
 */
export const handler = async (event) => {
  log.info("Starting weekly report content background generation");
  
  // Debug mode options
  const isDebug = event?.queryStringParameters?.debug === 'true';
  const testCache = event?.queryStringParameters?.testCache === 'true';
  
  // Test cache if requested
  if (testCache) {
    try {
      log.info("Debug mode: Testing cache operations");
      
      // Test cache key
      const testKey = "weekly-report-test-" + Date.now();
      const testData = { 
        keyDevelopments: [{region: "Test", level: "orange", content: "Test development"}],
        forecast: [{region: "Test", trend: "stable", content: "Test forecast"}]
      };
      
      // Store test data
      log.info(`Storing test data with key: ${testKey}`);
      await weeklyReportCache.store(testKey, testData);
      
      // Retrieve the data
      log.info(`Retrieving test data with key: ${testKey}`);
      const retrieved = await weeklyReportCache.get(testKey);
      
      // Clean up
      log.info(`Deleting test data with key: ${testKey}`);
      await weeklyReportCache.delete(testKey);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: "Cache test completed, check function logs for results",
          cacheWorking: !!retrieved,
          testKey,
          storedData: testData,
          retrievedData: retrieved
        })
      };
    } catch (error) {
      log.error("Error testing cache", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          message: "Cache test failed",
          error: error.message
        })
      };
    }
  }
  
  // Test date calculations
  if (isDebug) {
    log.info("Debug mode: Testing date calculations");
    
    // Test for multiple scenarios
    testReportingPeriod("2025-03-24T22:00:00Z"); // Monday after 2100 UTC
    testReportingPeriod("2025-03-24T20:00:00Z"); // Monday before 2100 UTC
    testReportingPeriod("2025-03-25T12:00:00Z"); // Tuesday
    testReportingPeriod("2025-03-23T12:00:00Z"); // Sunday
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Debug tests completed, check function logs for results",
      })
    };
  }
  
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
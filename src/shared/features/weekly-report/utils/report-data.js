/**
 * @fileoverview Dynamic data provider for weekly maritime reports
 * 
 * This module fetches real data from Airtable through serverless functions
 * and provides it in the same format as the original mock data.
 * It includes caching to reduce API calls and falls back to mock data
 * when API calls fail or when data is being fetched.
 */

import {
  mockHistoricalTrends,
  regionalMonthlyData as mockRegionalData,
  regionalStats as mockRegionalStats,
} from "./mock-data";

// Cache mechanism
/** @type {Object|null} Cached historical trends data */
let cachedTrends = null;
/** @type {Object|null} Cached regional monthly data */
let cachedMonthlyData = null;
/** @type {Object|null} Cached regional statistics */
let cachedStats = null;
/** @type {number|null} Timestamp of when the cache was last updated */
let cacheTimestamp = null;
/** @const {number} Cache time-to-live in milliseconds (24 hours) */
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** API base URL - empty string means same-origin, or use VITE_MARA_API_URL env var */
const API_BASE_URL = import.meta.env?.VITE_MARA_API_URL || '';

/**
 * Fetches actual historical trends data from the API
 * @async
 * @returns {Object} Historical trends data or mock data if fetch fails
 */
async function fetchActualHistoricalTrends() {
  try {
    const url = `${API_BASE_URL}/.netlify/functions/get-trend-data`;
    console.log(`Fetching historical trends from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`API responded with status ${response.status}`);

    const data = await response.json();
    return data.historicalTrends || mockHistoricalTrends;
  } catch (error) {
    console.error("Error fetching historical trends:", error);
    return mockHistoricalTrends;
  }
}

/**
 * Fetches actual regional monthly data from the API
 * @async
 * @returns {Object} Regional monthly data or mock data if fetch fails
 */
async function fetchActualRegionalMonthlyData() {
  try {
    const url = `${API_BASE_URL}/.netlify/functions/get-monthly-data`;
    console.log(`Fetching monthly data from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`API responded with status ${response.status}`);

    const data = await response.json();
    return data.regionalMonthlyData || mockRegionalData;
  } catch (error) {
    console.error("Error fetching regional monthly data:", error);
    return mockRegionalData;
  }
}

/**
 * Fetches actual regional statistics from the API
 * @async
 * @returns {Object} Regional statistics or mock data if fetch fails
 */
async function fetchActualRegionalStats() {
  try {
    const url = `${API_BASE_URL}/.netlify/functions/get-regional-stats`;
    console.log(`Fetching regional stats from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`API responded with status ${response.status}`);

    const data = await response.json();
    return data.regionalStats || mockRegionalStats;
  } catch (error) {
    console.error("Error fetching regional stats:", error);
    return mockRegionalStats;
  }
}

/**
 * Initializes data by fetching from APIs and updating cache
 * Only fetches if cache is invalid or expired
 * @async
 */
async function initializeData() {
  // Skip if cache is valid
  if (
    cachedTrends &&
    cachedMonthlyData &&
    cachedStats &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TTL
  ) {
    return;
  }

  // Fetch all data in parallel
  const [trends, monthlyData, stats] = await Promise.all([
    fetchActualHistoricalTrends(),
    fetchActualRegionalMonthlyData(),
    fetchActualRegionalStats(),
  ]);

  // Update cache
  cachedTrends = trends;
  cachedMonthlyData = monthlyData;
  cachedStats = stats;
  cacheTimestamp = Date.now();
}

// Initialize data immediately
initializeData().catch(console.error);

/**
 * Proxy object that provides historical trends data
 * Uses cached data when available, falls back to mock data
 * @type {Object}
 */
export const historicalTrends = new Proxy(
  {},
  {
    get: (target, prop) => {
      // If we have cached data, use it
      if (cachedTrends) return cachedTrends[prop];
      // Otherwise fall back to mock data
      return mockHistoricalTrends[prop];
    },
  }
);

/**
 * Proxy object that provides regional monthly data
 * Uses cached data when available, falls back to mock data
 * @type {Object}
 */
export const regionalMonthlyData = new Proxy(
  {},
  {
    get: (target, prop) => {
      if (cachedMonthlyData) return cachedMonthlyData[prop];
      return mockRegionalData[prop];
    },
  }
);

/**
 * Proxy object that provides regional statistics
 * Uses cached data when available, falls back to mock data
 * @type {Object}
 */
export const regionalStats = new Proxy(
  {},
  {
    get: (target, prop) => {
      if (cachedStats) return cachedStats[prop];
      return mockRegionalStats[prop];
    },
  }
);

/**
 * Manually refreshes all report data by invalidating the cache
 * and fetching fresh data from the APIs
 * @async
 * @returns {Object} Object containing all refreshed data
 */
export async function refreshReportData() {
  cacheTimestamp = null; // Invalidate cache
  await initializeData();
  return {
    historicalTrends: cachedTrends,
    regionalMonthlyData: cachedMonthlyData,
    regionalStats: cachedStats,
  };
}
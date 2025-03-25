import { getStore } from "@netlify/blobs";
import { log } from "./logger.js";

const weeklyReportStore = getStore({
  name: "weekly-reports",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_ACCESS_TOKEN,
  debug: true,
});

/** Cache time-to-live in milliseconds (7 days) */
const WEEKLY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Specialized cache operations for weekly report content
 * with a 7-day TTL instead of the standard 1-hour
 */
export const weeklyReportCache = {
  /**
   * Stores weekly report content in Netlify Blobs storage with automatic timestamp
   * 
   * @param {string} key - The cache key to store data under
   * @param {*} value - The data to store (will be serialized to JSON)
   * @returns {Promise<void>}
   */
  store: async (key, value) => {
    try {
      // Log the first few characters of the token for verification
      const tokenPreview = process.env.NETLIFY_ACCESS_TOKEN
        ? `${process.env.NETLIFY_ACCESS_TOKEN.substring(0, 4)}...`
        : "none";

      // Diagnostic logging
      log.info("Weekly report cache store attempt:", {
        key,
        siteId: process.env.NETLIFY_SITE_ID,
        tokenPreview,
        hasNetlifySiteId: !!process.env.NETLIFY_SITE_ID,
        hasAccessToken: !!process.env.NETLIFY_ACCESS_TOKEN,
      });

      const cacheData = {
        ...value,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + WEEKLY_CACHE_TTL).toISOString()
      };

      await weeklyReportStore.setJSON(key, cacheData);
      log.info(`Weekly report cached: ${key}`);
    } catch (error) {
      log.error("Failed to store weekly report in cache", {
        error: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        key,
        siteId: process.env.NETLIFY_SITE_ID,
      });
    }
  },

  /**
   * Retrieves weekly report content from Netlify Blobs storage with 7-day expiration check
   * 
   * @param {string} key - The cache key to retrieve data for
   * @returns {Promise<*|null>} The cached data, or null if not found or expired
   */
  get: async (key) => {
    try {
      // Log diagnostic info
      log.info("Attempting to get cache:", {
        key,
        siteId: process.env.NETLIFY_SITE_ID,
        hasNetlifySiteId: !!process.env.NETLIFY_SITE_ID,
        hasAccessToken: !!process.env.NETLIFY_ACCESS_TOKEN,
      });

      // Get list of all available keys for debugging
      try {
        const list = await weeklyReportStore.list();
        log.info("Available cache keys:", { keys: list });
      } catch (listError) {
        log.warn("Could not list cache keys", listError);
      }

      const cacheData = await weeklyReportStore.get(key, { type: "json" });
      if (!cacheData) {
        log.info(`Weekly report cache miss: ${key}`);
        return null;
      }

      // Check 7-day expiration
      const cacheTime = new Date(cacheData.timestamp).getTime();
      const now = new Date().getTime();
      if (now - cacheTime > WEEKLY_CACHE_TTL) {
        // 7-day expiration
        log.info(`Weekly report cache expired: ${key}`);
        await weeklyReportStore.delete(key);
        return null;
      }

      log.info(`Weekly report cache hit: ${key}`);
      return cacheData;
    } catch (error) {
      log.error("Failed to retrieve weekly report from cache", error);
      return null;
    }
  },

  /**
   * Deletes weekly report content from Netlify Blobs storage
   * 
   * @param {string} key - The cache key to delete
   * @returns {Promise<void>}
   */
  delete: async (key) => {
    try {
      await weeklyReportStore.delete(key);
      log.info(`Weekly report cache deleted: ${key}`);
    } catch (error) {
      log.error("Failed to delete weekly report from cache", error);
    }
  },
  
  /**
   * Gets the cache key for a specific date range
   * 
   * @param {string|Date} start - Start date of the reporting period
   * @param {string|Date} end - End date of the reporting period
   * @returns {string} Formatted cache key
   */
  getKey: (start, end) => {
    // Convert to ISO string if date objects
    const startStr = start instanceof Date ? start.toISOString() : start;
    const endStr = end instanceof Date ? end.toISOString() : end;
    return `weekly-report-content-${startStr}-${endStr}`;
  }
};
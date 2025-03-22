import { getStore } from "@netlify/blobs";

const cacheStore = getStore({
  name: "mara-cache",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_ACCESS_TOKEN,
  debug: true,
});

/**
 * Utilities for caching data using Netlify Blobs storage
 * 
 * Provides methods for storing, retrieving, and deleting cached data
 * with automatic timestamp tracking
 */
export const cacheOps = {
  /**
   * Stores data in Netlify Blobs storage with automatic timestamp
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
      console.log("Cache store attempt:", {
        key,
        siteId: process.env.NETLIFY_SITE_ID,
        tokenPreview,
        hasNetlifySiteId: !!process.env.NETLIFY_SITE_ID,
        hasAccessToken: !!process.env.NETLIFY_ACCESS_TOKEN,
        blobsStore: !!cacheStore,
      });

      const cacheData = {
        ...value,
        timestamp: new Date().toISOString(),
      };

      await cacheStore.setJSON(key, cacheData);
      console.log(`Cache stored: ${key}`);
    } catch (error) {
      console.error("Failed to store cache in Blobs", {
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
   * Retrieves data from Netlify Blobs storage with automatic expiration check
   * 
   * @param {string} key - The cache key to retrieve data for
   * @returns {Promise<*|null>} The cached data, or null if not found or expired
   */
  get: async (key) => {
    try {
      const cacheData = await cacheStore.get(key, { type: "json" }); // Updated method to retrieve JSON
      if (!cacheData) {
        console.log(`Cache miss: ${key}`);
        return null;
      }

      // Optional: Check expiration (e.g., 1 hour)
      const cacheTime = new Date(cacheData.timestamp).getTime();
      const now = new Date().getTime();
      if (now - cacheTime > 3600000) {
        // 1 hour expiration
        console.log(`Cache expired: ${key}`);
        await cacheStore.delete(key);
        return null;
      }

      console.log(`Cache hit: ${key}`);
      return cacheData;
    } catch (error) {
      console.error("Failed to retrieve cache from Blobs", error);
      return null;
    }
  },

  /**
   * Deletes data from Netlify Blobs storage
   * 
   * @param {string} key - The cache key to delete
   * @returns {Promise<void>}
   */
  delete: async (key) => {
    try {
      await cacheStore.delete(key);
      console.log(`Cache deleted: ${key}`);
    } catch (error) {
      console.error("Failed to delete cache from Blobs", error);
    }
  },
};

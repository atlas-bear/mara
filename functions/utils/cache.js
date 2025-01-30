import { getStore } from "@netlify/blobs";

const cacheStore = getStore({
  name: "mara-cache",
  siteID: process.env.NETLIFY_SITE_ID,
  token: process.env.NETLIFY_ACCESS_TOKEN,
});

export const cacheOps = {
  // Store data in Netlify Blobs
  store: async (key, value) => {
    try {
      const cacheData = {
        ...value,
        timestamp: new Date().toISOString(),
      };

      // Add diagnostic logging
      console.log("Cache store attempt:", {
        key,
        hasNetlifySiteId: !!process.env.NETLIFY_SITE_ID,
        hasAccessToken: !!process.env.NETLIFY_ACCESS_TOKEN,
        blobsStore: !!cacheStore,
      });

      await cacheStore.setJSON(key, cacheData);
      console.log(`Cache stored: ${key}`);
    } catch (error) {
      console.error("Failed to store cache in Blobs", {
        error: error.message,
        code: error.code,
        status: error.status,
        key,
      });
      throw error; // Re-throw to handle in calling function
    }
  },

  // Retrieve data from Netlify Blobs
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

  // Delete data from Netlify Blobs
  delete: async (key) => {
    try {
      await cacheStore.delete(key);
      console.log(`Cache deleted: ${key}`);
    } catch (error) {
      console.error("Failed to delete cache from Blobs", error);
    }
  },
};

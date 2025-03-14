import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";

export const handler = async (event, context) => {
  try {
    // Allow a direct key to be specified (highest priority)
    const directKey = event.queryStringParameters?.key;
    
    if (directKey) {
      // Delete the exact specified key
      log.info(`Attempting to delete specific cache key: ${directKey}`);
      await cacheOps.delete(directKey);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "success",
          message: `Cache cleared for key: ${directKey}`,
        }),
      };
    }
    
    // Get source from query parameters, if not provided will clear all caches
    const source = event.queryStringParameters?.source;

    if (source) {
      // Clear specific source cache
      const cacheKey = `${source}-incidents`;
      await cacheOps.delete(cacheKey);
      log.info(`Cleared cache for: ${cacheKey}`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "success",
          message: `Cache cleared for ${source}`,
        }),
      };
    } else {
      // Clear all known source caches
      const sources = ["recaap", "ukmto", "cwd", "mdat"];
      for (const src of sources) {
        await cacheOps.delete(`${src}-incidents`);
        log.info(`Cleared cache for: ${src}-incidents`);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "success",
          message: "All caches cleared",
        }),
      };
    }
  } catch (error) {
    log.error("Error clearing cache", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message,
      }),
    };
  }
};

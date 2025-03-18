import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";

export const handler = async (event, context) => {
  try {
    // All hash keys we want to clear
    const hashKeys = [
      'icc-hash',
      'cwd-hash',
      'ukmto-hash',
      'recaap-hash',
      'mdat-hash',
      'last-processed-hashes'
    ];
    
    // Results tracking
    const results = {};
    
    // Delete each hash key
    for (const key of hashKeys) {
      try {
        log.info(`Attempting to delete key: ${key}`);
        await cacheOps.delete(key);
        results[key] = 'success';
      } catch (error) {
        log.error(`Error deleting key: ${key}`, error);
        results[key] = `error: ${error.message}`;
      }
    }
    
    // Also clear the -incidents caches if requested
    const clearIncidents = event.queryStringParameters?.clearIncidents === 'true';
    if (clearIncidents) {
      const incidentKeys = [
        'icc-incidents',
        'cwd-incidents',
        'ukmto-incidents',
        'recaap-incidents',
        'mdat-incidents'
      ];
      
      for (const key of incidentKeys) {
        try {
          log.info(`Attempting to delete incident cache: ${key}`);
          await cacheOps.delete(key);
          results[key] = 'success';
        } catch (error) {
          log.error(`Error deleting incident cache: ${key}`, error);
          results[key] = `error: ${error.message}`;
        }
      }
    }
    
    log.info("Cache clearing operation complete", results);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: "Hash cache clearing operation completed",
        results
      }, null, 2),
    };
  } catch (error) {
    log.error("Error in clear-all-hashes function", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message
      }),
    };
  }
};
import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";

export const handler = async (event, context) => {
  try {
    const count = parseInt(event.queryStringParameters?.count || "1");
    const source = event.queryStringParameters?.source || "recaap";
    const cacheKey = `${source}-incidents`;

    // Get current cache
    const cachedData = await cacheOps.get(cacheKey);
    if (!cachedData || !cachedData.incidents) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          status: "error",
          message: `No cached data found for ${source}`,
        }),
      };
    }

    // Remove the specified number of most recent incidents
    const removedIncidents = cachedData.incidents.slice(0, count);
    const remainingIncidents = cachedData.incidents.slice(count);

    // Update cache with remaining incidents
    await cacheOps.store(cacheKey, {
      ...cachedData,
      incidents: remainingIncidents,
      timestamp: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `Removed ${count} recent incidents`,
        removed: removedIncidents.map((inc) => inc.sourceId),
        remainingCount: remainingIncidents.length,
      }),
    };
  } catch (error) {
    log.error("Error removing recent incidents", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message,
      }),
    };
  }
};

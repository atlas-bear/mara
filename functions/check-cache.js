import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";

export const handler = async (event, context) => {
  try {
    // Get source from query parameters or default to 'recaap'
    const source = event.queryStringParameters?.source || "recaap";
    const cacheKey = `${source}-incidents`;

    log.info(`Checking cache for ${cacheKey}`);

    const cachedData = await cacheOps.get(cacheKey);

    if (!cachedData) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          status: "not_found",
          message: `No cached data found for ${source}`,
        }),
      };
    }

    // Return a summary rather than the full data to avoid response size limits
    const summary = {
      incidentCount: cachedData.incidents?.length || 0,
      hash: cachedData.hash,
      firstIncident: cachedData.incidents?.[0],
      lastIncident: cachedData.incidents?.[cachedData.incidents.length - 1],
      cacheTimestamp: cachedData.timestamp,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          status: "success",
          data: summary,
        },
        null,
        2
      ),
    };
  } catch (error) {
    log.error("Error checking cache", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message,
      }),
    };
  }
};

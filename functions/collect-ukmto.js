import { cacheOps } from "./utils/cache.js";
import { fetchWithTimeout } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";

const path = require("path");
const fullPath = __filename;
const filename = path.basename(__filename, ".js");
const parts = filename.split("-");
if (parts.length !== 2) {
  throw new Error("Filename must follow pattern: collect-SOURCE.js");
}

const SOURCE = parts[1];
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL = process.env.SOURCE_URL_UKMTO;
log.info(`SOURCE_URL for ${SOURCE_UPPER}: ${SOURCE_URL}`);
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;

export const handler = async (event, context) => {
  try {
    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    // Fetch new data from the source
    const response = await fetchWithTimeout(SOURCE_URL, { timeout: 10000 });
    if (!response.data) {
      throw new Error(`No data received from ${SOURCE_UPPER} source`);
    }
    const rawData = response.data;
    log.info(`Fetched ${SOURCE_UPPER} data successfully`, {
      count: rawData.length,
    });

    // Generate a hash of the raw data to check for changes
    const currentHash = generateHash(rawData);
    const cachedHash = await cacheOps.get(CACHE_KEY_HASH);

    if (cachedHash === currentHash) {
      log.info(`No new ${SOURCE_UPPER} incidents detected.`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-change",
          message: "No new incidents to process.",
        }),
      };
    }

    log.info(`New ${SOURCE_UPPER} incidents detected. Processing data...`);

    // Process and standardize the raw incidents
    const standardizedIncidents = rawData.map((incident) => {
      return standardizeIncident({
        sourceId: `${SOURCE_UPPER}-${incident.incidentNumber}`,
        source: SOURCE_UPPER,
        dateOccurred: incident.utcDateOfIncident,
        title: incident.incidentTypeName,
        description: incident.otherDetails,
        latitude: incident.locationLatitude,
        longitude: incident.locationLongitude,
        region: incident.region,
        vesselName: incident.vesselName || "N/A",
        vesselType: incident.vesselType || "N/A",
        place: incident.place,
      });
    });

    log.info(`Standardized ${SOURCE_UPPER} incidents`, {
      count: standardizedIncidents.length,
    });

    // Store the standardized incidents and the new hash in the cache
    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: standardizedIncidents,
      hash: currentHash,
    });
    await cacheOps.store(CACHE_KEY_HASH, currentHash);

    log.info(`Stored new ${SOURCE_UPPER} incidents in cache`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `New ${SOURCE_UPPER} incidents processed.`,
        count: standardizedIncidents.length,
      }),
    };
  } catch (error) {
    log.error(`Failed to collect ${SOURCE_UPPER} incidents`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", message: error.message }),
    };
  }
};

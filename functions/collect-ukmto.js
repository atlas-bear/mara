import { cacheOps } from "./utils/cache.js";
import { fetchWithTimeout } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { hashData } from "./utils/hash.js";
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
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;

export const collectUKMTO = async () => {
  try {
    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    // Fetch new data from the source
    const response = await fetchWithTimeout(SOURCE_URL, {
      timeout: 10000,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${SOURCE_UPPER} data. Status: ${response.status}`
      );
    }
    const rawData = await response.json();
    log.info(`Fetched ${SOURCE_UPPER} data successfully`, {
      count: rawData.length,
    });

    // Generate a hash of the raw data to check for changes
    const currentHash = hashData(rawData);
    const cachedHash = await cacheOps.get(CACHE_KEY_HASH);

    if (cachedHash === currentHash) {
      log.info(`No new ${SOURCE_UPPER} incidents detected.`);
      return { status: "no-change", message: "No new incidents to process." };
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
      status: "success",
      message: `New ${SOURCE_UPPER} incidents processed.`,
      count: standardizedIncidents.length,
    };
  } catch (error) {
    log.error(`Failed to collect ${SOURCE_UPPER} incidents`, error);
    throw error;
  }
};

// Run the collector if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectUKMTO()
    .then((result) => log.info(`${SOURCE_UPPER} collection completed`, result))
    .catch((error) => log.error(`Error in ${SOURCE_UPPER} collection`, error));
}

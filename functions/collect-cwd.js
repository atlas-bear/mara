import { fetchHtmlContent } from "./utils/fetch.js";
import { parseCwdHtmlContent } from "./utils/parser.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { log } from "./utils/logger.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { cacheOps } from "./utils/cache.js";
import { generateHash } from "./utils/hash.js";

const SOURCE = "cwd";
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL = process.env.SOURCE_URL_CWD;
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;
const CACHE_KEY_RUNS = "function-runs";

// Helper to store run information
async function logRun(functionName, status, details = {}) {
  try {
    const cached = (await cacheOps.get(CACHE_KEY_RUNS)) || { runs: [] };

    cached.runs.unshift({
      function: functionName,
      status,
      timestamp: new Date().toISOString(),
      ...details,
    });

    // Keep only last 100 runs
    if (cached.runs.length > 100) {
      cached.runs = cached.runs.slice(0, 100);
    }

    await cacheOps.store(CACHE_KEY_RUNS, cached);
  } catch (error) {
    log.error("Error logging run", error);
  }
}

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");
    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    // Verify required environment variables
    verifyEnvironmentVariables([
      "BRD_HOST",
      "BRD_PORT",
      "BRD_USER",
      "BRD_PASSWORD",
      "SOURCE_URL_CWD",
    ]);

    log.info(`Fetching content from: ${SOURCE_URL}`);
    const htmlContent = await fetchHtmlContent(SOURCE_URL, {}, log);

    // Parse raw incidents
    const rawIncidents = parseCwdHtmlContent(htmlContent, log);

    // Standardize incidents for downstream processing
    const standardizedIncidents = rawIncidents.map((incident) =>
      standardizeIncident(incident, "Clearwater Dynamics", SOURCE_URL)
    );

    // Serialize only relevant fields for hashing
    const hashableIncidents = standardizedIncidents.map(
      ({ title, description, date, reference, region, category }) => ({
        title,
        description,
        date,
        reference,
        region,
        category,
      })
    );
    const serializedData = JSON.stringify(hashableIncidents);
    log.info("Generated serialized data for hashing");

    // Generate new hash based on serialized data
    const currentHash = generateHash(serializedData);
    const cachedHash = await cacheOps.get(CACHE_KEY_HASH);

    if (cachedHash === currentHash) {
      log.info(`No new ${SOURCE_UPPER} incidents detected.`);

      await logRun(context.functionName, "success", {
        duration: Date.now() - startTime,
        itemsProcessed: 0,
        status: "no-change",
        source: SOURCE_UPPER,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-change",
          message: "No new incidents to process.",
        }),
      };
    }

    log.info(`New ${SOURCE_UPPER} incidents detected. Processing data...`);

    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: standardizedIncidents,
      hash: currentHash,
      timestamp: new Date().toISOString(),
    });
    await cacheOps.store(CACHE_KEY_HASH, currentHash);

    log.info(`Stored new ${SOURCE_UPPER} incidents in cache`);

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: standardizedIncidents.length,
      status: "new-data",
      source: SOURCE_UPPER,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `New ${SOURCE_UPPER} incidents processed.`,
        count: standardizedIncidents.length,
      }),
    };
  } catch (error) {
    log.error(`${SOURCE_UPPER} incident collection failed`, error);

    await logRun(context.functionName, "error", {
      error: error.message,
      duration: Date.now() - startTime,
      source: SOURCE_UPPER,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "Error during collection",
        error: error.message,
      }),
    };
  }
};

import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";

const SOURCE = "mdat";
const SOURCE_UPPER = SOURCE.toUpperCase();
const BASE_URL =
  process.env.SOURCE_URL_MDAT ||
  "https://gog-mdat.org/api/occurrences/getPoints";
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;
const CACHE_KEY_METRICS = `${SOURCE}-metrics`;
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

    if (cached.runs.length > 100) {
      cached.runs = cached.runs.slice(0, 100);
    }

    await cacheOps.store(CACHE_KEY_RUNS, cached);
  } catch (error) {
    log.error("Error logging run", error);
  }
}

function generateDateUrl() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1); // Get incidents from last month to now
  return `${BASE_URL}/${date.toISOString()}`;
}

function validateIncident(incident) {
  const errors = [];

  const requiredFields = ["type", "geometry", "properties"];

  const requiredProperties = [
    "id",
    "title",
    "serial",
    "description",
    "gdh",
    "occurrenceType",
  ];

  // Check required top-level fields
  requiredFields.forEach((field) => {
    if (!incident[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check geometry
  if (incident.geometry) {
    if (
      !incident.geometry.coordinates ||
      !Array.isArray(incident.geometry.coordinates) ||
      incident.geometry.coordinates.length !== 2
    ) {
      errors.push("Invalid coordinates in geometry");
    }
  }

  // Check required properties
  if (incident.properties) {
    requiredProperties.forEach((prop) => {
      if (!incident.properties[prop]) {
        errors.push(`Missing required property: ${prop}`);
      }
    });

    // Validate date format
    if (incident.properties.gdh) {
      const date = new Date(incident.properties.gdh);
      if (isNaN(date.getTime())) {
        errors.push("Invalid date format");
      }
    }

    // Validate occurrence type
    if (
      incident.properties.occurrenceType &&
      (!incident.properties.occurrenceType.id ||
        !incident.properties.occurrenceType.label)
    ) {
      errors.push("Invalid occurrence type structure");
    }
  }

  return errors;
}

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");

    verifyEnvironmentVariables([
      "BRD_HOST",
      "BRD_PORT",
      "BRD_USER",
      "BRD_PASSWORD",
      "SOURCE_URL_MDAT",
    ]);

    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    const url = generateDateUrl();
    const response = await fetchWithRetry(url, {
      headers: {
        Accept: "application/json",
        Origin: "https://gog-mdat.org",
      },
    });

    const rawData = response.data.features;
    if (!Array.isArray(rawData)) {
      throw new Error(
        `Invalid response format: expected array, got ${typeof rawData}`
      );
    }

    log.info(`Fetched ${SOURCE_UPPER} data`, { count: rawData.length });

    // Validate and filter incidents
    const validIncidents = [];
    const invalidIncidents = [];

    for (const incident of rawData) {
      const errors = validateIncident(incident);
      if (errors.length === 0) {
        validIncidents.push(incident);
      } else {
        log.info("Validation failed for incident", {
          id: incident.id,
          errors: errors,
        });
        invalidIncidents.push({ incident, errors });
      }
    }

    // Check for changes using hash
    const currentHash = generateHash(JSON.stringify(validIncidents));
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

    // Standardize valid incidents
    const standardizedIncidents = validIncidents.map((incident) =>
      standardizeIncident(
        {
          sourceId: `${SOURCE_UPPER}-${incident.properties.serial}`,
          source: SOURCE_UPPER,
          dateOccurred: incident.properties.gdh,
          title: incident.properties.title,
          description: incident.properties.description,
          latitude: incident.geometry.coordinates[1],
          longitude: incident.geometry.coordinates[0],
          region: "Gulf of Guinea",
          category: incident.properties.occurrenceType.label,
          isAlert: incident.properties.isAlert,
          isAdvisory: incident.properties.isAdvisory,
          updates: incident.properties.title.includes("UPDATE")
            ? [
                {
                  text: incident.properties.description,
                },
              ]
            : [],
        },
        SOURCE_UPPER,
        url
      )
    );

    // Store processed data
    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: standardizedIncidents,
      hash: currentHash,
      timestamp: new Date().toISOString(),
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
    });

    await cacheOps.store(CACHE_KEY_HASH, currentHash);

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: standardizedIncidents.length,
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `New ${SOURCE_UPPER} incidents processed.`,
        count: standardizedIncidents.length,
        valid: validIncidents.length,
        invalid: invalidIncidents.length,
      }),
    };
  } catch (error) {
    log.error(`${SOURCE_UPPER} incident collection failed`, error);

    await logRun(context.functionName, "error", {
      error: error.message,
      duration: Date.now() - startTime,
      details: error.response?.data || "No additional details available",
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message,
        details: error.response?.data || "No additional details available",
      }),
    };
  }
};

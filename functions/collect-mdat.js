import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { validateIncident, validateDateFormat } from "./utils/validation.js";

const SOURCE = "mdat";
const SOURCE_UPPER = SOURCE.toUpperCase();
const BASE_URL =
  process.env.SOURCE_URL_MDAT || "https://gog-mdat.org/api/events/getPoints";
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;
const CACHE_KEY_METRICS = `${SOURCE}-metrics`;
const CACHE_KEY_RUNS = "function-runs";

// Configuration constants for date handling
const DATE_CONFIG = {
  COLLECTION_WINDOW_DAYS: 60, // Base collection window
  OVERLAP_DAYS: 2, // Extra days for overlap to prevent missing incidents
  MAX_FUTURE_DAYS: 1, // Maximum days in the future to accept
  MAX_PAST_DAYS: 90, // Maximum days in the past to accept
};

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

function validateDateRange(startDate, endDate) {
  const dateValidation = validateDateFormat(startDate, {
    allowFuture: false,
    maxPastDays: DATE_CONFIG.MAX_PAST_DAYS,
    requireTime: true,
  });

  const endDateValidation = validateDateFormat(endDate, {
    allowFuture: true,
    maxPastDays: 0,
    requireTime: true,
  });

  const errors = [
    ...(dateValidation.isValid ? [] : dateValidation.errors),
    ...(endDateValidation.isValid ? [] : endDateValidation.errors),
  ];

  return {
    isValid: errors.length === 0,
    errors,
    normalizedDates:
      errors.length === 0
        ? {
            startDate: dateValidation.normalizedDate,
            endDate: endDateValidation.normalizedDate,
          }
        : null,
  };
}

function generateDateRangeUrls() {
  const now = new Date();
  const windowStart = new Date();
  windowStart.setDate(
    windowStart.getDate() -
      (DATE_CONFIG.COLLECTION_WINDOW_DAYS + DATE_CONFIG.OVERLAP_DAYS)
  );

  const startDate = windowStart.toISOString();
  const endDate = now.toISOString();

  const validation = validateDateRange(startDate, endDate);
  if (!validation.isValid) {
    log.error("Date range validation failed", { errors: validation.errors });
  }

  log.info("Generating date range for collection", {
    startDate,
    endDate,
    daysSpan: DATE_CONFIG.COLLECTION_WINDOW_DAYS,
    overlapDays: DATE_CONFIG.OVERLAP_DAYS,
    totalDays: DATE_CONFIG.COLLECTION_WINDOW_DAYS + DATE_CONFIG.OVERLAP_DAYS,
  });

  return {
    startDate: validation.normalizedDates?.startDate || startDate,
    endDate: validation.normalizedDates?.endDate || endDate,
    url: `${BASE_URL}/${startDate}`,
    validationErrors: validation.errors,
  };
}

function processRawIncident(incident) {
  const shipInfo = incident.properties?.ship || {};

  return {
    sourceId: `${SOURCE_UPPER}-${incident.properties.serial}`,
    source: SOURCE_UPPER,
    dateOccurred: incident.properties.dateStart,
    title: incident.properties.label,
    description: incident.properties.description,

    // Location information
    latitude: incident.geometry.coordinates[1],
    longitude: incident.geometry.coordinates[0],
    region: "west_africa",
    location: {
      place: incident.properties.location || "Gulf of Guinea",
      description: incident.properties.locationDetail,
      coordinates: {
        latitude: incident.geometry.coordinates[1],
        longitude: incident.geometry.coordinates[0],
      },
    },

    // Vessel information - maintain same structure as original
    vessel: {
      name: shipInfo.name || null,
      type: shipInfo.type || null,
      flag: shipInfo.flag || null,
      imo: shipInfo.imo || null,
    },

    // Incident classification - mapped from new structure
    category: incident.properties.eventType?.label,
    type: "MDAT Alert",
    severity: incident.properties.eventLevel?.label,

    // Status information - maintain same logic as original
    status: "active",
    isAlert: Boolean(incident.properties.eventLevel?.label === "ALERT"),
    isAdvisory: Boolean(incident.properties.eventLevel?.label !== "ALERT"),

    // Updates parsing - if label contains "UPDATE" (same logic as original)
    updates: incident.properties.label.includes("UPDATE")
      ? [
          {
            text: incident.properties.description,
            timestamp: incident.properties.dateStart,
          },
        ]
      : [],

    // Additional metadata - maintain same structure as original
    reportedBy: incident.properties.reporter || SOURCE_UPPER,
    verifiedBy: incident.properties.verifier || null,
    lastUpdated:
      incident.properties.lastModified || incident.properties.dateStart,
    created_at: incident.properties.dateStart,
    modified_at: incident.properties.lastModified || new Date().toISOString(),

    // Store complete raw incident
    raw: incident,
  };
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

    const { url, startDate, endDate, validationErrors } =
      generateDateRangeUrls();

    if (validationErrors?.length > 0) {
      log.error("Date validation errors detected", { validationErrors });
    }

    const response = await fetchWithRetry(url, {
      headers: {
        Accept: "application/json",
        Origin: "https://gog-mdat.org",
      },
    });

    if (!response.data?.features || !Array.isArray(response.data.features)) {
      throw new Error(
        `Invalid response format: expected features array, got ${typeof response
          .data?.features}`
      );
    }

    const validIncidents = [];
    const invalidIncidents = [];

    // Process and validate each incident
    for (const rawIncident of response.data.features) {
      try {
        // First, process the raw incident into our expected format
        const processedIncident = processRawIncident(rawIncident);

        // Validate the processed incident
        const validation = validateIncident(processedIncident, SOURCE_UPPER);

        if (validation.isValid) {
          validIncidents.push(validation.normalized);
        } else {
          log.info("Validation failed for incident", {
            serial: rawIncident.properties.serial,
            errors: validation.errors,
          });
          invalidIncidents.push({
            incident: rawIncident,
            errors: validation.errors,
          });
        }
      } catch (error) {
        log.error("Error processing incident", error, {
          serial: rawIncident.properties?.serial,
        });
        invalidIncidents.push({
          incident: rawIncident,
          errors: [error.message],
        });
      }
    }

    if (validIncidents.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-data",
          message: "No valid incidents found in date range.",
        }),
      };
    }

    // Generate hash and check for changes
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
      standardizeIncident(incident, SOURCE_UPPER, BASE_URL)
    );

    // Store processed data
    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: standardizedIncidents,
      hash: currentHash,
      timestamp: new Date().toISOString(),
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
      metadata: {
        collectionWindow: {
          startDate,
          endDate,
          daysSpan: DATE_CONFIG.COLLECTION_WINDOW_DAYS,
          overlapDays: DATE_CONFIG.OVERLAP_DAYS,
        },
      },
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
        collectionWindow: {
          startDate,
          endDate,
        },
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

import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import {
  validateDateFormat,
  validateCoordinates,
  validateFields,
} from "./utils/validation.js";

const SOURCE = "ukmto";
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL = process.env.SOURCE_URL_UKMTO;
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

    // Keep only last 100 runs
    if (cached.runs.length > 100) {
      cached.runs = cached.runs.slice(0, 100);
    }

    await cacheOps.store(CACHE_KEY_RUNS, cached);
  } catch (error) {
    log.error("Error logging run", error);
  }
}

// Constants for monitoring and retry logic
const EXPECTED_INCIDENT_RANGE = {
  min: 4, // Minimum expected incidents
  max: 10, // Maximum expected incidents
};

// Validation schemas
const requiredFields = {
  incidentNumber: "number",
  utcDateOfIncident: "string",
  incidentTypeName: "string",
  otherDetails: "string",
  locationLatitude: "number",
  locationLongitude: "number",
  region: "string",
};

const optionalFields = {
  incidentIssuer: "string",
  sitecoreId: "string",
  utcDateCreated: "string",
  incidentTypeLevel: "number",
  locationLatitudeDDDMMSS: "string",
  locationLongitudeDDDMMSS: "string",
  place: "string",
  vesselName: "string",
  vesselType: "string",
  vesselUnderPirateControl: "boolean",
  dateVesselTaken: ["object", "null"],
  crewHeld: "number",
  hideFromTicker: "boolean",
  extendTickerTime: "boolean",
};

// Helper function to validate incident structure
function validateIncident(incident) {
  const errors = validateFields(incident, requiredFields, optionalFields);

  const dateValidation = validateDateFormat(incident.utcDateOfIncident);
  if (!dateValidation.isValid) {
    errors.push(dateValidation.error);
  }

  const coordValidation = validateCoordinates(
    incident.locationLatitude,
    incident.locationLongitude
  );
  if (!coordValidation.isValid) {
    errors.push(...coordValidation.errors);
  }

  return errors;
}

// Helper function to check incident count for UKMTO's rolling feed
async function validateIncidentCount(newCount) {
  try {
    const metrics = (await cacheOps.get(CACHE_KEY_METRICS)) || {
      updates: [],
      lastCount: newCount,
    };

    // For UKMTO, we're mainly concerned if:
    // 1. The count falls outside our expected range
    // 2. We suddenly get 0 incidents
    // 3. The count changes dramatically from the last check
    const isWithinRange =
      newCount >= EXPECTED_INCIDENT_RANGE.min &&
      newCount <= EXPECTED_INCIDENT_RANGE.max;
    const hasIncidents = newCount > 0;
    const countDelta = Math.abs(newCount - metrics.lastCount);
    const hasReasonableChange = countDelta <= 3; // Allow for small changes between checks

    if (!isWithinRange || !hasIncidents || !hasReasonableChange) {
      log.info(`Incident count anomaly detected`, {
        newCount,
        lastCount: metrics.lastCount,
        isWithinRange,
        hasIncidents,
        countDelta,
        expectedRange: EXPECTED_INCIDENT_RANGE,
      });
    }

    // Update metrics with rolling window of last 10 checks
    metrics.updates.push({
      timestamp: new Date().toISOString(),
      count: newCount,
    });
    metrics.updates = metrics.updates.slice(-10);
    metrics.lastCount = newCount;

    await cacheOps.store(CACHE_KEY_METRICS, metrics);

    // Return true if everything looks normal
    return isWithinRange && hasIncidents && hasReasonableChange;
  } catch (error) {
    log.error("Error validating incident count", error);
    return true; // Continue processing despite metrics error
  }
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
      "SOURCE_URL_UKMTO",
    ]);

    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    // Fetch data with retry logic
    const response = await fetchWithRetry(SOURCE_URL, {
      headers: {
        Origin: "https://www.ukmto.org",
        Referer: "https://www.ukmto.org/",
      },
    });

    const rawData = response.data;
    log.info("Raw incident data example:", {
      sampleIncident: rawData[0],
      dataTypes: Object.entries(rawData[0]).reduce((acc, [key, value]) => {
        acc[key] = typeof value;
        return acc;
      }, {}),
    });
    if (!Array.isArray(rawData)) {
      throw new Error(
        `Invalid response format: expected array, got ${typeof rawData}`
      );
    }

    log.info(`Fetched ${SOURCE_UPPER} data`, { count: rawData.length });

    // Validate incident count
    const isCountValid = await validateIncidentCount(rawData.length);
    if (!isCountValid) {
      log.error("Unusual incident count detected", { count: rawData.length });
    }

    // Validate and filter incidents
    const validIncidents = [];
    const invalidIncidents = [];

    for (const incident of rawData) {
      const errors = validateIncident(incident);
      if (errors.length === 0) {
        validIncidents.push(incident);
      } else {
        // Add detailed logging for each invalid incident
        log.info("Validation failed for incident", {
          incidentNumber: incident.incidentNumber,
          errors: errors,
          incidentData: {
            utcDateOfIncident: incident.utcDateOfIncident,
            incidentTypeName: incident.incidentTypeName,
            region: incident.region,
            locationLatitude: incident.locationLatitude,
            locationLongitude: incident.locationLongitude,
          },
        });
        invalidIncidents.push({ incident, errors });
      }
    }

    if (invalidIncidents.length > 0) {
      log.error("Invalid incidents detected", {
        totalCount: rawData.length,
        validCount: validIncidents.length,
        invalidCount: invalidIncidents.length,
        invalidIncidents: invalidIncidents.map(({ incident, errors }) => ({
          incidentNumber: incident.incidentNumber,
          errors: errors,
        })),
      });
    }

    // Process only valid incidents
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

    const standardizedIncidents = validIncidents.map((incident) =>
      standardizeIncident(
        {
          reference: incident.incidentNumber,
          source: incident.incidentIssuer,
          date: incident.utcDateOfIncident,
          title: incident.incidentTypeName,
          description: incident.otherDetails,
          latitude: incident.locationLatitude,
          longitude: incident.locationLongitude,
          region: incident.region,
          category: incident.incidentTypeName,
          updates: [],
          aggressors: null,
          raw: incident,
        },
        SOURCE_UPPER,
        SOURCE_URL
      )
    );

    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: standardizedIncidents,
      hash: currentHash,
      timestamp: new Date().toISOString(),
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
    });

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: standardizedIncidents.length,
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
      isCountNormal: isCountValid,
      metrics: {
        expectedRange: EXPECTED_INCIDENT_RANGE,
        isWithinRange:
          standardizedIncidents.length >= EXPECTED_INCIDENT_RANGE.min &&
          standardizedIncidents.length <= EXPECTED_INCIDENT_RANGE.max,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `New ${SOURCE_UPPER} incidents processed.`,
        count: standardizedIncidents.length,
        valid: validIncidents.length,
        invalid: invalidIncidents.length,
        isCountNormal: isCountValid,
        metrics: {
          expectedRange: EXPECTED_INCIDENT_RANGE,
          isWithinRange:
            standardizedIncidents.length >= EXPECTED_INCIDENT_RANGE.min &&
            standardizedIncidents.length <= EXPECTED_INCIDENT_RANGE.max,
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

import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { validateIncident, validateDateFormat } from "./utils/validation.js";

const SOURCE = "ukmto";
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL = process.env.SOURCE_URL_UKMTO;
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;
const CACHE_KEY_METRICS = `${SOURCE}-metrics`;
const CACHE_KEY_RUNS = "function-runs";

// Constants for monitoring and validation
const INCIDENT_METRICS = {
  EXPECTED_RANGE: {
    min: 4,
    max: 10,
  },
  MAX_DELTA: 3, // Maximum acceptable change between checks
  RETENTION_DAYS: 30, // How long to keep incidents
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

// Helper function to check incident count metrics
async function validateIncidentMetrics(newCount) {
  try {
    const metrics = (await cacheOps.get(CACHE_KEY_METRICS)) || {
      updates: [],
      lastCount: newCount,
    };

    const isWithinRange =
      newCount >= INCIDENT_METRICS.EXPECTED_RANGE.min &&
      newCount <= INCIDENT_METRICS.EXPECTED_RANGE.max;
    const hasIncidents = newCount > 0;
    const countDelta = Math.abs(newCount - metrics.lastCount);
    const hasReasonableChange = countDelta <= INCIDENT_METRICS.MAX_DELTA;

    // Update metrics history
    metrics.updates.push({
      timestamp: new Date().toISOString(),
      count: newCount,
      isWithinRange,
      delta: countDelta,
    });
    metrics.updates = metrics.updates.slice(-10); // Keep last 10 updates
    metrics.lastCount = newCount;

    await cacheOps.store(CACHE_KEY_METRICS, metrics);

    if (!isWithinRange || !hasIncidents || !hasReasonableChange) {
      log.info("Incident count anomaly detected", {
        newCount,
        lastCount: metrics.lastCount,
        isWithinRange,
        hasIncidents,
        countDelta,
        expectedRange: INCIDENT_METRICS.EXPECTED_RANGE,
      });
    }

    return {
      isValid: isWithinRange && hasIncidents && hasReasonableChange,
      metrics: {
        count: newCount,
        expectedRange: INCIDENT_METRICS.EXPECTED_RANGE,
        delta: countDelta,
        history: metrics.updates,
      },
    };
  } catch (error) {
    log.error("Error validating incident metrics", error);
    return { isValid: true }; // Continue processing despite metrics error
  }
}

function processRawIncident(incident) {
  return {
    sourceId: `${SOURCE_UPPER}-${incident.incidentNumber}`,
    source: SOURCE_UPPER,
    dateOccurred: incident.utcDateOfIncident,
    title: incident.incidentTypeName,
    description: incident.otherDetails,

    // Location information
    latitude: incident.locationLatitude,
    longitude: incident.locationLongitude,
    region: "indian_ocean",
    location: {
      place: incident.place || null,
      coordinates: {
        decimal: {
          latitude: incident.locationLatitude,
          longitude: incident.locationLongitude,
        },
        dms: {
          latitude: incident.locationLatitudeDDDMMSS,
          longitude: incident.locationLongitudeDDDMMSS,
        },
      },
    },

    // Vessel information
    vessel: {
      name: incident.vesselName || null,
      type: incident.vesselType || null,
      status: incident.vesselUnderPirateControl
        ? "under_pirate_control"
        : "normal",
      captureDate: incident.dateVesselTaken,
      crewHeld: incident.crewHeld,
    },

    // Incident classification
    category: incident.incidentTypeName,
    type: "UKMTO Alert",
    severity: incident.incidentTypeLevel,

    // Status information
    status: incident.vesselUnderPirateControl ? "active_piracy" : "active",
    isAlert: !incident.hideFromTicker,
    isAdvisory: Boolean(incident.extendTickerTime),

    // Additional metadata
    reportedBy: incident.incidentIssuer || SOURCE_UPPER,
    lastUpdated: incident.utcDateCreated || incident.utcDateOfIncident,
    created_at: incident.utcDateCreated,
    modified_at: new Date().toISOString(),

    // Store complete raw incident
    raw: incident,
  };
}

// Debug helper
const debugLog = (stage, data) => {
  log.info(`DEBUG - ${stage}`, {
    stage,
    dataType: typeof data,
    isArray: Array.isArray(data),
    length: Array.isArray(data) ? data.length : null,
    sample: Array.isArray(data) ? data[0] : null,
  });
};

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");
    log.info("Environment check", {
      SOURCE_URL: SOURCE_URL,
      NODE_ENV: process.env.NODE_ENV,
      NETLIFY_DEV: process.env.NETLIFY_DEV,
    });

    verifyEnvironmentVariables(["SOURCE_URL_UKMTO"]);

    log.info(
      `Starting ${SOURCE_UPPER} incident collection (V2 - Clean Implementation)...`
    );

    // Debug - Pre-fetch
    debugLog("pre-fetch", { url: SOURCE_URL });

    // Use clean, modern fetch approach optimized for Cloudflare bypass
    log.info("Using optimized fetch approach for Cloudflare bypass");

    const response = await fetchWithRetry(SOURCE_URL, {
      method: "GET",
      headers: {
        // Core browser identification
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

        // Critical accept headers
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",

        // Security and behavior headers
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        DNT: "1",

        // Referrer and origin
        Referer: "https://www.ukmto.org/",
        Origin: "https://www.ukmto.org",

        // Additional browser simulation
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "Sec-CH-UA":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"macOS"',
      },
      // Extended timeout for Cloudflare challenges
      timeout: 45000,
      // Additional fetch options
      credentials: "omit", // Don't send credentials cross-origin
      redirect: "follow", // Follow redirects
      keepalive: false, // Don't keep connection alive
    });

    // Debug - Post-fetch
    debugLog("post-fetch", response.data);

    const rawData = response.data;
    if (!Array.isArray(rawData)) {
      throw new Error(
        `Invalid response format: expected array, got ${typeof rawData}`
      );
    }

    // Debug - Raw Data
    debugLog("raw-data", rawData);

    // Validate incident count
    const metricsValidation = await validateIncidentMetrics(rawData.length);

    // Debug - Metrics Validation
    debugLog("metrics-validation", metricsValidation);

    const validIncidents = [];
    const invalidIncidents = [];

    // Process and validate each incident
    for (const rawIncident of rawData) {
      try {
        // Debug - Process Raw Incident
        debugLog("processing-incident", rawIncident);

        const processedIncident = processRawIncident(rawIncident);

        // Debug - Processed Incident
        debugLog("processed-incident", processedIncident);

        const validation = validateIncident(processedIncident, SOURCE_UPPER);

        // Debug - Validation Result
        debugLog("validation-result", validation);

        if (validation.isValid) {
          validIncidents.push(validation.normalized);
        } else {
          log.info("Validation failed for incident", {
            incidentNumber: rawIncident.incidentNumber,
            errors: validation.errors,
          });
          invalidIncidents.push({
            incident: rawIncident,
            errors: validation.errors,
          });
        }
      } catch (error) {
        log.error("Error processing incident", error, {
          incidentNumber: rawIncident.incidentNumber,
        });
        invalidIncidents.push({
          incident: rawIncident,
          errors: [error.message],
        });
      }
    }

    // Debug - Validation Summary
    debugLog("validation-summary", {
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
    });

    if (validIncidents.length === 0) {
      log.error("No valid incidents found", {
        totalProcessed: rawData.length,
        invalidCount: invalidIncidents.length,
        sampleErrors: invalidIncidents.slice(0, 3),
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-data",
          message: "No valid incidents found.",
          invalidCount: invalidIncidents.length,
          sampleErrors: invalidIncidents.slice(0, 3),
        }),
      };
    }

    // Check for changes using hash
    const currentHash = generateHash(JSON.stringify(validIncidents));
    const cachedHash = await cacheOps.get(CACHE_KEY_HASH);

    // Debug - Hash Check
    debugLog("hash-check", {
      currentHash,
      cachedHash,
      matches: currentHash === cachedHash,
    });

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
      standardizeIncident(incident, SOURCE_UPPER, SOURCE_URL)
    );

    // Debug - Pre-Cache
    debugLog("pre-cache", {
      incidentCount: standardizedIncidents.length,
      cacheKey: CACHE_KEY_INCIDENTS,
    });

    // Store processed data
    try {
      await cacheOps.store(CACHE_KEY_INCIDENTS, {
        incidents: standardizedIncidents,
        hash: currentHash,
        timestamp: new Date().toISOString(),
        validCount: validIncidents.length,
        invalidCount: invalidIncidents.length,
        metrics: metricsValidation.metrics,
      });

      // Debug - Post-Cache Store
      debugLog("post-cache-store", { success: true });

      await cacheOps.store(CACHE_KEY_HASH, currentHash);
    } catch (cacheError) {
      log.error("Cache storage failed", cacheError);
      throw cacheError;
    }

    // Verify cache storage
    const cachedData = await cacheOps.get(CACHE_KEY_INCIDENTS);
    debugLog("cache-verification", {
      retrieved: Boolean(cachedData),
      incidentCount: cachedData?.incidents?.length,
    });

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: standardizedIncidents.length,
      validCount: validIncidents.length,
      invalidCount: invalidIncidents.length,
      metrics: metricsValidation.metrics,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `New ${SOURCE_UPPER} incidents processed (V2).`,
        count: standardizedIncidents.length,
        valid: validIncidents.length,
        invalid: invalidIncidents.length,
        metrics: metricsValidation.metrics,
        version: "v2-clean",
      }),
    };
  } catch (error) {
    log.error(`${SOURCE_UPPER} incident collection failed (V2)`, error);

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
        version: "v2-clean",
      }),
    };
  }
};

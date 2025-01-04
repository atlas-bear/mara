import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { validateIncident } from "./utils/validation.js";

const SOURCE = "recaap";
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL =
  process.env.SOURCE_URL_RECAAP ||
  "https://portal.recaap.org/OpenMap/MapSearchIncidentServlet/";
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
const CACHE_KEY_HASH = `${SOURCE}-hash`;
const CACHE_KEY_METRICS = `${SOURCE}-metrics`;
const CACHE_KEY_RUNS = "function-runs";

// Configuration constants for date handling
const DATE_CONFIG = {
  COLLECTION_WINDOW_DAYS: 30, // Base collection window
  OVERLAP_DAYS: 2, // Extra days for overlap to prevent missing incidents
  MAX_FUTURE_DAYS: 1, // Maximum days in the future to accept
  MAX_PAST_DAYS: 60, // Maximum days in the past to accept
};

// Add helper function for date handling
function generateDateRange() {
  const now = new Date();
  const windowStart = new Date();
  windowStart.setDate(
    windowStart.getDate() -
      (DATE_CONFIG.COLLECTION_WINDOW_DAYS + DATE_CONFIG.OVERLAP_DAYS)
  );

  // Format dates in "DD Month YYYY" format (ReCAAP's expected format)
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  return {
    startDate: formatDate(windowStart),
    endDate: formatDate(now),
  };
}

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

// Helper function to format coordinates in standard format
function formatLocation(incident) {
  const latDeg = parseFloat(incident.latDegree || 0).toFixed(0);
  const latMin = parseFloat(incident.latMinute || 0).toFixed(2);
  const longDeg = parseFloat(incident.longDegree || 0).toFixed(0);
  const longMin = parseFloat(incident.longMinute || 0).toFixed(2);

  return {
    formatted: `${latDeg}°${latMin}'${incident.latOption} ${longDeg}°${longMin}'${incident.longOption}`,
    decimal: {
      latitude:
        parseFloat(latDeg) +
        (parseFloat(latMin) / 60) * (incident.latOption === "S" ? -1 : 1),
      longitude:
        parseFloat(longDeg) +
        (parseFloat(longMin) / 60) * (incident.longOption === "W" ? -1 : 1),
    },
  };
}

// Helper function to extract and compare incident numbers
function getIncidentNumeric(incidentNo) {
  const match = incidentNo.match(/IC-(\d{4})-(\d+)/);
  if (!match) return 0;
  const [_, year, num] = match;
  return parseInt(year) * 1000 + parseInt(num);
}

// Function to process raw incident data
function processRawIncident(incident) {
  // Get location in both formats
  const location = formatLocation(incident);

  return {
    sourceId: `${SOURCE_UPPER}-${incident.incidentNo}`,
    source: SOURCE_UPPER,
    dateOccurred: new Date(incident.fullTimestampOfIncident).toISOString(),
    title: `${incident.incidentType || "Incident"} - ${
      incident.shipName || "Unknown Vessel"
    } (${incident.shipType || "Unknown Type"})`,
    description: incident.attackMethodDesc,
    originalSource: incident.sourceOfInformation,

    // Location information
    latitude: location.decimal.latitude,
    longitude: location.decimal.longitude,
    region: "southeast_asia",
    location: {
      place: location.formatted,
      description: incident.areaDescription,
      coordinates: {
        decimal: location.decimal,
        dms: {
          latitude: `${incident.latDegree}°${incident.latMinute}'${incident.latOption}`,
          longitude: `${incident.longDegree}°${incident.longMinute}'${incident.longOption}`,
        },
      },
    },

    // Vessel information
    vessel: {
      name: incident.shipName || null,
      type: incident.shipType || null,
      imo: incident.shipImoNumber || null,
      flag: incident.shipFlag || null,
    },

    // Incident classification
    category: incident.incidentType || "other",
    severity: incident.classification || null,

    // Status information
    status: "active",
    isAlert: false,
    isAdvisory: false,

    // Metadata
    reportedBy: "ReCAAP ISC",
    lastUpdated: new Date(incident.fullTimestampOfIncident).toISOString(),

    // Original data
    raw: incident,
  };
}

// Function to attempt data collection with timeout handling
async function attemptCollection(retryCount = 0, maxRetries = 3) {
  try {
    const { startDate, endDate } = generateDateRange();

    debugLog("collection-dates", { startDate, endDate });

    const requestBody = {
      incidentDateFrom: startDate,
      incidentDateTo: endDate,
      shipName: "",
      shipImoNumber: "",
      shipFlag: "",
      shipType: "",
      areaLocation: [],
      incidentType: "",
      reportType: "Case",
      incidentNo: "",
    };

    const headers = {
      accept: "*/*",
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      referer: "https://portal.recaap.org/OpenMap",
    };

    debugLog("collection-attempt", {
      attempt: retryCount + 1,
      maxRetries,
      requestBody,
    });

    const response = await fetchWithRetry(SOURCE_URL, {
      method: "post",
      headers,
      body: requestBody,
      maxRetries: 2,
      retryDelay: 2000,
      timeout: 8000,
    });

    return response.data;
  } catch (error) {
    if (error.message?.includes("timeout") && retryCount < maxRetries) {
      log.info(
        `Collection attempt ${retryCount + 1} timed out, retrying in ${
          (retryCount + 1) * 5
        } seconds...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, (retryCount + 1) * 5000)
      );
      return attemptCollection(retryCount + 1, maxRetries);
    }
    throw error;
  }
}

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");
    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    debugLog("pre-collection", { url: SOURCE_URL });

    const rawData = await attemptCollection();
    if (!rawData) {
      throw new Error(`No data received from ${SOURCE_UPPER} source`);
    }

    debugLog("post-collection", rawData);

    const count = Array.isArray(rawData) ? rawData.length : 0;
    log.info(`Fetched ${count} incidents from ${SOURCE_UPPER}`);

    if (count === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-data",
          message: "No incidents received from source",
        }),
      };
    }

    // Get existing incidents from cache
    const existingData = await cacheOps.get(CACHE_KEY_INCIDENTS);
    const existingIncidents = existingData?.incidents || [];
    const existingIds = new Set(existingIncidents.map((i) => i.sourceId));

    debugLog("existing-data", {
      count: existingIncidents.length,
      oldestId: existingIncidents[existingIncidents.length - 1]?.sourceId,
      newestId: existingIncidents[0]?.sourceId,
    });

    // Generate hash of raw data for change detection
    const currentHash = generateHash(JSON.stringify(rawData));
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

    // Process and validate new incidents
    const processedIncidents = [];
    const skippedIncidents = [];

    for (const incident of rawData) {
      const sourceId = `${SOURCE_UPPER}-${incident.incidentNo}`;

      // Skip if we already have this incident
      if (existingIds.has(sourceId)) {
        continue;
      }

      try {
        const processedIncident = processRawIncident(incident);
        const validation = validateIncident(processedIncident, SOURCE_UPPER);

        if (validation.errors.length > 0) {
          log.info("Validation warnings for incident", {
            sourceId,
            warnings: validation.errors,
          });
        }

        const standardized = standardizeIncident(
          validation.normalized,
          SOURCE_UPPER,
          SOURCE_URL
        );
        processedIncidents.push(standardized);
      } catch (error) {
        log.error("Error processing incident", error, { sourceId });
        skippedIncidents.push({ incident, error: error.message });
      }
    }

    debugLog("processing-results", {
      processed: processedIncidents.length,
      skipped: skippedIncidents.length,
    });

    if (processedIncidents.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-change",
          message: "No new incidents to process",
          skipped: skippedIncidents.length,
        }),
      };
    }

    // Combine and sort all incidents
    const allIncidents = [...processedIncidents, ...existingIncidents].sort(
      (a, b) => {
        const aNum = getIncidentNumeric(
          a.sourceId.replace(`${SOURCE_UPPER}-`, "")
        );
        const bNum = getIncidentNumeric(
          b.sourceId.replace(`${SOURCE_UPPER}-`, "")
        );
        return bNum - aNum; // Descending order (newest first)
      }
    );

    debugLog("pre-cache", {
      totalIncidents: allIncidents.length,
      newIncidents: processedIncidents.length,
    });

    // Store processed data
    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: allIncidents,
      hash: currentHash,
      timestamp: new Date().toISOString(),
      metadata: {
        totalCount: allIncidents.length,
        newCount: processedIncidents.length,
        skippedCount: skippedIncidents.length,
        lastProcessed: new Date().toISOString(),
      },
    });

    await cacheOps.store(CACHE_KEY_HASH, currentHash);

    debugLog("post-cache", { success: true });

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: processedIncidents.length,
      totalIncidents: allIncidents.length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `Processed ${processedIncidents.length} new incidents`,
        total: allIncidents.length,
        new: processedIncidents.length,
        skipped: skippedIncidents.length,
      }),
    };
  } catch (error) {
    log.error(`${SOURCE_UPPER} incident collection failed`, error);

    await logRun(context.functionName, "error", {
      error: error.message,
      duration: Date.now() - startTime,
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

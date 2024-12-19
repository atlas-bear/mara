import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";

const SOURCE = "recaap";
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL =
  process.env.SOURCE_URL_RECAAP ||
  "https://portal.recaap.org/OpenMap/MapSearchIncidentServlet/";
const CACHE_KEY_INCIDENTS = `${SOURCE}-incidents`;
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

// Helper function to format coordinates properly
function formatLocation(incident) {
  // Ensure numeric values are properly formatted
  const latDeg = parseFloat(incident.latDegree).toFixed(0);
  const latMin = parseFloat(incident.latMinute).toFixed(2);
  const longDeg = parseFloat(incident.longDegree).toFixed(0);
  const longMin = parseFloat(incident.longMinute).toFixed(2);

  return `${latDeg}°${latMin}'${incident.latOption} ${longDeg}°${longMin}'${incident.longOption}`;
}

// Helper function to extract and compare incident numbers
function getIncidentNumeric(incidentNo) {
  const match = incidentNo.match(/IC-(\d{4})-(\d+)/);
  if (!match) return 0;

  const [_, year, num] = match;
  // Prioritize more recent years
  return parseInt(year) * 1000 + parseInt(num);
}

// Function to attempt data collection with timeout handling
async function attemptCollection(retryCount = 0, maxRetries = 3) {
  try {
    const requestBody = {
      incidentDateFrom: "", // Empty to get all incidents
      incidentDateTo: "",
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

    const response = await fetchWithRetry(SOURCE_URL, {
      method: "post",
      headers,
      body: requestBody,
      maxRetries: 2, // Per-request retries
      retryDelay: 2000, // Start with 2 second delay
      timeout: 8000, // Keep under Netlify's limit
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

// Background processing function
async function processAndCacheData(rawData) {
  try {
    // Get existing incidents from cache
    const existingData = await cacheOps.get(CACHE_KEY_INCIDENTS);
    const existingIncidents = existingData?.incidents || [];

    // Create a Set of existing incident numbers for quick lookup
    const existingIds = new Set(existingIncidents.map((i) => i.sourceId));

    // Process new incidents
    const newIncidents = rawData
      .map((incident) => ({
        sourceId: `${SOURCE_UPPER}-${incident.incidentNo}`,
        source: SOURCE_UPPER,
        dateOccurred: new Date(incident.fullTimestampOfIncident).toISOString(),
        title: `${incident.incidentType} - ${incident.shipName} (${incident.shipType})`,
        description: incident.attackMethodDesc,
        latitude: incident.positionLatitude,
        longitude: incident.positionLongitude,
        region: incident.areaDescription,
        vesselName: incident.shipName,
        vesselType: incident.shipType,
        category: incident.classification,
        place: formatLocation(incident),
      }))
      .filter((incident) => !existingIds.has(incident.sourceId));

    if (newIncidents.length === 0) {
      log.info("No new incidents to add");
      return 0;
    }

    // Combine and sort all incidents by incident number (year and sequence)
    const allIncidents = [...existingIncidents, ...newIncidents].sort(
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

    const hash = generateHash(JSON.stringify(allIncidents));
    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: allIncidents,
      hash,
      timestamp: new Date().toISOString(),
    });

    // Log new incident numbers
    const newIncidentNumbers = newIncidents
      .map((i) => i.sourceId.replace(`${SOURCE_UPPER}-`, ""))
      .join(", ");
    log.info(
      `Added ${newIncidents.length} new incidents: ${newIncidentNumbers}`
    );

    return newIncidents.length;
  } catch (error) {
    log.error("Background processing failed", error);
    throw error;
  }
}

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");
    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    const rawData = await attemptCollection();
    if (!rawData) {
      throw new Error(`No data received from ${SOURCE_UPPER} source`);
    }

    const count = Array.isArray(rawData) ? rawData.length : 0;

    // Start background processing without awaiting it
    processAndCacheData(rawData).catch((error) => {
      log.error("Background processing error", error);
      logRun(context.functionName, "error", {
        error: error.message,
        phase: "background-processing",
        duration: Date.now() - startTime,
      });
    });

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: count,
    });

    return {
      statusCode: 202,
      body: JSON.stringify({
        status: "accepted",
        message: `Processing ${count} incidents from ${SOURCE_UPPER}`,
        count,
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

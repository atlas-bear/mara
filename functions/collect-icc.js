import { cacheOps } from "./utils/cache.js";
import { fetchWithRetry } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { validateIncident } from "./utils/validation.js";
import { referenceData } from "./utils/reference-data.js";
import { extractVesselInfo } from "./utils/vessel-utils.js";
import {
  determineIncidentType,
  determineSeverity,
} from "./utils/incident-utils.js";

const SOURCE = "icc";
const SOURCE_UPPER = SOURCE.toUpperCase();
const SOURCE_URL = process.env.SOURCE_URL_ICC;
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

    if (cached.runs.length > 100) {
      cached.runs = cached.runs.slice(0, 100);
    }

    await cacheOps.store(CACHE_KEY_RUNS, cached);
  } catch (error) {
    log.error("Error logging run", error);
  }
}

async function parseIncident(marker, refData) {
  try {
    log.info("Starting parseIncident", {
      hasRefData: !!refData,
      hasVesselTypes: !!refData?.vesselTypes,
      hasIncidentTypes: !!refData?.incidentTypes,
    });

    // Find the incident number, date, and sitrep from custom fields
    const getCustomFieldValue = (fieldId) => {
      const field = marker.custom_field_data.find((f) => f.id === fieldId);
      return field ? field.value : null;
    };

    const incidentNumber = getCustomFieldValue(9);
    const dateString = getCustomFieldValue(75);
    const sitrep = getCustomFieldValue(66);

    // Extract the UTC time and coordinates from the sitrep
    const timeMatch = sitrep.match(/(\d{2}\.\d{2}\.\d{4}):\s*(\d{4})\s*UTC/);
    const utcTime = timeMatch
      ? `${timeMatch[2].slice(0, 2)}:${timeMatch[2].slice(2)}:00`
      : "00:00:00";

    // Construct a proper ISO date string
    const dateObj = new Date(`${dateString}T${utcTime}.000Z`);

    // Format location data
    const lat = parseFloat(marker.lat);
    const lng = parseFloat(marker.lng);

    // Use reference data to determine region
    const region = await referenceData.findRegionByCoordinates(lat, lng);

    // Extract vessel information and match against reference data
    const vesselInfo = extractVesselInfo(sitrep, refData.vesselTypes);

    // Clean up the description by removing the date, time, and position
    const cleanDescription = sitrep
      .replace(/^\d{2}\.\d{2}\.\d{4}:\s*\d{4}\s*UTC:\s*Posn:.*?,\s*[^.]+\./, "")
      .trim();

    // Log before determining incident type
    log.info("About to determine incident type", {
      hasSitrep: !!sitrep,
      hasIncidentTypes: !!refData?.incidentTypes,
    });

    const incidentType = await determineIncidentType(
      sitrep,
      refData.incidentTypes
    );

    // Log after determining incident type
    log.info("Successfully determined incident type", {
      incidentType,
      incidentNumber,
    });

    const locationString = extractLocationFromSitrep(sitrep);
    console.log("Extracted location:", locationString);

    return {
      sourceId: `${SOURCE_UPPER}-${incidentNumber}`,
      source: SOURCE_UPPER,
      dateOccurred: dateObj.toISOString(),
      title: `Maritime Incident ${incidentNumber}`,
      description: cleanDescription,

      // Location information
      latitude: lat,
      longitude: lng,
      region: region?.name?.toLowerCase().replace(/\s+/g, "_") || "other",
      location: locationString || null,
      locationDetails: {
        place: locationString,
        coordinates: {
          decimal: { latitude: lat, longitude: lng },
        },
      },

      // Vessel information
      vessel: {
        name: vesselInfo.name,
        type: vesselInfo.type,
        status: vesselInfo.status,
        flag: vesselInfo.flag,
        imo: vesselInfo.imo,
      },

      // Incident classification
      type: incidentType,
      severity: determineSeverity(sitrep),

      // Metadata
      reportedBy: SOURCE_UPPER,
      lastUpdated: new Date().toISOString(),

      // Original data
      raw: marker,
    };
  } catch (error) {
    log.error("Error in parseIncident", {
      error: error.message,
      stack: error.stack,
      incidentNumber: marker?.custom_field_data?.find((f) => f.id === 9)?.value,
    });
    throw error;
  }
}

function extractLocationFromSitrep(sitrep) {
  // Try to extract location after "Posn:" and before the period
  const locationMatch = sitrep.match(/Posn:.*?,\s*([^.]+)/);
  if (locationMatch) {
    // Clean up coordinates from the location string
    return locationMatch[1]
      .replace(/\d+:\d+\.\d+[NS]\s*[-–]\s*\d+:\d+\.\d+[EW]/g, "") // Remove "01:08.6N – 103:46.2E" format
      .replace(/\d+°\d+'\w\s*[-–]\s*\d+°\d+'\w/g, "") // Remove "06°26.1'N – 003°18.9'E" format
      .trim();
  }
  return null;
}

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");
    log.info(`Starting ${SOURCE_UPPER} incident collection...`);

    verifyEnvironmentVariables([
      "BRD_HOST",
      "BRD_PORT",
      "BRD_USER",
      "BRD_PASSWORD",
      "SOURCE_URL_ICC",
      "AT_BASE_ID_GIDA",
      "AT_API_KEY",
    ]);

    // Fetch reference data first
    const refData = await referenceData.getAllReferenceData();

    // Validate reference data
    if (!refData || typeof refData !== "object") {
      throw new Error("Reference data is missing or invalid");
    }
    if (!refData.vesselTypes || !Array.isArray(refData.vesselTypes)) {
      throw new Error("Vessel types data is missing or invalid");
    }
    if (!refData.incidentTypes || !Array.isArray(refData.incidentTypes)) {
      throw new Error("Incident types data is missing or invalid");
    }
    if (!refData.maritimeRegions || !Array.isArray(refData.maritimeRegions)) {
      throw new Error("Maritime regions data is missing or invalid");
    }

    log.info("Reference data loaded", {
      vesselTypesCount: refData.vesselTypes.length,
      regionsCount: refData.maritimeRegions.length,
      incidentTypesCount: refData.incidentTypes.length,
    });

    // Fetch JSON data
    const response = await fetchWithRetry(SOURCE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.data?.markers) {
      throw new Error("Invalid response format: missing markers array");
    }

    const incidents = [];
    const errors = [];

    // Process each marker
    for (const marker of response.data.markers) {
      try {
        const processedIncident = await parseIncident(marker, refData);
        const validation = validateIncident(processedIncident, SOURCE_UPPER);

        if (validation.isValid) {
          incidents.push(validation.normalized);
        } else {
          log.info("Validation warnings for incident", {
            sourceId: processedIncident.sourceId,
            warnings: validation.errors,
          });
          errors.push({
            incident: marker,
            errors: validation.errors,
          });
        }
      } catch (error) {
        log.error("Error processing incident", error, { marker });
        errors.push({
          incident: marker,
          error: error.message,
        });
      }
    }

    if (incidents.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-data",
          message: "No valid incidents found",
          errors: errors,
        }),
      };
    }

    // Generate hash and check for changes
    const currentHash = generateHash(JSON.stringify(incidents));
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

    // Standardize incidents
    const standardizedIncidents = incidents.map((incident) =>
      standardizeIncident(incident, SOURCE_UPPER, SOURCE_URL)
    );

    // Store processed data
    await cacheOps.store(CACHE_KEY_INCIDENTS, {
      incidents: standardizedIncidents,
      hash: currentHash,
      timestamp: new Date().toISOString(),
      metadata: {
        processedCount: incidents.length,
        errorCount: errors.length,
      },
    });

    await cacheOps.store(CACHE_KEY_HASH, currentHash);

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: standardizedIncidents.length,
      errors: errors.length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: `New ${SOURCE_UPPER} incidents processed.`,
        count: standardizedIncidents.length,
        errors: errors.length,
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
        message: error.message,
      }),
    };
  }
};

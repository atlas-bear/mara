import { cacheOps } from "./utils/cache.js";
import { fetchHtmlContent } from "./utils/fetch.js";
import { log } from "./utils/logger.js";
import { generateHash } from "./utils/hash.js";
import { standardizeIncident } from "./utils/standardizer.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { validateIncident } from "./utils/validation.js";
import { load } from "cheerio";

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

// Function to extract coordinates and location from narrative text
function extractLocationInfo(text) {
  const coordRegex =
    /Posn:\s*(\d{2}):(\d{2}(?:\.\d+)?)[NS]\s*[–-]\s*(\d{2,3}):(\d{2}(?:\.\d+)?)[EW]/;
  const match = text.match(coordRegex);

  if (!match) return { coordinates: null, place: null };

  const [fullMatch, latDeg, latMin, lonDeg, lonMin] = match;

  // Convert to decimal degrees
  const latitude = parseFloat(latDeg) + parseFloat(latMin) / 60;
  const longitude = parseFloat(lonDeg) + parseFloat(lonMin) / 60;

  // Determine N/S and E/W
  const isNorth = text.includes("N");
  const isEast = text.includes("E");

  // Extract location after coordinates
  const locationMatch = text.match(new RegExp(fullMatch + ",\\s*([^.]+)"));
  const place = locationMatch ? locationMatch[1].trim() : null;

  return {
    coordinates: {
      latitude: isNorth ? latitude : -latitude,
      longitude: isEast ? longitude : -longitude,
    },
    place,
  };
}

// Function to extract date and time from narrative
function extractDateTime(narrative) {
  // Extract date and time pattern: dd.mm.yyyy: HHMM UTC
  const datetimeRegex = /(\d{2}\.\d{2}\.\d{4}):\s*(\d{4})\s*UTC/;
  const match = narrative.match(datetimeRegex);

  if (!match) return null;

  const [_, dateStr, timeStr] = match;
  const [day, month, year] = dateStr.split(".");

  // Extract hours and minutes from the time string
  const hours = timeStr.substring(0, 2);
  const minutes = timeStr.substring(2, 4);

  // Construct ISO datetime string
  return `${year}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0"
  )}T${hours}:${minutes}:00.000Z`;
}

function parseIncident(attackNumber, narrative, dateString) {
  // Extract date and time
  const incidentDate =
    extractDateTime(narrative) || new Date(dateString).toISOString();

  // Extract location information
  const { coordinates, place } = extractLocationInfo(narrative);

  return {
    sourceId: `${SOURCE_UPPER}-${attackNumber}`,
    source: SOURCE_UPPER,
    dateOccurred: new Date(incidentDate).toISOString(),
    title: `Maritime Incident ${attackNumber}`,
    description: narrative.trim(),

    // Location information
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    location: {
      place: place,
      coordinates: coordinates,
    },

    // Original data
    raw: {
      attackNumber,
      narrative,
      dateString,
    },
  };
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
    ]);

    // Fetch HTML content
    const htmlContent = await fetchHtmlContent(
      SOURCE_URL,
      {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0",
      },
      log
    );

    // Parse HTML using cheerio
    const $ = load(htmlContent);
    const incidents = [];

    // Find and process each incident row
    $("table tr").each((_, row) => {
      const columns = $(row).find("td");
      if (columns.length >= 3) {
        const attackNumber = $(columns[0]).text().trim();
        const narrative = $(columns[1]).text().trim();
        const dateString = $(columns[2]).text().trim();

        if (attackNumber && narrative && dateString) {
          try {
            const processedIncident = parseIncident(
              attackNumber,
              narrative,
              dateString
            );
            const validation = validateIncident(
              processedIncident,
              SOURCE_UPPER
            );

            if (validation.isValid) {
              incidents.push(validation.normalized);
            } else {
              log.info("Validation failed for incident", {
                attackNumber,
                errors: validation.errors,
              });
            }
          } catch (error) {
            log.error("Error processing incident", error, { attackNumber });
          }
        }
      }
    });

    if (incidents.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "no-data",
          message: "No valid incidents found.",
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
    });

    await cacheOps.store(CACHE_KEY_HASH, currentHash);

    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      itemsProcessed: standardizedIncidents.length,
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

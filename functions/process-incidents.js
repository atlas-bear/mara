import { cacheOps } from "./utils/cache.js";
import axios from "axios";
import { log } from "./utils/logger.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";

const BATCH_SIZE = 100; // Process 100 incidents at a time

/**
 * Processes a batch of incidents from the full incident array
 *
 * @param {Array<Object>} incidents - Array of all incidents to process
 * @param {number} startIndex - Starting index for this batch
 * @param {number} batchSize - Maximum number of incidents to process in this batch
 * @returns {Object} Statistics about the processed batch (counts of processed, created, updated, and error incidents)
 */
async function processIncidentBatch(incidents, startIndex, batchSize) {
  const endIndex = Math.min(startIndex + batchSize, incidents.length);
  const batch = incidents.slice(startIndex, endIndex);
  let processedCount = 0;
  let errorCount = 0;
  let updateCount = 0;
  let createCount = 0;

  for (const incident of batch) {
    try {
      const existingRecord = await checkExistingRecord(incident.sourceId);
      await createOrUpdateRecord(incident, existingRecord);
      processedCount++;
      existingRecord ? updateCount++ : createCount++;
    } catch (error) {
      errorCount++;
      log.error("Failed to process incident", {
        error: error.message,
        sourceId: incident.sourceId,
      });
    }
  }

  return { processedCount, errorCount, updateCount, createCount };
}

/**
 * Netlify function to process incident data from multiple sources
 *
 * This function:
 * 1. Collects incidents from all source caches
 * 2. Validates each incident
 * 3. Processes them in batches to avoid time-outs
 * 4. Creates or updates Airtable records for each incident
 * 5. Tracks processed incident hashes to avoid reprocessing
 *
 * @param {Request} req - The Netlify function request object
 * @param {Object} context - The Netlify function context
 * @returns {Response} Response with processing summary
 */
export default async (req, context) => {
  const startTime = Date.now();
  try {
    log.info("Process-incidents function started", {
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    // Force fresh processing by clearing last-processed-hashes
    await cacheOps.delete("last-processed-hashes");

    // Verify required environment variables
    verifyEnvironmentVariables(["AT_BASE_ID_CSER", "AT_API_KEY"]);

    // Handle POST requests (scheduled functions)
    if (req.method === "POST") {
      try {
        const body = await req.text();
        log.info("POST request body", { body });

        if (body) {
          const { next_run } = JSON.parse(body);
          log.info("Scheduled function execution details", {
            next_run,
            currentTime: new Date().toISOString(),
          });
        }
      } catch (parseError) {
        log.info("Could not parse POST body", {
          error: parseError.message,
          method: req.method,
        });
      }
    }

    const sources = ["icc", "cwd", "ukmto", "recaap", "mdat"];
    const lastProcessedKey = "last-processed-hashes";
    const lastProcessed = (await cacheOps.get(lastProcessedKey)) || {};

    log.info("Retrieved last processed hashes", {
      lastProcessed,
      sources,
    });

    let allIncidents = [];
    let updatedHashes = { ...lastProcessed };
    let hasNewData = false;
    let sourceStats = {};
    let totalStats = {
      processedCount: 0,
      errorCount: 0,
      updateCount: 0,
      createCount: 0,
    };

    // Collect all incidents from sources
    for (const source of sources) {
      try {
        const cacheKey = `${source}-incidents`;
        const cachedData = await cacheOps.get(cacheKey);

        sourceStats[source] = {
          cacheFound: !!cachedData,
          incidentCount: cachedData?.incidents?.length || 0,
          hash: cachedData?.hash,
          lastProcessedHash: lastProcessed[source],
          timestamp: cachedData?.timestamp,
        };

        if (!cachedData || !cachedData.incidents || !cachedData.hash) {
          log.info(
            `No valid cached data for source: ${source}`,
            sourceStats[source]
          );
          continue;
        }

        const { incidents, hash } = cachedData;

        if (lastProcessed[source] === hash) {
          log.info(`No new data for source: ${source}`, sourceStats[source]);
          continue;
        }

        log.info(`Processing new incidents for source: ${source}`, {
          count: incidents.length,
          oldHash: lastProcessed[source],
          newHash: hash,
        });

        // Validate incidents before processing
        const validIncidents = incidents.filter((incident) => {
          try {
            validateIncident(incident);
            return true;
          } catch (error) {
            log.error("Invalid incident detected", {
              error: error.message,
              source,
              incident: JSON.stringify(incident, null, 2),
              validationError: error.message,
              stack: error.stack,
            });
            return false;
          }
        });

        log.info(`Validation results for ${source}`, {
          total: incidents.length,
          valid: validIncidents.length,
          invalid: incidents.length - validIncidents.length,
        });

        allIncidents = allIncidents.concat(validIncidents);
        updatedHashes[source] = hash;
        hasNewData = true;
      } catch (error) {
        log.error(`Error processing source: ${source}`, error);
        continue;
      }
    }

    log.info("Source processing summary", { sourceStats });

    if (!hasNewData) {
      log.info("No new incidents to process", { sourceStats });
      return new Response("No new incidents to process", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Process incidents in batches
    for (let i = 0; i < allIncidents.length; i += BATCH_SIZE) {
      try {
        // Check for remaining time
        if (Date.now() - startTime > 8000) {
          log.info("Time limit approaching, saving progress", {
            processedSoFar: totalStats.processedCount,
            remaining: allIncidents.length - i,
          });
          break;
        }

        const batchStats = await processIncidentBatch(
          allIncidents,
          i,
          BATCH_SIZE
        );

        // Accumulate statistics
        totalStats.processedCount += batchStats.processedCount;
        totalStats.errorCount += batchStats.errorCount;
        totalStats.updateCount += batchStats.updateCount;
        totalStats.createCount += batchStats.createCount;

        log.info("Batch processed", {
          batchStart: i,
          batchSize: BATCH_SIZE,
          batchStats,
          totalProcessed: totalStats.processedCount,
        });
      } catch (error) {
        log.error("Error processing batch", {
          batchStart: i,
          error: error.message,
        });
      }
    }

    // Store updated hashes
    await cacheOps.store(lastProcessedKey, updatedHashes);

    const summary = {
      totalProcessed: totalStats.processedCount,
      created: totalStats.createCount,
      updated: totalStats.updateCount,
      errors: totalStats.errorCount,
      remainingIncidents: allIncidents.length - totalStats.processedCount,
      updatedHashes,
    };

    log.info("Processing completed", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("Critical failure in process-incidents", {
      error: error.message,
      stack: error.stack,
    });
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

/**
 * Validates that an incident has all required fields
 *
 * @param {Object} incident - The incident object to validate
 * @throws {Error} If any required fields are missing
 */
function validateIncident(incident) {
  const requiredFields = [
    "sourceId",
    "source",
    "dateOccurred",
    "title",
    "description",
  ];
  const missingFields = requiredFields.filter((field) => !incident[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }
}

/**
 * Checks if an incident with the given sourceId already exists in Airtable
 *
 * @param {string} sourceId - The unique identifier of the incident to check
 * @returns {Object|null} The existing Airtable record or null if none found
 */
async function checkExistingRecord(sourceId) {
  log.info("Checking for existing record", { sourceId });

  const response = await axios({
    method: "get",
    url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
    headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
    params: {
      filterByFormula: `{reference} = '${sourceId}'`,
      maxRecords: 1,
    },
  });

  const exists = response.data.records.length > 0;
  log.info("Existing record check result", {
    sourceId,
    exists,
    recordId: exists ? response.data.records[0].id : null,
  });

  return exists ? response.data.records[0] : null;
}

/**
 * Creates a new record or updates an existing one in Airtable
 *
 * @param {Object} incident - The incident data to save
 * @param {Object|null} existingRecord - The existing Airtable record to update (null if creating new)
 * @returns {Promise<void>}
 * @throws {Error} If the Airtable API request fails
 */
async function createOrUpdateRecord(incident, existingRecord) {
  const data = mapToAirtableFields(incident);

  try {
    if (existingRecord) {
      log.info("Updating existing record", {
        sourceId: incident.sourceId,
        recordId: existingRecord.id,
        data: JSON.stringify(data, null, 2),
      });

      const response = await axios.patch(
        `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data/${existingRecord.id}`,
        data,
        { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
      );
      log.info("Record updated successfully", {
        sourceId: incident.sourceId,
        response: response.data,
      });
    } else {
      log.info("Creating new record", {
        sourceId: incident.sourceId,
        data: JSON.stringify(data, null, 2),
      });

      const response = await axios.post(
        `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
        data,
        { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
      );
      log.info("Record created successfully", {
        sourceId: incident.sourceId,
        response: response.data,
      });
    }
  } catch (error) {
    if (error.response) {
      const errorDetails = {
        sourceId: incident.sourceId,
        status: error.response.status,
        statusText: error.response.statusText,
        errorData: error.response.data,
        sentFields: data.fields,
        responseData: error.response.data,
      };
      log.error("Airtable API error details", errorDetails);
      console.error(
        "Full error response:",
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      log.error("Non-response error", {
        error: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}

/**
 * Maps a standardized incident object to Airtable fields format
 *
 * @param {Object} incident - The standardized incident to map
 * @returns {Object} Object with fields property containing mapped Airtable fields
 */
function mapToAirtableFields(incident) {
  // Extract updates from description if present
  let description = incident.description;
  let update = incident.update;

  // Pattern to match "Update XXX:" format (e.g., "Update 001:", "Update 002:")
  const updatePattern = /Update\s+(\d{3}):\s*(.*?)(?=Update\s+\d{3}:|$)/gs;
  const matches = [...description.matchAll(updatePattern)];

  if (matches.length > 0) {
    log.info("Found update patterns in description", {
      sourceId: incident.sourceId,
      matchCount: matches.length,
    });

    // Extract all updates
    let extractedUpdates = [];

    matches.forEach((match) => {
      const updateNumber = match[1];
      const updateText = match[2].trim();
      extractedUpdates.push(`Update ${updateNumber}: ${updateText}`);

      log.info("Extracted update", {
        updateNumber,
        updateText:
          updateText.substring(0, 50) + (updateText.length > 50 ? "..." : ""),
      });
    });

    // Combine with existing update if present
    if (update) {
      update = update + "\n\n" + extractedUpdates.join("\n\n");
    } else {
      update = extractedUpdates.join("\n\n");
    }

    // Remove updates from description (optional)
    description = description.replace(updatePattern, "").trim();
  }

  const fields = {
    // Core incident fields
    title: incident.title,
    description: description,
    update: update,
    date: incident.dateOccurred || incident.date,
    reference: incident.sourceId,

    // Location data
    region: incident.region,
    location:
      typeof incident.location === "string"
        ? incident.location
        : incident.location?.place || incident.locationDetails?.place || null,
    latitude: incident.latitude,
    longitude: incident.longitude,

    // Incident classification
    incident_type_name: incident.category || incident.type,
    incident_type_level: String(incident.severity || ""),

    // Source information
    source: incident.source,
    original_source: incident.originalSource || incident.source,

    // Vessel information (safely accessed)
    vessel_name: incident.vessel?.name,
    vessel_type: incident.vessel?.type,
    vessel_flag: incident.vessel?.flag,
    vessel_imo: incident.vessel?.imo,
    vessel_status: incident.vessel?.status,

    // Raw data
    raw_json: JSON.stringify(incident),
  };

  // Clean undefined/null values
  Object.keys(fields).forEach((key) => {
    if (fields[key] === undefined || fields[key] === null) {
      delete fields[key];
    }
  });

  return { fields };
}

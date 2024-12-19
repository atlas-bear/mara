import { cacheOps } from "./utils/cache.js";
import axios from "axios";
import { log } from "./utils/logger.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";

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
      const { next_run } = await req.json();
      log.info("Scheduled function execution details", {
        next_run,
        currentTime: new Date().toISOString(),
      });
    }

    const sources = ["cwd", "ukmto", "recaap"];
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
        log.error(`Error processing source: ${source}`, {
          error: error.message,
          stack: error.stack,
        });
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

    // Process and store the incidents in Airtable
    let processedCount = 0;
    let errorCount = 0;
    let updateCount = 0;
    let createCount = 0;

    for (const incident of allIncidents) {
      try {
        // Add timeout check
        if (Date.now() - startTime > 8000) {
          // Leave 2s buffer
          log.info("Approaching timeout limit, stopping processing", {
            processedCount,
            remainingCount: allIncidents.length - processedCount,
          });
          break;
        }

        const existingRecord = await checkExistingRecord(incident.sourceId);
        await createOrUpdateRecord(incident, existingRecord);
        processedCount++;
        existingRecord ? updateCount++ : createCount++;
      } catch (error) {
        errorCount++;
        log.error("Failed to process incident", {
          error: error.message,
          sourceId: incident.sourceId,
          stack: error.stack,
        });
      }
    }

    // Store updated hashes only after successful processing
    await cacheOps.store(lastProcessedKey, updatedHashes);

    const summary = {
      totalProcessed: processedCount,
      created: createCount,
      updated: updateCount,
      errors: errorCount,
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

// Helper functions
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

function mapToAirtableFields(incident) {
  return {
    fields: {
      title: incident.title,
      description: incident.description,
      date: incident.dateOccurred || incident.date,
      reference: incident.sourceId,
      region: incident.region,
      incident_type_name: incident.type || incident.title.split(" - ")[0],
      latitude: incident.latitude,
      longitude: incident.longitude,
      source: incident.source,
      location: `${incident.latitude}, ${incident.longitude}`,
      update: incident.updates
        ? incident.updates.map((u) => u.text).join("\n\n")
        : null,
      aggressor: incident.aggressors || null,
      original_source: incident.originalSource || null,
      raw_json: JSON.stringify(incident),
    },
  };
}

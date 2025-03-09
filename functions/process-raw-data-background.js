// process-raw-data-background.js
import axios from "axios";
import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { callClaudeWithPrompt } from "./utils/llm-service.js";

const CACHE_KEY_LAST_PROCESSED = "last-processed-raw-data";
const CACHE_KEY_RUNS = "function-runs";

export const handler = async (event, context) => {
  console.log("process-raw-data-background function triggered", {
    time: new Date().toISOString(),
    functionName: context.functionName,
  });

  // Return immediately with a success response
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Processing started in background",
      functionName: context.functionName,
    }),
  };

  // Launch background processing
  processNextRecord(event, context).catch((error) => {
    log.error("Background processing error:", error);
  });

  return response;
};

// Main background processing function
async function processNextRecord(event, context) {
  const startTime = Date.now();

  try {
    try {
      await logRun(context.functionName, "started");
    } catch (logError) {
      log.error("Failed to log run start, continuing", logError);
    }

    log.info("Process raw data function started in background");

    try {
      // Verify environment variables
      verifyEnvironmentVariables([
        "AT_BASE_ID_CSER",
        "AT_API_KEY",
        "ANTHROPIC_API_KEY",
      ]);
    } catch (envError) {
      log.error("Environment variable verification failed", envError);
      return; // Stop processing if environment variables are missing
    }

    // Process a specific record if ID is provided
    const specificRecordId = event.queryStringParameters?.recordId;

    // Fetch the next record to process
    let record;
    try {
      record = specificRecordId
        ? await fetchSpecificRecord(specificRecordId)
        : await fetchNextRecordToProcess();
    } catch (fetchError) {
      log.error("Failed to fetch record to process", fetchError);
      return; // Stop if we can't fetch records
    }

    if (!record) {
      log.info("No records to process");
      try {
        await logRun(context.functionName, "success", {
          duration: Date.now() - startTime,
          status: "no-records",
        });
      } catch (logError) {
        log.error(
          "Failed to log completion, but no records to process",
          logError
        );
      }
      return;
    }

    log.info(`Processing record: ${record.id}`, {
      title: record.fields?.title,
      source: record.fields?.source,
    });

    // Update record status to "processing"
    try {
      await updateRecordStatus(record.id, "processing");
    } catch (updateError) {
      log.error(
        "Failed to update record status to processing, continuing",
        updateError
      );
    }

    try {
      // Process the record
      const result = await processRecord(record);

      // Update record status to "complete"
      await updateRecordStatus(record.id, "complete", {
        has_incident: true,
        linked_incident: [result.incidentId],
        processing_notes: `Successfully processed at ${new Date().toISOString()}`,
      });

      log.info(`Successfully processed record ${record.id}`, {
        incidentId: result.incidentId,
        vesselId: result.vesselId,
      });
    } catch (error) {
      log.error(`Error processing record ${record.id}`, error);

      // Update record status to "error"
      try {
        await updateRecordStatus(record.id, "error", {
          processing_notes: `Error: ${error.message}`,
        });
      } catch (updateError) {
        log.error("Failed to update record status after error", updateError);
      }
    }

    try {
      await logRun(context.functionName, "success", {
        duration: Date.now() - startTime,
        recordId: record.id,
      });
    } catch (logError) {
      log.error("Failed to log completion, but processing completed", logError);
    }

    // Check if there are more records to process
    let moreRecords = false;
    try {
      moreRecords = await checkMoreRecordsExist();
    } catch (checkError) {
      log.error("Failed to check for more records", checkError);
    }

    if (moreRecords) {
      log.info("More records exist, triggering next processing job");

      // Trigger another processing run via API call
      try {
        const siteUrl = process.env.URL || "https://mara-v2.netlify.app";
        await axios.post(
          `${siteUrl}/.netlify/functions/process-raw-data-background`
        );
      } catch (triggerError) {
        log.error("Failed to trigger next processing job", triggerError);
      }
    }
  } catch (error) {
    log.error("Process raw data function failed", error);

    try {
      await logRun(context.functionName, "error", {
        error: error.message,
        duration: Date.now() - startTime,
      });
    } catch (logError) {
      log.error("Failed to log error", logError);
    }
  }
}

// Fetch a specific record by ID
async function fetchSpecificRecord(recordId) {
  try {
    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data/${recordId}`,
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
    });

    return response.data;
  } catch (error) {
    log.error(`Error fetching specific record ${recordId}`, error);
    throw error;
  }
}

// Fetch the next unprocessed record
async function fetchNextRecordToProcess() {
  try {
    // Find records that don't have an incident and aren't being processed
    const filterFormula = `AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))`;

    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      params: {
        filterByFormula: filterFormula,
        sort: [{ field: "created_at", direction: "asc" }],
        maxRecords: 1,
      },
    });

    return response.data.records.length > 0 ? response.data.records[0] : null;
  } catch (error) {
    log.error("Error fetching next record to process", error);
    throw error;
  }
}

// Check if more records exist to process
async function checkMoreRecordsExist() {
  try {
    const filterFormula = `AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))`;

    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      params: {
        filterByFormula: filterFormula,
        maxRecords: 1,
      },
    });

    return response.data.records.length > 0;
  } catch (error) {
    log.error("Error checking for more records", error);
    return false;
  }
}

// Update record status in Airtable
async function updateRecordStatus(recordId, status, additionalFields = {}) {
  try {
    const updateData = {
      fields: {
        processing_status: status,
        last_processed: new Date().toISOString(),
        ...additionalFields,
      },
    };

    await axios.patch(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data/${recordId}`,
      updateData,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );

    log.info(`Updated record ${recordId} status to ${status}`);
  } catch (error) {
    log.error(`Error updating record ${recordId} status`, error);
    throw error;
  }
}

// Process a single record
async function processRecord(record) {
  // Extract raw incident data
  const incidentData = parseRawJson(record.fields.raw_json);

  // Process through LLM to enrich data
  const enrichedData = await enrichDataWithLLM(incidentData, record.fields);

  // Create incident record with enriched data
  const incidentId = await createIncidentRecord(record, enrichedData);

  // Create vessel record if vessel data exists
  let vesselId = null;
  if (record.fields.vessel_name) {
    vesselId = await createVesselRecord(record.fields);
  }

  // Create incident_vessel linking record if both records exist
  if (incidentId && vesselId) {
    await createIncidentVesselRecord(incidentId, vesselId, record.fields);
  }

  return {
    incidentId,
    vesselId,
  };
}

// Helper function to log function runs with error handling
async function logRun(functionName, status, details = {}) {
  try {
    let cached;
    try {
      cached = await cacheOps.get(CACHE_KEY_RUNS);
    } catch (cacheError) {
      log.error("Cache retrieval failed, continuing without cache", cacheError);
      cached = { runs: [] };
    }

    if (!cached) cached = { runs: [] };

    cached.runs.unshift({
      function: functionName,
      status,
      timestamp: new Date().toISOString(),
      ...details,
    });

    if (cached.runs.length > 100) {
      cached.runs = cached.runs.slice(0, 100);
    }

    try {
      await cacheOps.store(CACHE_KEY_RUNS, cached);
    } catch (storageError) {
      log.error("Failed to store cache, continuing processing", storageError);
    }
  } catch (error) {
    log.error("Error in logRun, continuing processing", error);
    // Continue processing despite logging errors
  }
}

// Safely parse raw JSON field
function parseRawJson(rawJsonString) {
  try {
    return typeof rawJsonString === "string"
      ? JSON.parse(rawJsonString)
      : rawJsonString || {};
  } catch (error) {
    log.error("Error parsing raw JSON", error);
    return {};
  }
}

// Process data through Claude
async function enrichDataWithLLM(incidentData, recordFields) {
  try {
    log.info("Enriching incident data with LLM");

    // Use the LLM service
    return await callClaudeWithPrompt("incidentAnalysis", {
      incidentData,
      recordFields,
    });
  } catch (error) {
    log.error("Error enriching data with LLM", error);
    // Return minimal object so process can continue even if LLM fails
    return {
      analysis: null,
      recommendations: null,
      weapons_used: [],
      number_of_attackers: null,
      items_stolen: [],
      response_type: [],
      authorities_notified: [],
    };
  }
}

// Create incident record in Airtable
async function createIncidentRecord(record, enrichedData) {
  const recordFields = record.fields;

  // Prepare data for the incident record
  const incidentData = {
    fields: {
      title: recordFields.title,
      date_time_utc: recordFields.date,
      latitude: recordFields.latitude,
      longitude: recordFields.longitude,
      location_name: recordFields.location,
      incident_type_name: recordFields.incident_type_name,
      description: recordFields.description,

      // Enriched fields from LLM
      analysis: enrichedData.analysis,
      recommendations: enrichedData.recommendations,
      weapons_used: enrichedData.weapons_used,
      number_of_attackers: enrichedData.number_of_attackers,
      items_stolen: enrichedData.items_stolen,
      response_type: enrichedData.response_type,
      authorities_notified: enrichedData.authorities_notified,

      // Other standard fields
      status: "active",
      region: recordFields.region,

      // Reference to source record
      raw_data_source: [record.id],
    },
  };

  // Create the record in Airtable
  try {
    const response = await axios.post(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`,
      incidentData,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );

    log.info(`Created incident record: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    log.error("Error creating incident record", error);
    throw error;
  }
}

// Create vessel record in Airtable
async function createVesselRecord(recordFields) {
  // Check if vessel exists by name and IMO
  const vesselId = await checkExistingVessel(
    recordFields.vessel_name,
    recordFields.vessel_imo
  );
  if (vesselId) {
    return vesselId;
  }

  // Create new vessel record
  const vesselData = {
    fields: {
      name: recordFields.vessel_name,
      type: recordFields.vessel_type,
      flag: recordFields.vessel_flag,
      imo: recordFields.vessel_imo,
    },
  };

  try {
    const response = await axios.post(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel`,
      vesselData,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );

    log.info(`Created vessel record: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    log.error("Error creating vessel record", error);
    throw error;
  }
}

// Check if vessel already exists
async function checkExistingVessel(name, imo) {
  if (!name) return null;

  let filterFormula = `UPPER({name}) = '${name.toUpperCase()}'`;

  if (imo) {
    filterFormula = `OR(${filterFormula}, {imo} = '${imo}')`;
  }

  try {
    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel`,
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      params: {
        filterByFormula: filterFormula,
        maxRecords: 1,
      },
    });

    return response.data.records.length > 0
      ? response.data.records[0].id
      : null;
  } catch (error) {
    log.error("Error checking existing vessel", error);
    return null;
  }
}

// Create incident_vessel linking record
async function createIncidentVesselRecord(incidentId, vesselId, recordFields) {
  const incidentVesselData = {
    fields: {
      incident_id: [incidentId],
      vessel_id: [vesselId],
      vessel_status_during_incident: "normal", // Default value, could be extracted from data
      vessel_role: "target", // Default value, could be extracted from data
    },
  };

  try {
    const response = await axios.post(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel`,
      incidentVesselData,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );

    log.info(`Created incident_vessel record: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    log.error("Error creating incident_vessel record", error);
    throw error;
  }
}

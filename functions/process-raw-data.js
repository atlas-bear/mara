import axios from "axios";
import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";
import { verifyEnvironmentVariables } from "./utils/environment.js";
import { callClaudeWithPrompt } from "./utils/llm-service.js";

const CACHE_KEY_LAST_PROCESSED = "last-processed-raw-data";
const CACHE_KEY_RUNS = "function-runs";

export const handler = async (event, context) => {
  const startTime = Date.now();

  try {
    await logRun(context.functionName, "started");
    log.info("Process raw data function started");

    // Verify environment variables
    verifyEnvironmentVariables([
      "AT_BASE_ID_CSER",
      "AT_API_KEY",
      "ANTHROPIC_API_KEY",
    ]);

    // Get the last processed record ID or timestamp
    const lastProcessed = (await cacheOps.get(CACHE_KEY_LAST_PROCESSED)) || {
      lastTimestamp: null,
    };

    // Fetch new raw_data records
    const rawRecords = await fetchNewRawDataRecords(
      lastProcessed.lastTimestamp
    );

    if (rawRecords.length === 0) {
      log.info("No new raw data records to process");
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "success",
          message: "No new records to process",
        }),
      };
    }

    log.info(`Found ${rawRecords.length} new raw data records to process`);

    // Process each record
    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    let newestTimestamp = lastProcessed.lastTimestamp;

    for (const record of rawRecords) {
      try {
        // Skip if already has an incident
        if (record.fields.has_incident) {
          log.info(`Skipping record ${record.id} - already has incident`);
          results.skipped++;
          continue;
        }

        // Extract raw incident data
        const incidentData = parseRawJson(record.fields.raw_json);

        // Process through LLM to enrich data
        const enrichedData = await enrichDataWithLLM(
          incidentData,
          record.fields
        );

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

        // Mark the raw data record as processed
        await updateRawDataRecord(record.id, incidentId);

        results.processed++;
        results.details.push({
          recordId: record.id,
          status: "success",
          incidentId,
          vesselId,
        });

        // Track newest timestamp for continuation
        const recordTimestamp = record.fields.created_at || record.createdTime;
        if (!newestTimestamp || recordTimestamp > newestTimestamp) {
          newestTimestamp = recordTimestamp;
        }
      } catch (error) {
        log.error(`Error processing record ${record.id}`, error);
        results.errors++;
        results.details.push({
          recordId: record.id,
          status: "error",
          error: error.message,
        });
      }
    }

    // Update the last processed timestamp
    await cacheOps.store(CACHE_KEY_LAST_PROCESSED, {
      lastTimestamp: newestTimestamp,
    });

    // Log run completion
    await logRun(context.functionName, "success", {
      duration: Date.now() - startTime,
      processed: results.processed,
      errors: results.errors,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        ...results,
      }),
    };
  } catch (error) {
    log.error("Process raw data function failed", error);

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

// Helper function to log function runs
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

// Fetch new raw data records from Airtable
async function fetchNewRawDataRecords(lastTimestamp) {
  try {
    let filterFormula = "";

    if (lastTimestamp) {
      // Filter for records created after the last processed timestamp
      filterFormula = `CREATED_TIME() > '${lastTimestamp}'`;
    } else {
      // Filter for records that don't have an incident yet
      filterFormula = `AND(NOT({has_incident}), NOT({processing_status} = 'error'))`;
    }

    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      params: {
        filterByFormula: filterFormula,
        sort: [{ field: "created_at", direction: "asc" }],
        maxRecords: 10, // Process in small batches to avoid timeouts
      },
    });

    return response.data.records;
  } catch (error) {
    log.error("Error fetching raw data records", error);
    throw error;
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

    // Use the LLM service utility to call Claude with the prompt
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

// Update raw data record to mark as processed
async function updateRawDataRecord(recordId, incidentId) {
  const updateData = {
    fields: {
      has_incident: true,
      processing_status: "complete",
      linked_incident: [incidentId],
    },
  };

  try {
    await axios.patch(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data/${recordId}`,
      updateData,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );

    log.info(`Updated raw data record ${recordId}`);
  } catch (error) {
    log.error(`Error updating raw data record ${recordId}`, error);
    throw error;
  }
}

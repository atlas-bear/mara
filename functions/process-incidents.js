import { cacheOps } from "./utils/cache.js";
import axios from "axios";
import { log } from "./utils/logger.js";

export default async (req, context) => {
  try {
    log.info("Function invoked. Request method:", { method: req.method });

    // Handle POST requests (scheduled functions)
    if (req.method === "POST") {
      const { next_run } = await req.json();
      log.info("Scheduled function executed.", { next_run });
      return new Response("Scheduled function executed successfully", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Handle GET requests (manual testing or function invocation)
    const sources = ["cwd", "ukmto", "recaap"];
    const lastProcessedKey = "last-processed-hashes";
    const lastProcessed = (await cacheOps.get(lastProcessedKey)) || {};
    let allIncidents = [];
    let updatedHashes = { ...lastProcessed };
    let hasNewData = false;

    for (const source of sources) {
      try {
        const cacheKey = `${source}-incidents`;
        const cachedData = await cacheOps.get(cacheKey);

        log.info("Retrieved cache data", { source, cacheKey });

        if (!cachedData || !cachedData.incidents || !cachedData.hash) {
          log.info("No valid cached data found", { source });
          continue;
        }

        const { incidents, hash } = cachedData;

        // Compare hash strings
        if (lastProcessed[source] === hash) {
          log.info("No new data detected", { source });
          continue;
        }

        log.info("Processing new incidents", {
          source,
          count: incidents.length,
        });

        // Validate incidents before processing
        const validIncidents = incidents.filter((incident) => {
          try {
            validateIncident(incident);
            return true;
          } catch (error) {
            log.error("Invalid incident detected", error, { source, incident });
            return false;
          }
        });

        allIncidents = allIncidents.concat(validIncidents);
        updatedHashes[source] = hash;
        hasNewData = true;
      } catch (error) {
        log.error("Error processing source", error, { source });
        // Continue with other sources even if one fails
        continue;
      }
    }

    if (!hasNewData) {
      log.info("No new incidents to process");
      return new Response("No new incidents to process", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Process and store the incidents in Airtable
    for (const incident of allIncidents) {
      try {
        const existingRecord = await checkExistingRecord(incident.sourceId);
        await createOrUpdateRecord(incident, existingRecord);
      } catch (error) {
        log.error("Failed to process incident", error, {
          sourceId: incident.sourceId,
        });
        // Continue processing other incidents even if one fails
      }
    }

    // Store updated hashes only after successful processing
    await cacheOps.store(lastProcessedKey, updatedHashes);
    log.info("Successfully processed incidents", {
      count: allIncidents.length,
    });

    return new Response("Incidents processed successfully", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    log.error("Failed to process incidents", error);
    return new Response("Error during processing", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
};

// Helper functions for validation, Airtable integration, and mapping
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
  const response = await axios({
    method: "get",
    url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
    headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
    params: { filterByFormula: `{reference} = '${sourceId}'`, maxRecords: 1 },
  });

  return response.data.records.length > 0 ? response.data.records[0] : null;
}

async function createOrUpdateRecord(incident, existingRecord) {
  const data = mapToAirtableFields(incident);

  if (existingRecord) {
    await axios.patch(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data/${existingRecord.id}`,
      data,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    log.info("Updated record in Airtable", { sourceId: incident.sourceId });
  } else {
    await axios.post(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
      data,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    log.info("Created new record in Airtable", { sourceId: incident.sourceId });
  }
}

function mapToAirtableFields(incident) {
  return {
    fields: {
      title: incident.title,
      description: incident.description,
      date: incident.dateOccurred,
      reference: incident.sourceId,
      region: incident.region,
      category: incident.type,
      latitude: incident.latitude,
      longitude: incident.longitude,
      source_url: incident.sourceUrl,
      aggressors: incident.aggressors,
      original_source: incident.originalSource,
      updates: incident.updates
        ? incident.updates.map((u) => u.text).join("\n\n")
        : null,
    },
  };
}

import { cacheOps } from "./utils/cache.js";
import axios from "axios";
import { log } from "./utils/logger.js";

export default async (req, context) => {
  try {
    console.log("Function invoked. Request method:", req.method);

    // Handle POST requests (scheduled functions)
    if (req.method === "POST") {
      const { next_run } = await req.json(); // Scheduled functions send a JSON payload
      console.log("Scheduled function executed. Next run at:", next_run);

      return new Response("Scheduled function executed successfully", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Handle GET requests (manual testing or function invocation)
    const sources = ["cwd", "ukmto"];
    const lastProcessedKey = "last-processed-hashes";
    const lastProcessed = (await cacheOps.get(lastProcessedKey)) || {};
    let allIncidents = [];
    let updatedHashes = { ...lastProcessed };

    for (const source of sources) {
      const cacheKey = `${source}-incidents`;
      const cachedData = await cacheOps.get(cacheKey);

      console.log("Cache data for key:", cacheKey, cachedData);

      if (!cachedData) {
        console.log(`No incidents found in cache for source: ${source}`);
        continue;
      }

      const { incidents, hash } = cachedData;

      if (lastProcessed[source] === hash) {
        console.log(`No new data for source: ${source}`);
        continue;
      }

      allIncidents = allIncidents.concat(incidents);
      updatedHashes[source] = hash;
    }

    if (allIncidents.length === 0) {
      console.log("No new incidents to process.");
      return new Response("No new incidents to process", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.log("Incidents processed successfully.");
    return new Response("Incidents processed successfully", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Failed to process incidents:", error);
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
    console.log("Updated record in Airtable", { sourceId: incident.sourceId });
  } else {
    await axios.post(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`,
      data,
      { headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` } }
    );
    console.log("Created new record in Airtable", {
      sourceId: incident.sourceId,
    });
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
      category: incident.category,
      latitude: incident.latitude,
      longitude: incident.longitude,
    },
  };
}

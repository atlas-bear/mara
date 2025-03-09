import axios from "axios";

export default async (req, context) => {
  console.log("Background function triggered", {
    time: new Date().toISOString(),
  });

  try {
    console.log("Background processing started");

    // Check environment variables
    console.log("Environment check:", {
      hasAirtableKey: !!process.env.AT_API_KEY,
      hasAirtableBaseId: !!process.env.AT_BASE_ID_CSER,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    });

    const headers = {
      Authorization: `Bearer ${process.env.AT_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Get next unprocessed record
    const rawDataUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;
    const unprocessedResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        filterByFormula:
          "AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))",
        maxRecords: 1,
      },
    });

    if (unprocessedResponse.data.records.length === 0) {
      console.log("No unprocessed records found");
      return;
    }

    const recordToProcess = unprocessedResponse.data.records[0];
    console.log("Found record to process:", {
      id: recordToProcess.id,
      title: recordToProcess.fields.title,
    });

    // Update the record to mark it as processing
    await axios.patch(
      `${rawDataUrl}/${recordToProcess.id}`,
      {
        fields: {
          processing_status: "processing",
          processing_notes: `Started processing at ${new Date().toISOString()}`,
        },
      },
      { headers }
    );

    console.log("Updated record status to processing");

    // First, try to get incident schema by fetching a sample record
    const incidentUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`;
    let incidentFields = {};

    try {
      const sampleIncident = await axios.get(incidentUrl, {
        headers,
        params: { maxRecords: 1 },
      });

      if (sampleIncident.data.records.length > 0) {
        console.log("Found sample incident for schema reference");
        const sampleFields = Object.keys(sampleIncident.data.records[0].fields);
        console.log("Sample incident fields:", sampleFields);
      }
    } catch (schemaError) {
      console.log("Could not get sample incident schema:", schemaError.message);
    }

    // Create incident record with the appropriate structure
    incidentFields = {
      title: recordToProcess.fields.title || "Untitled Incident",
      description:
        recordToProcess.fields.description || "No description available",
      date_time_utc: recordToProcess.fields.date || new Date().toISOString(),
      latitude: recordToProcess.fields.latitude,
      longitude: recordToProcess.fields.longitude,
      location_name: recordToProcess.fields.location,
      incident_type_name:
        recordToProcess.fields.incident_type_name || "Unknown",
      status: "active",
      region: recordToProcess.fields.region || "unknown",
      analysis: "Test analysis from background function",
      recommendations: "• Test recommendation",

      // Corrected field name: raw_data instead of raw_data_source
      raw_data: [recordToProcess.id],
    };

    console.log("Creating incident with fields:", incidentFields);

    // Create the incident record
    const incidentResponse = await axios.post(
      incidentUrl,
      { fields: incidentFields },
      { headers }
    );

    console.log("Created incident record:", {
      incidentId: incidentResponse.data.id,
    });

    // Mark the raw data record as processed
    await axios.patch(
      `${rawDataUrl}/${recordToProcess.id}`,
      {
        fields: {
          has_incident: true,
          processing_status: "complete",
          processing_notes: `Successfully processed at ${new Date().toISOString()}`,
          linked_incident: [incidentResponse.data.id],
        },
      },
      { headers }
    );

    console.log("Marked record as processed with linked incident");
    console.log("Background processing completed successfully");
  } catch (error) {
    console.error("Background processing error:", error.message);

    // Log more detailed error information
    if (error.response) {
      console.error(
        "Error response data:",
        JSON.stringify(error.response.data, null, 2)
      );
      console.error("Error response status:", error.response.status);
    }
  }
};

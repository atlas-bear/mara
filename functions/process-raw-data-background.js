import axios from "axios";

export default async (req, context) => {
  console.log("Background function triggered with export default format", {
    time: new Date().toISOString(),
    functionName: context.functionName,
  });

  try {
    console.log("Background processing started");

    console.log("Environment check:", {
      hasAirtableKey: !!process.env.AT_API_KEY,
      hasAirtableBaseId: !!process.env.AT_BASE_ID_CSER,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    });

    // First, get the table schema to understand required fields
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;
    const headers = { Authorization: `Bearer ${process.env.AT_API_KEY}` };

    // Get a sample record to understand the structure
    const response = await axios({
      method: "get",
      url: airtableUrl,
      headers,
      params: { maxRecords: 1 },
    });

    console.log("Airtable connection successful", {
      recordCount: response.data.records.length,
      firstRecordId: response.data.records[0]?.id,
      sampleFields: Object.keys(response.data.records[0]?.fields || {}),
    });

    // Try to fetch and process the next available record that needs processing
    const unprocessedResponse = await axios({
      method: "get",
      url: airtableUrl,
      headers,
      params: {
        filterByFormula: "NOT({has_incident})",
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
    const updateResponse = await axios.patch(
      `${airtableUrl}/${recordToProcess.id}`,
      {
        fields: {
          processing_status: "processing",
          processing_notes: `Started processing at ${new Date().toISOString()}`,
        },
      },
      { headers }
    );

    console.log("Updated record status to processing");

    // Create a simple incident record
    const incidentResponse = await axios.post(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`,
      {
        fields: {
          title: recordToProcess.fields.title || "Untitled Incident",
          description:
            recordToProcess.fields.description || "No description available",
          date_time_utc:
            recordToProcess.fields.date || new Date().toISOString(),
          latitude: recordToProcess.fields.latitude,
          longitude: recordToProcess.fields.longitude,
          location_name: recordToProcess.fields.location,
          incident_type_name:
            recordToProcess.fields.incident_type_name || "Unknown",
          status: "active",
          region: recordToProcess.fields.region || "unknown",
          analysis: "Test analysis from background function",
          recommendations: "• Test recommendation",
        },
      },
      { headers }
    );

    console.log("Created incident record:", {
      incidentId: incidentResponse.data.id,
    });

    // Mark the raw data record as processed
    await axios.patch(
      `${airtableUrl}/${recordToProcess.id}`,
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
      console.error(
        "Error response headers:",
        JSON.stringify(error.response.headers, null, 2)
      );
    } else if (error.request) {
      console.error("Error request:", JSON.stringify(error.request, null, 2));
    }

    console.error("Error details:", JSON.stringify(error, null, 2));
  }
};

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
      region: recordToProcess.fields.region,
    });

    // Update the record to mark it as processing
    await axios.patch(
      `${rawDataUrl}/${recordToProcess.id}`,
      {
        fields: {
          processing_status: "Processing",
          processing_notes: `Started processing at ${new Date().toISOString()}`,
        },
      },
      { headers }
    );

    console.log("Updated record status to processing");

    // Function to properly capitalize all words in a string
    const toTitleCase = (str) => {
      if (!str) return "";
      return str
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    };

    // Function to format region name properly (from snake_case if needed)
    const formatRegion = (region) => {
      if (!region) return "Unknown";

      // First, split by underscores if they exist
      const words = region.includes("_")
        ? region.split("_")
        : region.split(" ");

      // Then capitalize each word
      return words
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    };

    // First, try to find the incident type in the incident_type table
    let incidentTypeId = null;
    if (recordToProcess.fields.incident_type_name) {
      const incidentTypeName = toTitleCase(
        recordToProcess.fields.incident_type_name
      );
      console.log(`Looking up incident type: "${incidentTypeName}"`);

      try {
        const incidentTypeUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_type`;
        const typeResponse = await axios.get(incidentTypeUrl, {
          headers,
          params: {
            filterByFormula: `{name} = '${incidentTypeName}'`,
            maxRecords: 1,
          },
        });

        if (typeResponse.data.records.length > 0) {
          incidentTypeId = typeResponse.data.records[0].id;
          console.log(`Found incident type ID: ${incidentTypeId}`);
        } else {
          console.log(
            `No matching incident type found for: ${incidentTypeName}`
          );
        }
      } catch (typeError) {
        console.error("Error looking up incident type:", typeError.message);
      }
    }

    // Create a basic incident record with minimal fields
    const incidentFields = {
      title: recordToProcess.fields.title || "Untitled Incident",
      description:
        recordToProcess.fields.description || "No description available",
      date_time_utc: recordToProcess.fields.date || new Date().toISOString(),
      latitude: recordToProcess.fields.latitude,
      longitude: recordToProcess.fields.longitude,
      status: "Active", // Correct case
      region: formatRegion(recordToProcess.fields.region), // Proper capitalization
      analysis: "Test analysis from background function",
      recommendations: "• Test recommendation",
    };

    // Add incident_type_name reference only if we found a matching ID
    if (incidentTypeId) {
      // The field is named incident_type_name, but as a link field it needs array of IDs
      incidentFields.incident_type_name = [incidentTypeId];
    }

    // Add location_name only if it exists
    if (recordToProcess.fields.location) {
      incidentFields.location_name = recordToProcess.fields.location;
    }

    console.log("Creating incident with fields:", incidentFields);

    // Create the incident record
    const incidentUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`;
    const incidentResponse = await axios.post(
      incidentUrl,
      { fields: incidentFields },
      { headers }
    );

    console.log("Created incident record:", {
      incidentId: incidentResponse.data.id,
    });

    // Mark the raw data record as processed - with correct case for status
    await axios.patch(
      `${rawDataUrl}/${recordToProcess.id}`,
      {
        fields: {
          has_incident: true,
          processing_status: "Complete", // Correct case
          processing_notes: `Successfully processed at ${new Date().toISOString()}`,
        },
      },
      { headers }
    );

    console.log("Marked record as processed");
    console.log("Background processing completed successfully");

    // Check if more records exist to process
    const moreRecords = await checkMoreRecordsExist(rawDataUrl, headers);

    if (moreRecords) {
      console.log("More records exist, triggering next processing job");

      // Trigger another processing run via API call
      try {
        const siteUrl = process.env.URL || "https://mara-v2.netlify.app";
        await axios.post(
          `${siteUrl}/.netlify/functions/process-raw-data-background`
        );
      } catch (triggerError) {
        console.error(
          "Failed to trigger next processing job",
          triggerError.message
        );
      }
    }
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

// Helper function to check if more records exist to process
async function checkMoreRecordsExist(rawDataUrl, headers) {
  try {
    const response = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        filterByFormula:
          "AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))",
        maxRecords: 1,
      },
    });

    return response.data.records.length > 0;
  } catch (error) {
    console.error("Error checking for more records", error.message);
    return false;
  }
}

import axios from "axios";

export default async (req, context) => {
  console.log("Background function triggered with export default format", {
    time: new Date().toISOString(),
    functionName: context.functionName,
  });

  // No need to return anything - client always gets 202

  try {
    console.log("Background processing started");

    // Log environment variables
    console.log("Environment check:", {
      hasAirtableKey: !!process.env.AT_API_KEY,
      hasAirtableBaseId: !!process.env.AT_BASE_ID_CSER,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    });

    // Try a simple Airtable connection
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;
    const response = await axios({
      method: "get",
      url: airtableUrl,
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      params: { maxRecords: 1 },
    });

    console.log("Airtable connection successful", {
      recordCount: response.data.records.length,
      firstRecordId: response.data.records[0]?.id,
    });

    // Try creating a test record
    const logData = {
      fields: {
        title: `Test from background function`,
        description: `Created at ${new Date().toISOString()}`,
        processing_status: "test",
      },
    };

    const createResponse = await axios.post(airtableUrl, logData, {
      headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
    });

    console.log("Created test record in Airtable", {
      recordId: createResponse.data.id,
    });

    console.log("Background processing completed");
  } catch (error) {
    console.error("Background processing error:", error.message);
    console.error("Error details:", JSON.stringify(error, null, 2));
  }
};

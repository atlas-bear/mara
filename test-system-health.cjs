const axios = require("axios");
require("dotenv").config();

async function testSystemHealth() {
  console.log("=== MARA System Health Check ===");
  console.log("Time:", new Date().toISOString());

  // Check environment variables
  console.log("\n1. Environment Variables:");
  console.log("  AT_API_KEY:", process.env.AT_API_KEY ? "✓ Set" : "✗ Missing");
  console.log(
    "  AT_BASE_ID_CSER:",
    process.env.AT_BASE_ID_CSER ? "✓ Set" : "✗ Missing"
  );
  console.log("  PUBLIC_URL:", process.env.PUBLIC_URL || "Not set");

  if (!process.env.AT_API_KEY || !process.env.AT_BASE_ID_CSER) {
    console.log("\n❌ Missing required environment variables");
    return;
  }

  const headers = {
    Authorization: `Bearer ${process.env.AT_API_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // Check raw_data table for unprocessed records
    console.log("\n2. Raw Data Status:");
    const rawDataUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;

    const unprocessedResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        view: "Process",
        filterByFormula: `NOT({has_incident})`,
        maxRecords: 5,
      },
    });

    console.log(
      `  Unprocessed records: ${unprocessedResponse.data.records.length}`
    );

    if (unprocessedResponse.data.records.length > 0) {
      console.log("  Sample unprocessed records:");
      unprocessedResponse.data.records.forEach((record, i) => {
        console.log(
          `    ${i + 1}. ${record.fields.title || "No title"} (${record.fields.source || "Unknown source"})`
        );
        console.log(
          `       Status: ${record.fields.processing_status || "None"}`
        );
        console.log(
          `       Has incident: ${record.fields.has_incident || false}`
        );
        console.log(
          `       Last processed: ${record.fields.last_processed || "Never"}`
        );
      });
    }

    // Check for stuck processing records
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const stuckResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        filterByFormula: `AND({processing_status} = 'Processing', IS_BEFORE({last_processed}, '${thirtyMinutesAgo.toISOString()}'))`,
        maxRecords: 5,
      },
    });

    console.log(
      `  Stuck processing records: ${stuckResponse.data.records.length}`
    );

    // Check recent incidents
    console.log("\n3. Recent Incidents:");
    const incidentUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`;
    const recentIncidents = await axios({
      method: "get",
      url: incidentUrl,
      headers,
      params: {
        sort: [{ field: "date_time_utc", direction: "desc" }],
        maxRecords: 3,
      },
    });

    console.log(
      `  Total recent incidents: ${recentIncidents.data.records.length}`
    );
    recentIncidents.data.records.forEach((incident, i) => {
      console.log(`    ${i + 1}. ${incident.fields.title || "No title"}`);
      console.log(`       Date: ${incident.fields.date_time_utc || "No date"}`);
      console.log(`       Region: ${incident.fields.region || "No region"}`);
    });

    console.log("\n✅ System health check completed");
  } catch (error) {
    console.log("\n❌ System health check failed:", error.message);
    if (error.response) {
      console.log("Response status:", error.response.status);
      console.log(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
  }
}

testSystemHealth().catch(console.error);

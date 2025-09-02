/**
 * Direct testing of weekly incidents data without cache dependencies
 * This script can be run via GitHub or deployed to test the data flow
 */

import axios from "axios";

/**
 * Test the get-weekly-incidents function directly via URL
 */
async function testWeeklyIncidentsData() {
  console.log("=== WEEKLY INCIDENTS DATA TEST ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  // Test the problematic reporting period
  const testPeriods = [
    {
      name: "Current Week (Aug 26 - Sep 2, 2025)",
      start: "2025-08-26T21:00:00.000Z",
      end: "2025-09-02T21:00:00.000Z",
    },
    {
      name: "Previous Week (Aug 19 - Aug 26, 2025)",
      start: "2025-08-19T21:00:00.000Z",
      end: "2025-08-26T21:00:00.000Z",
    },
  ];

  // Base URL - will use production URL when deployed
  const baseUrl =
    process.env.PUBLIC_URL ||
    process.env.SITE_URL ||
    "https://mara-v2.netlify.app";

  for (const period of testPeriods) {
    console.log(`\n--- Testing ${period.name} ---`);

    try {
      // Call get-weekly-incidents function directly
      const url = `${baseUrl}/.netlify/functions/get-weekly-incidents?start=${encodeURIComponent(period.start)}&end=${encodeURIComponent(period.end)}`;
      console.log(`Calling: ${url}`);

      const response = await axios.get(url);

      if (response.data) {
        const { incidents, latestIncidents } = response.data;

        console.log("✅ SUCCESS - Data retrieved");
        console.log(
          `Total incidents in period: ${incidents ? incidents.length : 0}`
        );
        console.log(
          `Latest incidents by region: ${latestIncidents ? Object.keys(latestIncidents).length : 0}`
        );

        // Check for the specific duplicate incident
        if (incidents) {
          const duplicateCheck = incidents.filter(
            (inc) =>
              inc.incident &&
              inc.incident.fields &&
              inc.incident.fields.id === "20250828-1853-60N"
          );
          console.log(
            `Incident 20250828-1853-60N found ${duplicateCheck.length} times in incidents array`
          );

          // Check incidents by region
          const regionCounts = {};
          incidents.forEach((inc) => {
            if (
              inc.incident &&
              inc.incident.fields &&
              inc.incident.fields.region
            ) {
              const region = inc.incident.fields.region;
              regionCounts[region] = (regionCounts[region] || 0) + 1;
            }
          });
          console.log("Incidents by region:", regionCounts);
        }

        // Check latest incidents for the duplicate
        if (latestIncidents) {
          console.log("\n--- Latest Incidents by Region ---");
          Object.entries(latestIncidents).forEach(([region, incidentData]) => {
            if (incidentData && incidentData.incident) {
              const incidentId = incidentData.incident.fields.id;
              console.log(`${region}: ${incidentId}`);

              if (incidentId === "20250828-1853-60N") {
                console.log(
                  `🚨 FOUND: Incident 20250828-1853-60N is the latest incident for ${region}`
                );
              }
            }
          });
        }

        // Check for overlap between incidents and latestIncidents
        if (incidents && latestIncidents) {
          console.log("\n--- Checking for Overlap ---");
          const incidentIds = new Set(
            incidents
              .filter(
                (inc) =>
                  inc.incident && inc.incident.fields && inc.incident.fields.id
              )
              .map((inc) => inc.incident.fields.id)
          );

          const latestIncidentIds = new Set(
            Object.values(latestIncidents)
              .filter(
                (data) =>
                  data &&
                  data.incident &&
                  data.incident.fields &&
                  data.incident.fields.id
              )
              .map((data) => data.incident.fields.id)
          );

          const overlappingIds = [...incidentIds].filter((id) =>
            latestIncidentIds.has(id)
          );

          console.log(
            `Incidents that appear in both arrays: ${overlappingIds.length}`
          );
          if (overlappingIds.length > 0) {
            console.log("Overlapping incident IDs:", overlappingIds);

            if (overlappingIds.includes("20250828-1853-60N")) {
              console.log(
                "🎯 CONFIRMED: Incident 20250828-1853-60N appears in BOTH arrays!"
              );
              console.log("This explains the duplicate in the weekly report.");
            }
          }
        }
      } else {
        console.log("❌ No data received");
      }
    } catch (error) {
      console.error(`❌ Error testing ${period.name}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    }
  }

  console.log("\n=== TEST COMPLETE ===");
  console.log(
    "Summary of findings will help identify the duplicate issue source."
  );
}

// Export for use in other scripts
export { testWeeklyIncidentsData };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWeeklyIncidentsData().catch(console.error);
}

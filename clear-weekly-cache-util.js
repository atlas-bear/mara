/**
 * Utility to clear weekly report cache via deployed function
 * This can be run via URL to clear problematic cache entries
 */

import axios from "axios";

/**
 * Clear weekly report cache for specific date ranges
 */
async function clearWeeklyReportCache() {
  console.log("=== WEEKLY REPORT CACHE CLEARING UTILITY ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  // Base URL - will use production URL when deployed
  const baseUrl =
    process.env.PUBLIC_URL ||
    process.env.SITE_URL ||
    "https://mara-v2.netlify.app";

  // Periods to clear cache for
  const periodsToClear = [
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
    {
      name: "Next Week (Sep 2 - Sep 9, 2025)",
      start: "2025-09-02T21:00:00.000Z",
      end: "2025-09-09T21:00:00.000Z",
    },
  ];

  console.log("\n=== CLEARING WEEKLY REPORT CACHES ===");

  for (const period of periodsToClear) {
    console.log(`\n--- Clearing Cache for ${period.name} ---`);

    try {
      // Call the refresh-weekly-report function which should clear and regenerate cache
      const refreshUrl = `${baseUrl}/.netlify/functions/refresh-weekly-report`;

      console.log(`Calling refresh function: ${refreshUrl}`);

      const response = await axios.post(refreshUrl, {
        start: period.start,
        end: period.end,
        clearCache: true, // Request cache clearing
      });

      if (response.data) {
        console.log("✅ Cache refresh response:", response.data);
      } else {
        console.log("✅ Cache refresh completed (no response data)");
      }
    } catch (error) {
      console.error(`❌ Error clearing cache for ${period.name}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      // If refresh function doesn't exist, try direct cache clearing
      console.log("Attempting alternative cache clearing method...");

      try {
        // Try calling clear-cache function if it exists
        const clearUrl = `${baseUrl}/.netlify/functions/clear-cache`;
        const clearResponse = await axios.post(clearUrl, {
          cacheType: "weekly-report",
          start: period.start,
          end: period.end,
        });

        console.log(
          "✅ Alternative cache clear successful:",
          clearResponse.data
        );
      } catch (altError) {
        console.error(
          "❌ Alternative cache clearing also failed:",
          altError.message
        );
      }
    }
  }

  console.log("\n=== CACHE CLEARING COMPLETE ===");
  console.log(
    "Next step: Test weekly report generation to see if duplicates are resolved"
  );
}

/**
 * Test fresh weekly report generation after cache clearing
 */
async function testFreshWeeklyReport() {
  console.log("\n=== TESTING FRESH WEEKLY REPORT GENERATION ===");

  const baseUrl =
    process.env.PUBLIC_URL ||
    process.env.SITE_URL ||
    "https://mara-v2.netlify.app";

  const testPeriod = {
    start: "2025-08-26T21:00:00.000Z",
    end: "2025-09-02T21:00:00.000Z",
  };

  try {
    // Force fresh generation by calling get-weekly-report-content
    const reportUrl = `${baseUrl}/.netlify/functions/get-weekly-report-content?start=${encodeURIComponent(testPeriod.start)}&end=${encodeURIComponent(testPeriod.end)}`;

    console.log(`Generating fresh weekly report: ${reportUrl}`);

    const response = await axios.get(reportUrl);

    if (response.data) {
      console.log("✅ Fresh weekly report generated successfully");

      // Check for West Africa duplicates in key developments
      if (response.data.keyDevelopments) {
        const westAfricaDevelopments = response.data.keyDevelopments.filter(
          (dev) => dev.region === "West Africa"
        );
        console.log(
          `West Africa key developments: ${westAfricaDevelopments.length}`
        );

        westAfricaDevelopments.forEach((dev, index) => {
          console.log(
            `  ${index + 1}. [${dev.level}] ${dev.content.substring(0, 100)}...`
          );
        });

        if (westAfricaDevelopments.length > 1) {
          console.log(
            "⚠️ WARNING: Still seeing multiple West Africa developments"
          );
        } else {
          console.log("✅ West Africa duplicates appear to be resolved");
        }
      }

      // Check regions in forecast
      if (response.data.forecast) {
        const forecastRegions = response.data.forecast.map((f) => f.region);
        console.log("Regions in forecast:", forecastRegions);

        const expectedRegions = [
          "West Africa",
          "Southeast Asia",
          "Indian Ocean",
          "Europe",
          "Americas",
        ];
        const missingRegions = expectedRegions.filter(
          (r) => !forecastRegions.includes(r)
        );

        if (missingRegions.length > 0) {
          console.log(
            "⚠️ WARNING: Missing regions in forecast:",
            missingRegions
          );
        } else {
          console.log("✅ All expected regions present in forecast");
        }
      }

      // Check for cache source
      const cacheSource = response.headers["x-cache-source"];
      if (cacheSource) {
        console.log(`Cache source: ${cacheSource}`);
      }
    } else {
      console.log("❌ No data received from fresh report generation");
    }
  } catch (error) {
    console.error("❌ Error generating fresh weekly report:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
    });
  }
}

// Export functions
export { clearWeeklyReportCache, testFreshWeeklyReport };

// Run both functions if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await clearWeeklyReportCache();
    await testFreshWeeklyReport();
  })().catch(console.error);
}

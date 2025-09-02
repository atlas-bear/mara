/**
 * Weekly Report Cache Diagnostic Script
 * Safely investigates cache issues without triggering emails
 */

import { weeklyReportCache } from "./functions/utils/weekly-report-cache.js";
import { log } from "./functions/utils/logger.js";

/**
 * Main diagnostic function
 */
async function diagnoseWeeklyReportCache() {
  console.log("=== WEEKLY REPORT CACHE DIAGNOSTIC ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  try {
    // Test different reporting periods around the problematic time
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
      {
        name: "Next Week (Sep 2 - Sep 9, 2025)",
        start: "2025-09-02T21:00:00.000Z",
        end: "2025-09-09T21:00:00.000Z",
      },
    ];

    console.log("\n=== CHECKING CACHE ENTRIES ===");

    for (const period of testPeriods) {
      console.log(`\n--- ${period.name} ---`);

      // Generate cache key for this period
      const cacheKey = weeklyReportCache.getKey(period.start, period.end);
      console.log(`Cache Key: ${cacheKey}`);

      try {
        // Check if cache exists
        const cachedContent = await weeklyReportCache.get(cacheKey);

        if (cachedContent) {
          console.log("✅ CACHE FOUND");
          console.log(`Cache Structure:`, Object.keys(cachedContent));

          // Check Key Developments
          if (cachedContent.keyDevelopments) {
            console.log(
              `Key Developments Count: ${cachedContent.keyDevelopments.length}`
            );

            // Look for West Africa entries
            const westAfricaDevelopments = cachedContent.keyDevelopments.filter(
              (dev) => dev.region === "West Africa"
            );
            console.log(
              `West Africa Key Developments: ${westAfricaDevelopments.length}`
            );

            westAfricaDevelopments.forEach((dev, index) => {
              console.log(
                `  ${index + 1}. [${dev.level}] ${dev.content.substring(0, 100)}...`
              );
            });
          }

          // Check 7-Day Forecast
          if (cachedContent.forecast) {
            console.log(
              `Forecast Entries Count: ${cachedContent.forecast.length}`
            );

            const regions = cachedContent.forecast.map((f) => f.region);
            console.log(`Regions in Forecast: ${regions.join(", ")}`);

            // Check for West Africa specifically
            const westAfricaForecast = cachedContent.forecast.find(
              (f) => f.region === "West Africa"
            );
            if (westAfricaForecast) {
              console.log(
                `West Africa Forecast: ${westAfricaForecast.content.substring(0, 150)}...`
              );
            }
          }

          // Look for duplicate incident mentions in content
          const contentString = JSON.stringify(cachedContent);
          const incidentMatches = contentString.match(/20250828-1853-60N/g);
          if (incidentMatches) {
            console.log(
              `🚨 INCIDENT 20250828-1853-60N mentioned ${incidentMatches.length} times in cache`
            );
          }
        } else {
          console.log("❌ NO CACHE FOUND");
        }
      } catch (error) {
        console.error(
          `Error checking cache for ${period.name}:`,
          error.message
        );
      }
    }

    console.log("\n=== CACHE DIAGNOSTIC SUMMARY ===");
    console.log("Next steps based on findings:");
    console.log("1. If problematic cache found -> Clear it");
    console.log("2. If no cache found -> Check underlying data");
    console.log(
      "3. If duplicate incident mentions found -> This confirms cache corruption"
    );
  } catch (error) {
    console.error("Diagnostic error:", error);
  }
}

/**
 * Function to clear specific cache entries
 */
async function clearProblematicCache(start, end) {
  console.log(`\n=== CLEARING CACHE FOR ${start} to ${end} ===`);

  try {
    const cacheKey = weeklyReportCache.getKey(start, end);
    console.log(`Clearing cache key: ${cacheKey}`);

    await weeklyReportCache.delete(cacheKey);
    console.log("✅ Cache cleared successfully");

    // Verify it's gone
    const verifyCache = await weeklyReportCache.get(cacheKey);
    if (verifyCache) {
      console.log("⚠️ Warning: Cache still exists after deletion");
    } else {
      console.log("✅ Verified: Cache successfully removed");
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}

// Export functions for use
export { diagnoseWeeklyReportCache, clearProblematicCache };

// Run diagnostic if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnoseWeeklyReportCache();
}

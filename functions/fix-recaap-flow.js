import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";
import forceProcessIncidents from "./force-process-incidents.js";

/**
 * Netlify function to fix RECAAP processing flow
 * This function can be triggered via URL to reset RECAAP hash and force processing
 */
export default async (req, context) => {
  const startTime = Date.now();

  try {
    log.info("Fix RECAAP Flow function started", {
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    const results = {
      step1_hashReset: null,
      step2_forceProcess: null,
      step3_verification: null,
      summary: {},
    };

    // Step 1: Reset RECAAP hash to force reprocessing
    log.info("Step 1: Resetting RECAAP hash tracking");

    try {
      const processedHashes = await cacheOps.get("last-processed-hashes");

      if (processedHashes && processedHashes.recaap) {
        const oldRecaapHash = processedHashes.recaap;
        delete processedHashes.recaap;
        processedHashes.timestamp = new Date().toISOString();

        await cacheOps.store("last-processed-hashes", processedHashes);

        results.step1_hashReset = {
          success: true,
          message: `RECAAP hash removed (was: ${String(oldRecaapHash).substring(0, 12)}...)`,
          oldHash: String(oldRecaapHash).substring(0, 12) + "...",
        };

        log.info("RECAAP hash reset successful", results.step1_hashReset);
      } else {
        results.step1_hashReset = {
          success: true,
          message:
            "No RECAAP hash found to reset (will process all cached incidents)",
          oldHash: null,
        };

        log.info("No RECAAP hash to reset");
      }
    } catch (error) {
      results.step1_hashReset = {
        success: false,
        error: error.message,
      };
      log.error("Hash reset failed", error);
    }

    // Step 2: Force process incidents
    log.info("Step 2: Force processing incidents");

    try {
      const mockReq = {
        method: "POST",
        json: async () => ({ triggered_by: "fix-recaap-flow" }),
      };
      const mockContext = { functionName: "fix-recaap-flow-force-process" };

      const processResult = await forceProcessIncidents(mockReq, mockContext);
      const processText = await processResult.text();

      try {
        const processData = JSON.parse(processText);
        results.step2_forceProcess = {
          success: processResult.status === 200,
          status: processResult.status,
          data: processData,
        };
      } catch (parseError) {
        results.step2_forceProcess = {
          success: processResult.status === 200,
          status: processResult.status,
          rawResponse: processText,
        };
      }

      log.info("Force process completed", results.step2_forceProcess);
    } catch (error) {
      results.step2_forceProcess = {
        success: false,
        error: error.message,
      };
      log.error("Force process failed", error);
    }

    // Step 3: Verify cache state
    log.info("Step 3: Verifying cache state");

    try {
      const recaapIncidents = await cacheOps.get("recaap-incidents");
      const recaapHash = await cacheOps.get("recaap-hash");
      const updatedProcessedHashes = await cacheOps.get(
        "last-processed-hashes"
      );

      results.step3_verification = {
        success: true,
        cacheState: {
          incidentCount: recaapIncidents?.incidents?.length || 0,
          currentHash: recaapHash
            ? String(recaapHash).substring(0, 12) + "..."
            : "None",
          lastProcessedHash: updatedProcessedHashes?.recaap
            ? String(updatedProcessedHashes.recaap).substring(0, 12) + "..."
            : "None",
          cacheTimestamp: recaapIncidents?.timestamp || "Unknown",
        },
      };

      log.info("Cache verification completed", results.step3_verification);
    } catch (error) {
      results.step3_verification = {
        success: false,
        error: error.message,
      };
      log.error("Cache verification failed", error);
    }

    // Generate summary
    const allStepsSuccessful =
      results.step1_hashReset?.success &&
      results.step2_forceProcess?.success &&
      results.step3_verification?.success;

    results.summary = {
      overallSuccess: allStepsSuccessful,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      nextSteps: allStepsSuccessful
        ? [
            "Check your Airtable raw_data table for new RECAAP records",
            "Monitor the system with scheduled functions",
            "The normal process-incidents should now work for future incidents",
          ]
        : [
            "Review the error details above",
            "Check environment variables and cache connectivity",
            "Try running the function again",
          ],
    };

    // Add processing statistics if available
    if (
      results.step2_forceProcess?.success &&
      results.step2_forceProcess?.data
    ) {
      const processData = results.step2_forceProcess.data;
      results.summary.processingStats = {
        incidentsFound: processData.incidentsFound || 0,
        created: processData.created || 0,
        updated: processData.updated || 0,
        errors: processData.errors || 0,
      };
    }

    log.info("Fix RECAAP Flow completed", results.summary);

    return new Response(
      JSON.stringify(
        {
          status: allStepsSuccessful ? "success" : "partial_success",
          message: allStepsSuccessful
            ? "RECAAP flow fix completed successfully"
            : "RECAAP flow fix completed with some issues",
          results,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    log.error("Critical failure in fix-recaap-flow", {
      error: error.message,
      stack: error.stack,
    });

    return new Response(
      JSON.stringify(
        {
          status: "error",
          message: "Critical failure during RECAAP flow fix",
          error: error.message,
          duration: Date.now() - startTime,
        },
        null,
        2
      ),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};

import { cacheOps } from "./utils/cache.js";
import { log } from "./utils/logger.js";

const CACHE_KEY_RUNS = "function-runs";

// Helper to store run information
async function logRun(functionName, status, details = {}) {
  try {
    // Get existing run logs
    const cached = (await cacheOps.get(CACHE_KEY_RUNS)) || { runs: [] };

    // Add new run info
    cached.runs.unshift({
      function: functionName,
      status,
      timestamp: new Date().toISOString(),
      ...details,
    });

    // Keep only last 100 runs
    if (cached.runs.length > 100) {
      cached.runs = cached.runs.slice(0, 100);
    }

    await cacheOps.store(CACHE_KEY_RUNS, cached);
  } catch (error) {
    log.error("Error logging run", error);
  }
}

export const handler = async (event, context) => {
  try {
    const hours = parseInt(event.queryStringParameters?.hours || "24");

    // Get run logs
    const cached = await cacheOps.get(CACHE_KEY_RUNS);
    if (!cached || !cached.runs) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          status: "error",
          message: "No run logs found",
        }),
      };
    }

    // Filter runs by time window
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const recentRuns = cached.runs.filter(
      (run) => new Date(run.timestamp) > cutoff
    );

    // Group runs by function
    const grouped = recentRuns.reduce((acc, run) => {
      if (!acc[run.function]) {
        acc[run.function] = [];
      }
      acc[run.function].push(run);
      return acc;
    }, {});

    // Calculate statistics
    const stats = Object.entries(grouped).map(([func, runs]) => {
      const successful = runs.filter((r) => r.status === "success").length;
      const failed = runs.filter((r) => r.status === "error").length;
      const avgDuration =
        runs.filter((r) => r.duration).reduce((sum, r) => sum + r.duration, 0) /
          runs.length || 0;

      return {
        function: func,
        totalRuns: runs.length,
        successful,
        failed,
        averageDuration: Math.round(avgDuration),
        lastRun: runs[0].timestamp,
        recentErrors: runs
          .filter((r) => r.status === "error")
          .slice(0, 5)
          .map((r) => r.error),
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          status: "success",
          timeWindow: `${hours} hours`,
          stats,
          scheduledTimes: {
            "collect-recaap": "00 and 30 minutes",
            "collect-ukmto": "05 and 35 minutes",
            "collect-cwd": "10 and 40 minutes",
            "process-incidents": "15 and 45 minutes",
          },
        },
        null,
        2
      ),
    };
  } catch (error) {
    log.error("Error getting run statistics", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message,
      }),
    };
  }
};

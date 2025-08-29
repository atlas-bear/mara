#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import { cacheOps } from "./functions/utils/cache.js";

const SOURCES = ["icc", "cwd", "ukmto", "recaap", "mdat"];

// Helper function to calculate time ago
function timeAgo(timestamp) {
  if (!timestamp) return "Never";

  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Helper function to get health status
function getHealthStatus(data, source) {
  if (!data) return { status: "❌", level: "ERROR", message: "No cache data" };

  const age = new Date() - new Date(data.timestamp);
  const hoursOld = age / (1000 * 60 * 60);

  // Different sources have different expected update frequencies
  const maxHours = source === "cwd" ? 48 : 24; // CWD updates less frequently

  if (hoursOld > maxHours) {
    return {
      status: "⚠️",
      level: "WARNING",
      message: `Data is ${Math.floor(hoursOld)}h old`,
    };
  }

  if (data.incidents?.length === 0) {
    return {
      status: "⚠️",
      level: "WARNING",
      message: "No incidents in cache",
    };
  }

  return {
    status: "✅",
    level: "HEALTHY",
    message: "Operating normally",
  };
}

// Helper function to analyze function runs
function analyzeFunctionRuns(runs, functionName) {
  if (!runs || runs.length === 0) {
    return { status: "❓", message: "No run history", lastRun: null };
  }

  const relevantRuns = runs.filter(
    (run) => run.function && run.function.includes(functionName)
  );

  if (relevantRuns.length === 0) {
    return { status: "❓", message: "No runs found", lastRun: null };
  }

  const lastRun = relevantRuns[0];
  const recentRuns = relevantRuns.slice(0, 5);
  const successRate =
    recentRuns.filter((r) => r.status === "success").length / recentRuns.length;

  let status = "✅";
  let message = "Running well";

  if (lastRun.status === "error") {
    status = "❌";
    message = `Last run failed: ${lastRun.error || "Unknown error"}`;
  } else if (successRate < 0.8) {
    status = "⚠️";
    message = `${Math.round(successRate * 100)}% success rate`;
  }

  return { status, message, lastRun };
}

async function generateSystemHealthDashboard() {
  console.log("🏥 MARA System Health Dashboard");
  console.log("=".repeat(60));
  console.log(`📅 Generated: ${new Date().toLocaleString()}`);
  console.log("");

  try {
    // Get function runs for analysis
    const functionRuns = await cacheOps.get("function-runs");
    const runs = functionRuns?.runs || [];

    // Get last processed hashes
    const lastProcessed = await cacheOps.get("last-processed-hashes");

    console.log("📊 COLLECTOR STATUS OVERVIEW");
    console.log("-".repeat(60));

    let overallHealth = "HEALTHY";
    const sourceDetails = [];

    for (const source of SOURCES) {
      const cacheKey = `${source}-incidents`;
      const hashKey = `${source}-hash`;

      // Get cache data
      const cachedData = await cacheOps.get(cacheKey);
      const currentHash = await cacheOps.get(hashKey);
      const lastProcessedHash = lastProcessed?.[source];

      // Analyze health
      const health = getHealthStatus(cachedData, source);
      const functionAnalysis = analyzeFunctionRuns(runs, source);

      // Track overall health
      if (health.level === "ERROR") overallHealth = "CRITICAL";
      else if (health.level === "WARNING" && overallHealth === "HEALTHY")
        overallHealth = "WARNING";

      const details = {
        source: source.toUpperCase(),
        health,
        functionAnalysis,
        incidentCount: cachedData?.incidents?.length || 0,
        lastUpdate: cachedData?.timestamp,
        currentHash: currentHash
          ? String(currentHash).substring(0, 8) + "..."
          : "None",
        lastProcessedHash: lastProcessedHash
          ? String(lastProcessedHash).substring(0, 8) + "..."
          : "None",
        hashMatch: currentHash === lastProcessedHash,
        metadata: cachedData?.metadata,
      };

      sourceDetails.push(details);

      // Display source status
      console.log(
        `${health.status} ${details.source.padEnd(8)} | ${functionAnalysis.status} Function | 📦 ${String(details.incidentCount).padStart(3)} incidents | ⏰ ${timeAgo(details.lastUpdate).padEnd(8)} | ${health.message}`
      );
    }

    console.log("");
    console.log("🔄 PROCESSING STATUS");
    console.log("-".repeat(60));

    // Analyze process-incidents function
    const processAnalysis = analyzeFunctionRuns(runs, "process-incidents");
    console.log(
      `${processAnalysis.status} Process-Incidents Function: ${processAnalysis.message}`
    );

    if (processAnalysis.lastRun) {
      console.log(
        `   Last run: ${timeAgo(processAnalysis.lastRun.timestamp)} (${processAnalysis.lastRun.status})`
      );
      if (processAnalysis.lastRun.totalProcessed) {
        console.log(
          `   Processed: ${processAnalysis.lastRun.totalProcessed} incidents`
        );
      }
    }

    console.log("");
    console.log("🔑 HASH TRACKING STATUS");
    console.log("-".repeat(60));

    if (!lastProcessed) {
      console.log(
        "❌ No hash tracking found - incidents may not be processing"
      );
    } else {
      console.log("✅ Hash tracking active");
      let unprocessedCount = 0;

      for (const details of sourceDetails) {
        const status = details.hashMatch ? "✅ Synced" : "⚠️ Pending";
        console.log(
          `   ${details.source}: ${status} (Current: ${details.currentHash}, Processed: ${details.lastProcessedHash})`
        );
        if (!details.hashMatch) unprocessedCount++;
      }

      if (unprocessedCount > 0) {
        console.log(
          `\n⚠️  ${unprocessedCount} source(s) have unprocessed data`
        );
      }
    }

    console.log("");
    console.log("📈 DETAILED METRICS");
    console.log("-".repeat(60));

    for (const details of sourceDetails) {
      console.log(`\n📋 ${details.source}:`);
      console.log(
        `   Health: ${details.health.status} ${details.health.message}`
      );
      console.log(`   Incidents: ${details.incidentCount}`);
      console.log(
        `   Last Update: ${details.lastUpdate ? new Date(details.lastUpdate).toLocaleString() : "Never"}`
      );
      console.log(
        `   Function Status: ${details.functionAnalysis.status} ${details.functionAnalysis.message}`
      );

      if (details.metadata) {
        if (details.metadata.validCount !== undefined) {
          console.log(
            `   Valid/Invalid: ${details.metadata.validCount}/${details.metadata.invalidCount || 0}`
          );
        }
        if (details.metadata.newCount !== undefined) {
          console.log(
            `   New/Total: ${details.metadata.newCount}/${details.metadata.totalCount}`
          );
        }
      }
    }

    console.log("");
    console.log("🎯 SYSTEM HEALTH SUMMARY");
    console.log("-".repeat(60));

    const healthEmoji = {
      HEALTHY: "✅",
      WARNING: "⚠️",
      CRITICAL: "❌",
    };

    console.log(
      `${healthEmoji[overallHealth]} Overall System Health: ${overallHealth}`
    );

    const totalIncidents = sourceDetails.reduce(
      (sum, d) => sum + d.incidentCount,
      0
    );
    console.log(`📊 Total Incidents Cached: ${totalIncidents}`);

    const activeCollectors = sourceDetails.filter(
      (d) => d.health.level !== "ERROR"
    ).length;
    console.log(`🔄 Active Collectors: ${activeCollectors}/${SOURCES.length}`);

    const recentRuns = runs.filter((r) => {
      const runTime = new Date(r.timestamp);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return runTime > hourAgo;
    }).length;
    console.log(`⚡ Function Runs (Last Hour): ${recentRuns}`);

    console.log("");
    console.log("💡 RECOMMENDATIONS");
    console.log("-".repeat(60));

    const recommendations = [];

    if (overallHealth === "CRITICAL") {
      recommendations.push(
        "🚨 Critical issues detected - immediate attention required"
      );
    }

    if (!lastProcessed) {
      recommendations.push(
        "🔧 Hash tracking missing - run process-incidents to initialize"
      );
    }

    const unprocessedSources = sourceDetails.filter(
      (d) => !d.hashMatch && d.incidentCount > 0
    );
    if (unprocessedSources.length > 0) {
      recommendations.push(
        `📤 ${unprocessedSources.length} source(s) have unprocessed incidents`
      );
    }

    const staleSources = sourceDetails.filter(
      (d) => d.health.level === "WARNING"
    );
    if (staleSources.length > 0) {
      recommendations.push(
        `⏰ ${staleSources.length} source(s) have stale data - check collectors`
      );
    }

    const errorSources = sourceDetails.filter(
      (d) => d.health.level === "ERROR"
    );
    if (errorSources.length > 0) {
      recommendations.push(
        `❌ ${errorSources.length} source(s) have no data - check connectivity`
      );
    }

    if (recommendations.length === 0) {
      console.log("✅ System is operating normally - no action required");
    } else {
      recommendations.forEach((rec) => console.log(`   ${rec}`));
    }

    console.log("");
    console.log("🔧 DIAGNOSTIC COMMANDS");
    console.log("-".repeat(60));
    console.log("   📊 Full cache analysis: node cache-inspector.js");
    console.log("   🌐 Test connectivity: node source-connectivity-test.js");
    console.log("   📋 Data quality check: node data-quality-report.js");
    console.log("");
  } catch (error) {
    console.error("❌ Error generating dashboard:", error.message);
    console.error("   Make sure environment variables are set correctly");
  }
}

// Run the dashboard
generateSystemHealthDashboard();

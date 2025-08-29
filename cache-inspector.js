#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import { cacheOps } from "./functions/utils/cache.js";

const SOURCES = ["icc", "cwd", "ukmto", "recaap", "mdat"];

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper function to analyze incident data structure
function analyzeIncidentStructure(incidents) {
  if (!incidents || incidents.length === 0) {
    return { fields: [], samples: [], issues: ["No incidents to analyze"] };
  }

  // Get all unique fields across incidents
  const allFields = new Set();
  const fieldCounts = {};
  const samples = [];
  const issues = [];

  incidents.forEach((incident, index) => {
    if (typeof incident !== "object" || incident === null) {
      issues.push(`Incident ${index}: Not an object`);
      return;
    }

    Object.keys(incident).forEach((field) => {
      allFields.add(field);
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    });

    // Collect samples for first few incidents
    if (samples.length < 3) {
      samples.push({
        index,
        sourceId: incident.sourceId || `Unknown-${index}`,
        fields: Object.keys(incident).length,
        sampleData: {
          title: incident.title?.substring(0, 50) + "..." || "No title",
          date: incident.dateOccurred || incident.date || "No date",
          source: incident.source || "No source",
          region: incident.region || "No region",
        },
      });
    }
  });

  // Check for missing required fields
  const requiredFields = [
    "sourceId",
    "source",
    "dateOccurred",
    "title",
    "description",
  ];
  const missingFields = requiredFields.filter(
    (field) => (fieldCounts[field] || 0) < incidents.length
  );

  if (missingFields.length > 0) {
    issues.push(
      `Missing required fields in some incidents: ${missingFields.join(", ")}`
    );
  }

  return {
    fields: Array.from(allFields).sort(),
    fieldCounts,
    samples,
    issues,
    totalIncidents: incidents.length,
  };
}

// Helper function to analyze hash consistency
function analyzeHashConsistency(sourceData, hashData, lastProcessedHash) {
  const issues = [];
  const status = {};

  if (!sourceData) {
    return {
      status: "❌",
      message: "No source data",
      issues: ["Source cache missing"],
    };
  }

  if (!sourceData.hash) {
    issues.push("Source data missing hash field");
  }

  if (!hashData) {
    issues.push("Hash cache missing");
  } else if (sourceData.hash !== hashData) {
    issues.push("Source hash doesn't match hash cache");
  }

  if (lastProcessedHash) {
    status.processed =
      sourceData.hash === lastProcessedHash ? "✅ Synced" : "⚠️ Pending";
  } else {
    status.processed = "❓ Never processed";
    issues.push("No processing history");
  }

  const overallStatus =
    issues.length === 0 ? "✅" : issues.length > 2 ? "❌" : "⚠️";

  return {
    status: overallStatus,
    message:
      issues.length === 0
        ? "Hash consistency good"
        : `${issues.length} issue(s)`,
    issues,
    details: {
      sourceHash: sourceData.hash
        ? String(sourceData.hash).substring(0, 12) + "..."
        : "None",
      cacheHash: hashData ? String(hashData).substring(0, 12) + "..." : "None",
      processedHash: lastProcessedHash
        ? String(lastProcessedHash).substring(0, 12) + "..."
        : "None",
      processed: status.processed,
    },
  };
}

async function inspectCache() {
  console.log("📊 MARA Cache Inspector");
  console.log("=".repeat(70));
  console.log(`🕐 Inspection Time: ${new Date().toLocaleString()}`);
  console.log("");

  try {
    // Get global cache data
    const functionRuns = await cacheOps.get("function-runs");
    const lastProcessed = await cacheOps.get("last-processed-hashes");

    console.log("🔍 CACHE OVERVIEW");
    console.log("-".repeat(70));

    let totalIncidents = 0;
    let totalCacheSize = 0;
    const sourceAnalysis = {};

    // Analyze each source
    for (const source of SOURCES) {
      const cacheKey = `${source}-incidents`;
      const hashKey = `${source}-hash`;

      console.log(`\n📦 ${source.toUpperCase()} Analysis:`);
      console.log("-".repeat(40));

      try {
        const sourceData = await cacheOps.get(cacheKey);
        const hashData = await cacheOps.get(hashKey);
        const lastProcessedHash = lastProcessed?.[source];

        if (!sourceData) {
          console.log("   ❌ No cache data found");
          sourceAnalysis[source] = { status: "missing", incidents: 0 };
          continue;
        }

        // Basic metrics
        const incidents = sourceData.incidents || [];
        const cacheSize = JSON.stringify(sourceData).length;
        totalIncidents += incidents.length;
        totalCacheSize += cacheSize;

        console.log(`   📊 Incidents: ${incidents.length}`);
        console.log(`   💾 Cache Size: ${formatBytes(cacheSize)}`);
        console.log(
          `   ⏰ Last Update: ${sourceData.timestamp ? new Date(sourceData.timestamp).toLocaleString() : "Unknown"}`
        );

        // Hash analysis
        const hashAnalysis = analyzeHashConsistency(
          sourceData,
          hashData,
          lastProcessedHash
        );
        console.log(
          `   🔑 Hash Status: ${hashAnalysis.status} ${hashAnalysis.message}`
        );

        if (hashAnalysis.details) {
          console.log(`      Current: ${hashAnalysis.details.sourceHash}`);
          console.log(`      Cached: ${hashAnalysis.details.cacheHash}`);
          console.log(
            `      Processed: ${hashAnalysis.details.processedHash} (${hashAnalysis.details.processed})`
          );
        }

        // Data structure analysis
        const structureAnalysis = analyzeIncidentStructure(incidents);
        console.log(`   📋 Data Structure:`);
        console.log(
          `      Fields: ${structureAnalysis.fields.length} unique fields`
        );
        console.log(
          `      Issues: ${structureAnalysis.issues.length} detected`
        );

        if (structureAnalysis.issues.length > 0) {
          structureAnalysis.issues.forEach((issue) => {
            console.log(`         ⚠️ ${issue}`);
          });
        }

        // Show sample incidents
        if (structureAnalysis.samples.length > 0) {
          console.log(`   📄 Sample Incidents:`);
          structureAnalysis.samples.forEach((sample) => {
            console.log(`      ${sample.sourceId}:`);
            console.log(`         Title: ${sample.sampleData.title}`);
            console.log(`         Date: ${sample.sampleData.date}`);
            console.log(`         Region: ${sample.sampleData.region}`);
          });
        }

        // Metadata analysis
        if (sourceData.metadata) {
          console.log(`   📈 Metadata:`);
          Object.entries(sourceData.metadata).forEach(([key, value]) => {
            if (typeof value === "object") {
              console.log(`      ${key}: ${JSON.stringify(value)}`);
            } else {
              console.log(`      ${key}: ${value}`);
            }
          });
        }

        sourceAnalysis[source] = {
          status: "healthy",
          incidents: incidents.length,
          cacheSize,
          hashStatus: hashAnalysis.status,
          issues: [...hashAnalysis.issues, ...structureAnalysis.issues],
        };
      } catch (error) {
        console.log(`   ❌ Error analyzing ${source}: ${error.message}`);
        sourceAnalysis[source] = {
          status: "error",
          incidents: 0,
          error: error.message,
        };
      }
    }

    // Global analysis
    console.log("\n");
    console.log("🌍 GLOBAL CACHE ANALYSIS");
    console.log("-".repeat(70));
    console.log(`📊 Total Incidents: ${totalIncidents}`);
    console.log(`💾 Total Cache Size: ${formatBytes(totalCacheSize)}`);
    console.log(
      `🔄 Active Sources: ${Object.values(sourceAnalysis).filter((s) => s.status === "healthy").length}/${SOURCES.length}`
    );

    // Function runs analysis
    if (functionRuns?.runs) {
      const recentRuns = functionRuns.runs.filter((run) => {
        const runTime = new Date(run.timestamp);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return runTime > dayAgo;
      });

      console.log(`⚡ Function Runs (24h): ${recentRuns.length}`);

      // Group by function type
      const runsByFunction = {};
      recentRuns.forEach((run) => {
        const funcName = run.function || "unknown";
        if (!runsByFunction[funcName]) {
          runsByFunction[funcName] = { success: 0, error: 0, total: 0 };
        }
        runsByFunction[funcName].total++;
        if (run.status === "success") {
          runsByFunction[funcName].success++;
        } else if (run.status === "error") {
          runsByFunction[funcName].error++;
        }
      });

      console.log("\n📈 Function Performance (24h):");
      Object.entries(runsByFunction).forEach(([func, stats]) => {
        const successRate = ((stats.success / stats.total) * 100).toFixed(1);
        const status =
          stats.error === 0 ? "✅" : stats.success > stats.error ? "⚠️" : "❌";
        console.log(
          `   ${status} ${func}: ${stats.success}/${stats.total} (${successRate}% success)`
        );
      });
    }

    // Hash tracking analysis
    console.log("\n🔑 HASH TRACKING ANALYSIS");
    console.log("-".repeat(70));

    if (!lastProcessed) {
      console.log("❌ No hash tracking found - processing may be broken");
    } else {
      console.log("✅ Hash tracking active");
      console.log(
        `   Last updated: ${lastProcessed.timestamp ? new Date(lastProcessed.timestamp).toLocaleString() : "Unknown"}`
      );

      let syncedCount = 0;
      let pendingCount = 0;

      SOURCES.forEach((source) => {
        const analysis = sourceAnalysis[source];
        if (analysis && analysis.status === "healthy") {
          const isProcessed = lastProcessed[source];
          if (isProcessed) {
            syncedCount++;
            console.log(`   ✅ ${source.toUpperCase()}: Synced`);
          } else {
            pendingCount++;
            console.log(`   ⚠️ ${source.toUpperCase()}: Pending processing`);
          }
        }
      });

      console.log(
        `\n   Summary: ${syncedCount} synced, ${pendingCount} pending`
      );
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS");
    console.log("-".repeat(70));

    const recommendations = [];

    // Check for missing sources
    const missingSources = Object.entries(sourceAnalysis).filter(
      ([_, analysis]) => analysis.status === "missing"
    );
    if (missingSources.length > 0) {
      recommendations.push(
        `🔧 ${missingSources.length} source(s) have no cache data - check collectors`
      );
    }

    // Check for hash issues
    const hashIssues = Object.entries(sourceAnalysis).filter(
      ([_, analysis]) =>
        analysis.hashStatus === "❌" || analysis.hashStatus === "⚠️"
    );
    if (hashIssues.length > 0) {
      recommendations.push(
        `🔑 ${hashIssues.length} source(s) have hash inconsistencies`
      );
    }

    // Check for data issues
    const dataIssues = Object.entries(sourceAnalysis).filter(
      ([_, analysis]) => analysis.issues && analysis.issues.length > 0
    );
    if (dataIssues.length > 0) {
      recommendations.push(
        `📋 ${dataIssues.length} source(s) have data structure issues`
      );
    }

    // Check processing status
    if (!lastProcessed) {
      recommendations.push(
        "🚀 Initialize hash tracking by running process-incidents"
      );
    }

    if (recommendations.length === 0) {
      console.log("✅ Cache is healthy - no issues detected");
    } else {
      recommendations.forEach((rec) => console.log(`   ${rec}`));
    }

    console.log("");
  } catch (error) {
    console.error("❌ Error during cache inspection:", error.message);
    console.error("   Make sure environment variables are set correctly");
  }
}

// Run the cache inspection
inspectCache();

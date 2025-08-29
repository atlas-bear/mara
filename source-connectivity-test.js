#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();

import { fetchWithRetry } from "./functions/utils/fetch.js";
import { fetchHtmlContent } from "./functions/utils/fetch.js";

const SOURCES = {
  ICC: {
    name: "International Chamber of Commerce",
    url: process.env.SOURCE_URL_ICC,
    type: "json",
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  },
  UKMTO: {
    name: "UK Maritime Trade Operations",
    url: process.env.SOURCE_URL_UKMTO,
    type: "json",
    method: "GET",
    headers: {
      Origin: "https://www.ukmto.org",
      Referer: "https://www.ukmto.org/",
    },
  },
  CWD: {
    name: "Conflict and War Data",
    url: process.env.SOURCE_URL_CWD,
    type: "html",
    method: "GET",
    headers: {},
  },
  RECAAP: {
    name: "Regional Cooperation Agreement",
    url:
      process.env.SOURCE_URL_RECAAP ||
      "https://portal.recaap.org/OpenMap/MapSearchIncidentServlet/",
    type: "json",
    method: "POST",
    headers: {
      accept: "*/*",
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
      referer: "https://portal.recaap.org/OpenMap",
    },
    body: {
      incidentDateFrom: "01 August 2025",
      incidentDateTo: "29 August 2025",
      shipName: "",
      shipImoNumber: "",
      shipFlag: "",
      shipType: "",
      areaLocation: [],
      incidentType: "",
      reportType: "Case",
      incidentNo: "",
    },
  },
  MDAT: {
    name: "Maritime Domain Awareness for Trade",
    url:
      process.env.SOURCE_URL_MDAT ||
      "https://gog-mdat.org/api/events/getPoints",
    type: "json",
    method: "GET",
    headers: {
      Accept: "application/json",
      Origin: "https://gog-mdat.org",
    },
  },
};

// Helper function to test connectivity
async function testSourceConnectivity(sourceKey, config) {
  console.log(`\n🔍 Testing ${sourceKey} (${config.name})`);
  console.log(`   URL: ${config.url || "Not configured"}`);

  if (!config.url) {
    return {
      status: "❌",
      message: "URL not configured in environment variables",
      details: null,
    };
  }

  try {
    let response;
    const startTime = Date.now();

    if (config.type === "html") {
      // Test HTML fetching (CWD)
      response = await fetchHtmlContent(config.url, config.headers);
      const responseTime = Date.now() - startTime;

      return {
        status: "✅",
        message: `HTML content retrieved (${responseTime}ms)`,
        details: {
          responseTime,
          contentLength: response?.length || 0,
          contentType: "text/html",
        },
      };
    } else {
      // Test JSON APIs
      const options = {
        method: config.method,
        headers: config.headers,
        timeout: 10000,
      };

      if (config.body) {
        options.body = config.body;
      }

      response = await fetchWithRetry(config.url, options);
      const responseTime = Date.now() - startTime;

      // Analyze response structure
      let dataAnalysis = {};
      if (response.data) {
        if (Array.isArray(response.data)) {
          dataAnalysis = {
            type: "array",
            length: response.data.length,
            sample: response.data[0]
              ? Object.keys(response.data[0]).slice(0, 5)
              : [],
          };
        } else if (
          response.data.markers &&
          Array.isArray(response.data.markers)
        ) {
          dataAnalysis = {
            type: "object_with_markers",
            markersCount: response.data.markers.length,
            sample: response.data.markers[0]
              ? Object.keys(response.data.markers[0]).slice(0, 5)
              : [],
          };
        } else if (
          response.data.features &&
          Array.isArray(response.data.features)
        ) {
          dataAnalysis = {
            type: "geojson_features",
            featuresCount: response.data.features.length,
            sample: response.data.features[0]
              ? Object.keys(response.data.features[0]).slice(0, 5)
              : [],
          };
        } else {
          dataAnalysis = {
            type: "object",
            keys: Object.keys(response.data).slice(0, 10),
          };
        }
      }

      return {
        status: "✅",
        message: `API responding (${responseTime}ms)`,
        details: {
          responseTime,
          statusCode: response.status || 200,
          contentType: response.headers?.["content-type"] || "application/json",
          dataAnalysis,
        },
      };
    }
  } catch (error) {
    let errorType = "Unknown error";
    let suggestion = "Check network connectivity";

    if (error.message?.includes("timeout")) {
      errorType = "Request timeout";
      suggestion = "API may be slow or overloaded";
    } else if (error.message?.includes("ENOTFOUND")) {
      errorType = "DNS resolution failed";
      suggestion = "Check if domain exists and is accessible";
    } else if (error.message?.includes("ECONNREFUSED")) {
      errorType = "Connection refused";
      suggestion = "Service may be down or blocking requests";
    } else if (error.response?.status) {
      errorType = `HTTP ${error.response.status}`;
      suggestion = getHttpErrorSuggestion(error.response.status);
    }

    return {
      status: "❌",
      message: `${errorType}: ${error.message}`,
      details: {
        errorType,
        suggestion,
        statusCode: error.response?.status,
        responseData: error.response?.data,
      },
    };
  }
}

function getHttpErrorSuggestion(statusCode) {
  switch (statusCode) {
    case 401:
      return "Authentication required - check API keys";
    case 403:
      return "Access forbidden - check permissions or rate limits";
    case 404:
      return "Endpoint not found - URL may have changed";
    case 429:
      return "Rate limited - reduce request frequency";
    case 500:
      return "Server error - try again later";
    case 502:
    case 503:
    case 504:
      return "Service temporarily unavailable";
    default:
      return "Check API documentation for details";
  }
}

async function runConnectivityTests() {
  console.log("🌐 MARA Source Connectivity Test");
  console.log("=".repeat(60));
  console.log(`📅 Test Time: ${new Date().toLocaleString()}`);
  console.log("");

  const results = {};
  let healthyCount = 0;
  let totalCount = 0;

  for (const [sourceKey, config] of Object.entries(SOURCES)) {
    totalCount++;
    const result = await testSourceConnectivity(sourceKey, config);
    results[sourceKey] = result;

    if (result.status === "✅") {
      healthyCount++;
    }

    // Display basic result
    console.log(`   ${result.status} ${sourceKey}: ${result.message}`);

    // Show additional details for successful connections
    if (result.status === "✅" && result.details) {
      const details = result.details;
      if (details.dataAnalysis) {
        const analysis = details.dataAnalysis;
        if (analysis.type === "array") {
          console.log(`      📊 Data: ${analysis.length} items in array`);
        } else if (analysis.type === "object_with_markers") {
          console.log(`      📊 Data: ${analysis.markersCount} markers`);
        } else if (analysis.type === "geojson_features") {
          console.log(
            `      📊 Data: ${analysis.featuresCount} GeoJSON features`
          );
        }

        if (analysis.sample && analysis.sample.length > 0) {
          console.log(`      🔑 Sample fields: ${analysis.sample.join(", ")}`);
        }
      }
      console.log(`      ⏱️  Response time: ${details.responseTime}ms`);
    }

    // Show error details for failed connections
    if (result.status === "❌" && result.details) {
      console.log(`      💡 Suggestion: ${result.details.suggestion}`);
      if (result.details.statusCode) {
        console.log(`      📋 Status Code: ${result.details.statusCode}`);
      }
    }
  }

  console.log("");
  console.log("📊 CONNECTIVITY SUMMARY");
  console.log("-".repeat(60));
  console.log(`✅ Healthy Sources: ${healthyCount}/${totalCount}`);
  console.log(`❌ Failed Sources: ${totalCount - healthyCount}/${totalCount}`);

  // Detailed recommendations
  console.log("");
  console.log("💡 RECOMMENDATIONS");
  console.log("-".repeat(60));

  const failedSources = Object.entries(results).filter(
    ([_, result]) => result.status === "❌"
  );

  if (failedSources.length === 0) {
    console.log("✅ All sources are accessible - connectivity is healthy");
  } else {
    console.log("Issues detected with the following sources:");
    failedSources.forEach(([source, result]) => {
      console.log(
        `   ❌ ${source}: ${result.details?.suggestion || "Check configuration"}`
      );
    });
  }

  // Environment variable check
  console.log("");
  console.log("🔧 ENVIRONMENT VARIABLES");
  console.log("-".repeat(60));

  const envVars = [
    "SOURCE_URL_ICC",
    "SOURCE_URL_UKMTO",
    "SOURCE_URL_CWD",
    "SOURCE_URL_RECAAP",
    "SOURCE_URL_MDAT",
  ];

  envVars.forEach((varName) => {
    const value = process.env[varName];
    const status = value ? "✅" : "❌";
    const display = value
      ? `${value.substring(0, 50)}${value.length > 50 ? "..." : ""}`
      : "Not set";
    console.log(`   ${status} ${varName}: ${display}`);
  });

  console.log("");
}

// Run the connectivity tests
runConnectivityTests().catch((error) => {
  console.error("❌ Error running connectivity tests:", error.message);
});

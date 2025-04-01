/**
 * Script to refresh weekly report content by triggering get-weekly-report-content.js
 */

import axios from "axios";

// Define the exact start and end dates for the reporting period
const start = "2025-03-24T21:00:00.000Z";
const end = "2025-03-31T21:00:00.000Z";

async function refreshWeeklyReport() {
  try {
    // Get the base URL
    const baseUrl = process.env.PUBLIC_URL || process.env.SITE_URL || 'http://localhost:8888';
    console.log(`Using base URL: ${baseUrl}`);
    
    console.log(`Refreshing weekly report content for ${start} to ${end}`);
    const response = await axios.get(
      `${baseUrl}/.netlify/functions/get-weekly-report-content?start=${start}&end=${end}`
    );
    
    if (response.status === 200) {
      console.log("Weekly report content refresh successful!");
      console.log("Cache status:", response.headers["x-cache"] || "Not available");
      console.log("Cache source:", response.headers["x-cache-source"] || "Not available");
      
      // Print a preview of the response data
      console.log("\nPreview of response data:");
      if (response.data.executiveBrief) {
        console.log("Executive Brief included in response");
        
        // Show regions with incidents
        if (response.data.regionalSummary) {
          console.log("\nRegional summary:");
          Object.entries(response.data.regionalSummary).forEach(([region, data]) => {
            console.log(`- ${region}: ${data.incidentCount || 0} incidents`);
          });
        }
      } else {
        console.log("Response structure:", Object.keys(response.data));
      }
    } else {
      console.error("Error refreshing weekly report content:", response.statusText);
    }
  } catch (error) {
    console.error("Error during refresh:", error.message);
    if (error.response) {
      console.error("API response status:", error.response.status);
      console.error("API response data:", error.response.data);
    }
  }
}

refreshWeeklyReport();
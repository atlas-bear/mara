/**
 * Weekly maritime report analysis prompt
 * Version: 1.0.0
 * Last updated: 2025-03-24
 *
 * This prompt instructs Claude to:
 * 1. Generate "Key Developments" for the Executive Brief
 * 2. Create a "7-Day Forecast" for each maritime region
 * 3. Structure the response for easy integration into the weekly report
 */

/**
 * Create a prompt for weekly maritime report analysis
 * @param {Array<Object>} incidents - The current week's incidents
 * @param {Object} regionalData - Regional statistics and trend data
 * @param {Date} startDate - Start of reporting period
 * @param {Date} endDate - End of reporting period
 * @returns {String} - Formatted prompt for Claude
 */
export const createWeeklyReportPrompt = (incidents, regionalData, startDate, endDate) => {
  // Create a summary of incidents by region
  const regionSummary = Object.entries(regionalData.stats || {})
    .map(([region, stats]) => {
      return `${region}: ${stats.incidents} incidents, Threat level: ${stats.threatLevel.level}`;
    })
    .join('\n');

  // Format incidents for the prompt
  const incidentDetails = incidents.map(inc => {
    const { incident, incidentType } = inc;
    return `
    Title: ${incident.fields.title || "No title"}
    Region: ${incident.fields.region || "Unknown"}
    Date: ${incident.fields.date_time_utc ? new Date(incident.fields.date_time_utc).toISOString() : "Unknown"}
    Location: ${incident.fields.location_name || "Unknown"}
    Incident Type: ${incidentType?.fields?.name || "Unknown"}
    Description: ${incident.fields.description || "No description"}
    `;
  }).join('\n');

  return `
  You are a maritime security expert for MARA analyzing weekly maritime incidents worldwide. Based on the current week's maritime incidents, regional statistics, and historical trends, please provide:

  1. KEY DEVELOPMENTS (4 most significant developments):
     - Identify the 4 most critical security developments from the current week's incidents
     - Each development should highlight a single significant event, pattern, or emerging threat
     - Indicate severity with a color level (red: severe, orange: substantial, yellow: moderate, blue: notable)
     - Format developments to be concise, factual, and focused on operational impacts
     - If there are fewer than 4 significant incidents, supplement with regional trends or ongoing security situations

  2. 7-DAY FORECAST (for each of the 5 major regions):
     - Provide a forward-looking security assessment for each region
     - Include likely threat developments, risk levels, and recommended precautions
     - Indicate trend direction (up, down, or stable)
     - Focus on actionable intelligence for maritime operators
     - Regions: West Africa, Southeast Asia, Indian Ocean, Europe, Americas

  CURRENT WEEK'S DATA:
  Reporting Period: ${startDate.toDateString()} to ${endDate.toDateString()}

  REGIONAL SUMMARY:
  ${regionSummary}

  INCIDENT DETAILS:
  ${incidentDetails}

  RESPOND IN THIS JSON FORMAT ONLY:
  {
    "keyDevelopments": [
      {
        "region": "Region name",
        "level": "red|orange|yellow|blue",
        "content": "Development text - 1-2 sentences describing the significant development"
      }
    ],
    "forecast": [
      {
        "region": "Region name",
        "trend": "up|down|stable",
        "content": "Forecast text - 1-2 sentences describing the upcoming risk pattern and recommendations"
      }
    ]
  }

  IMPORTANT GUIDELINES:
  - Be specific about the nature of threats in each region
  - Focus on factual information over speculation
  - Ensure content is directly relevant to maritime security
  - Include specific locations/sea lanes where applicable
  - For regions with no incidents, assess based on historical patterns
  `;
};

/**
 * Model configuration for the prompt
 */
export const promptConfig = {
  model: "claude-3-haiku-20240307",
  max_tokens: 1500,
  temperature: 0.3,
};
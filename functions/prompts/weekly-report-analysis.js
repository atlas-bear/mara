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
     - Create a TRUE FORECAST that predicts what will happen in the next 7 days
     - Begin each forecast with the predicted maritime security situation
     - Explicitly state what incidents are likely to occur and where
     - Focus on probability language: "high likelihood," "expected to continue," "significant probability"
     - Include a very brief tactical recommendation as the second part of each forecast
     - Structure forecasts as: "Forecast of what will happen + Brief advice to vessels"
     - Regions must include: West Africa, Southeast Asia, Indian Ocean, Europe, Americas
     - Indicate trend direction with an arrow character at the start: ↗ (up), ↘ (down), → (stable)

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
        "content": "Forecast text - prediction of likely incidents followed by tactical recommendations"
      }
    ]
  }
  
  NOTE: When the JSON is processed, the trend values will be converted to arrows (↗ for up, ↘ for down, → for stable)

  IMPORTANT GUIDELINES:
  - Be specific about the nature of threats in each region
  - Focus on factual information over speculation
  - Ensure content is directly relevant to maritime security
  - Include specific locations/sea lanes where applicable
  - For regions with no incidents, assess based on historical patterns
  
  EXAMPLE 7-DAY FORECASTS (follow this exact format):
  
  Indian Ocean: Heightened alert with significant probability of renewed Houthi attacks in Red Sea and Gulf of Aden. Vessels advised to exercise extreme caution and maintain maximum distance from Yemen coastline.
  
  Southeast Asia: Continued risk of robbery and theft in Singapore Strait expected over the next week. Increased vigilance recommended in Phillip Channel. Republic of Singapore Navy patrols have reduced incidents in Singapore territorial waters.
  
  West Africa: Ongoing piracy threat with active PAG in Gulf of Guinea likely to increase with favorable weather forecast. Vessels advised to enhance lookout, ensure prompt reporting of suspicious activity, and follow Best Management Practices.
  
  Europe: Military-related incidents in Black Sea expected to remain at current levels. Maritime traffic calling at Israeli ports advised to exercise extreme caution and contact local authorities for updated security protocols.
  
  Americas: Risk level forecast to decrease slightly as naval patrols increase. Vessels at Callao Anchorage, Peru should maintain vigilance during nighttime hours (0000-0800 UTC). Haiti continues to have deteriorating security conditions.

  NOTE: The trend arrows (↗, ↘, →) will be automatically added before each region name based on the "trend" field in your JSON. DO NOT include the trend arrows in the content or region fields.
  `;
};

/**
 * Model configuration for the prompt
 */
export const promptConfig = {
  model: "claude-3-sonnet-20240229",  // Using a more capable model for higher quality analysis
  max_tokens: 2000,                   // Increased to allow for more detailed forecasts
  temperature: 0.2,                   // Lower temperature for more factual, consistent responses
};
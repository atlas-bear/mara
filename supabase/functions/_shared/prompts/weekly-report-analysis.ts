/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

/**
 * Weekly maritime report analysis prompt for Supabase Edge Functions.
 */

import { CONFIGS } from './config.ts';
import { log } from '../logger.ts';

// Define expected input structures (adjust as needed based on actual data source)
// deno-lint-ignore no-explicit-any
type IncidentInput = Record<string, any>; // Represents a processed incident record
// deno-lint-ignore no-explicit-any
type RegionalStats = Record<string, { incidents: number; threatLevel: { level: string } }>;
interface RegionalDataInput {
    stats?: RegionalStats;
    // Add other potential fields like trends if available
}

// Define the 5 major regions required by the prompt
const MAJOR_REGIONS = [
    "West Africa",
    "Southeast Asia",
    "Indian Ocean",
    "Europe",
    "Americas"
];

/**
 * Create a prompt for weekly maritime report analysis.
 * @param incidents - Array of the current week's incident objects.
 * @param regionalData - Object containing regional statistics.
 * @param startDate - Start date of the reporting period.
 * @param endDate - End date of the reporting period.
 * @returns Formatted prompt string for Claude.
 */
export function createWeeklyReportPrompt(
    incidents: IncidentInput[],
    regionalData: RegionalDataInput,
    startDate: Date,
    endDate: Date
): string {
    try {
        // Create a summary of incidents by region
        const regionSummary = Object.entries(regionalData.stats || {})
            .map(([region, stats]) => {
                // Format region name nicely (e.g., west_africa -> West Africa)
                const formattedRegion = region.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `${formattedRegion}: ${stats.incidents} incidents, Threat level: ${stats.threatLevel?.level || 'Unknown'}`;
            })
            .join('\n');

        // Format incidents for the prompt (using Supabase field names)
        const incidentDetails = incidents.map(inc => {
            // Access fields directly assuming 'inc' is the record object
            return `
    Title: ${inc.title || "No title"}
    Region: ${inc.region || "Unknown"}
    Date: ${inc.date_time_utc ? new Date(inc.date_time_utc).toISOString() : "Unknown"}
    Location: ${inc.location_name || "Unknown"}
    Incident Type: ${inc.incident_type_name || "Unknown"}
    Description: ${inc.description?.substring(0, 200) || "No description"}...
    `; // Truncate long descriptions
        }).join('\n');

        return `
You are a maritime security expert for MARA analyzing weekly maritime incidents worldwide. Based on the current week's maritime incidents, regional statistics, and historical trends, please provide:

1.  KEY DEVELOPMENTS (4 most significant developments):
    - Identify the 4 most critical security developments from the current week's incidents.
    - Each development should highlight a single significant event, pattern, or emerging threat.
    - Indicate severity with a color level (red: severe, orange: substantial, yellow: moderate, blue: notable).
    - Format developments to be concise, factual, and focused on operational impacts.
    - If there are fewer than 4 significant incidents, supplement with regional trends or ongoing security situations.

2.  7-DAY FORECAST (for each of the 5 major regions listed below):
    - Create a TRUE FORECAST that predicts what will happen in the next 7 days.
    - Begin each forecast with the predicted maritime security situation.
    - Explicitly state what incidents are likely to occur and where.
    - Focus on probability language: "high likelihood," "expected to continue," "significant probability."
    - Include a very brief tactical recommendation as the second part of each forecast.
    - Structure forecasts as: "Forecast of what will happen + Brief advice to vessels."
    - Regions MUST include: ${MAJOR_REGIONS.join(', ')}.
    - Indicate trend direction with a keyword at the start: [UP], [DOWN], or [STABLE].

CURRENT WEEK'S DATA:
Reporting Period: ${startDate.toDateString()} to ${endDate.toDateString()}

REGIONAL SUMMARY:
${regionSummary || "No regional summary available."}

INCIDENT DETAILS (Sample):
${incidentDetails.substring(0, 3000) || "No incidents reported this week."}
${incidents.length > 10 ? `\n...(truncated, ${incidents.length} total incidents)`: ''}


RESPOND IN THIS JSON FORMAT ONLY:
{
  "keyDevelopments": [
    {
      "region": "Region name (e.g., West Africa)",
      "level": "red|orange|yellow|blue",
      "content": "Development text - 1-2 sentences describing the significant development"
    }
  ],
  "forecast": [
    {
      "region": "Region name (must be one of: ${MAJOR_REGIONS.join(', ')})",
      "trend": "up|down|stable",
      "content": "Forecast text - prediction of likely incidents followed by tactical recommendations"
    }
  ]
}

IMPORTANT GUIDELINES:
- Be specific about the nature of threats in each region.
- Focus on factual information over speculation.
- Ensure content is directly relevant to maritime security.
- Include specific locations/sea lanes where applicable.
- For regions with no incidents, assess based on historical patterns.
- Ensure the "forecast" array contains exactly one entry for each of the 5 required regions: ${MAJOR_REGIONS.join(', ')}.
- Start each forecast content with the trend keyword: [UP], [DOWN], or [STABLE].

EXAMPLE 7-DAY FORECASTS (follow this exact format for the content):

[STABLE] Indian Ocean: Heightened alert with significant probability of renewed Houthi attacks in Red Sea and Gulf of Aden. Vessels advised to exercise extreme caution and maintain maximum distance from Yemen coastline.
[UP] Southeast Asia: Continued risk of robbery and theft in Singapore Strait expected to increase over the next week. Increased vigilance recommended in Phillip Channel.
[DOWN] West Africa: Ongoing piracy threat likely to decrease slightly due to unfavorable weather forecast, but active PAG remains. Vessels advised to enhance lookout and follow Best Management Practices.
`;
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error('Failed to create weekly report analysis prompt', { error: error.message });
        return `Error creating prompt: ${error.message}`;
    }
}

/**
 * Model configuration for this prompt.
 */
export const promptConfig = CONFIGS.WEEKLY_REPORT;

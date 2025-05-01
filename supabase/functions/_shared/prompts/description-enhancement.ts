/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

/**
 * Maritime incident description enhancement prompt for Supabase Edge Functions.
 */

import { CONFIGS } from './config.ts';
import { referenceData } from '../referenceData.ts'; // Use Supabase reference data utility
import { log } from '../logger.ts';

// Define the structure for the input record fields more explicitly if possible
// deno-lint-ignore no-explicit-any
type RecordFields = Record<string, any>;

/**
 * Create a prompt for maritime incident description enhancement.
 * Fetches current reference data lists dynamically.
 * @param recordFields - Processed record fields from Supabase raw_data table.
 * @returns Formatted prompt string for Claude.
 */
export async function createDescriptionEnhancementPrompt(recordFields: RecordFields): Promise<string> {
  try {
    // Fetch current reference data lists from Supabase
    // Use Promise.allSettled to fetch even if some fail (though referenceData handles errors internally)
    const [
        weaponsResult,
        itemsResult,
        responsesResult,
        authoritiesResult
    ] = await Promise.allSettled([
        referenceData.getWeaponNames(),
        referenceData.getItemStolenNames(),
        referenceData.getResponseTypeNames(),
        referenceData.getAuthorityNames(),
    ]);

    // Helper to format lists, providing default if fetch failed
    const formatList = (result: PromiseSettledResult<string[]>, listName: string): string => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            return result.value.map(item => `     * ${item}`).join('\n');
        } else if (result.status === 'fulfilled') {
             return `     * [No ${listName} found in reference data]`;
        } else {
            log.error(`Failed to fetch ${listName} list for prompt`, { reason: result.reason });
            return `     * [Error fetching ${listName}]`;
        }
    };

    const weaponOptions = formatList(weaponsResult, 'Weapons');
    const itemOptions = formatList(itemsResult, 'Items Stolen');
    const responseOptions = formatList(responsesResult, 'Response Types');
    const authorityOptions = formatList(authoritiesResult, 'Authorities');

    // Construct the prompt using template literals
    return `
You are an expert maritime security analyst. Based on the maritime incident details below, please:

1.  Create a concise but descriptive title for this incident (max 10 words). The title should clearly convey the incident type, location, and any distinctive characteristics. Examples of good titles:
    - "Armed Boarding of Bulk Carrier off Indonesia"
    - "Missile Attack on Commercial Vessel in Red Sea"
    - "Pirate Kidnapping of Crew Near Nigeria"
    - "Drone Strike on Russian Naval Base in Sevastopol"

2.  If location information is missing, extract the specific body of water or nearest point of reference from the description (e.g., "Singapore Strait", "Gulf of Guinea", "Takoradi Anchorage, Ghana", "North of Eyl, Somalia").

3.  Rephrase and standardize the incident description following these guidelines:
    - Remain 100% faithful to the facts without inventing any information not present in the original.
    - Use proper nautical terminology (e.g., use "aboard" instead of "on" a ship).
    - Abbreviate "nautical miles" to "NM" (e.g., "345NM").
    - Use title case for vessel types (e.g., "Container Ship," "Tanker," "Bulk Carrier").
    - Introduce acronyms properly on first use (e.g., "UK Maritime Trade Operations (UKMTO)", "anti-ship ballistic missile (ASBM)").
    - Format the text professionally with proper paragraph breaks where appropriate.
    - Be concise while preserving all key details.

4.  Carefully identify any weapons mentioned in the description, even if described vaguely. Examples:
    - "gun-like object" should be classified as "Firearms (unspecified)"
    - "hammers" or similar tools used as weapons should be listed as "Improvised weapons"
    - If no weapons are explicitly mentioned, but the incident involves force, include "Unknown weapons"
    - If clearly no weapons were used, indicate "None"

5.  Provide an insightful analysis of the incident (1-2 paragraphs). Focus on specific tactical details and operational significance, NOT on general statements about maritime chokepoints or well-known regional challenges. Your analysis should:
    - Skip obvious contextual statements (like "the Singapore Strait is a critical maritime chokepoint").
    - Analyze the attackers' tactics, techniques, or procedures.
    - Note anything unusual or significant about this specific incident.
    - Identify patterns if this incident follows a known trend of similar attacks.
    - Discuss the effectiveness of any countermeasures employed.

6.  Provide brief, actionable recommendations for vessels in similar situations (2-3 concise bullet points).

7.  Extract specific details in JSON format:

    - Weapons used (select all that apply from the list below, be thorough in identifying weapons from the description):
${weaponOptions}

    - Number of attackers (numeric value, null if unknown)

    - Items stolen (select all that apply from the list below):
${itemOptions}

    - Response type (select all that apply from the list below):
${responseOptions}

    - Authorities notified (select all that apply from the list below):
${authorityOptions}

INCIDENT DETAILS:
Original Title: ${recordFields.title || "No title available"}
Date: ${recordFields.date || "No date available"}
Location: ${recordFields.location || "Not specified in record"}
Coordinates: (${recordFields.latitude || "?"}, ${recordFields.longitude || "?"})
Description: ${recordFields.description || "No description available"}
Updates: ${recordFields.update_text || "None"}
Incident Type: ${recordFields.incident_type_name || "Unknown type"}
Vessel: ${recordFields.vessel_name ? `${recordFields.vessel_name} (${recordFields.vessel_type || "Unknown type"})` : "Unknown vessel"}
Source: ${recordFields.source || "Unknown source"}

Please respond in JSON format ONLY, like this:
{
  "title": "Your concise title here",
  "location": "Extracted or provided location",
  "description": "Your rephrased and standardized description here...",
  "analysis": "Your insightful analysis here...",
  "recommendations": ["Brief recommendation 1", "Brief recommendation 2", "Brief recommendation 3"],
  "weapons_used": ["Option1", "Option2"],
  "number_of_attackers": 5,
  "items_stolen": ["Option1", "Option2"],
  "response_type": ["Option1", "Option2"],
  "authorities_notified": ["Option1", "Option2"]
}

If you specify "Other" in any category, please include details in the corresponding field. If a category is not applicable or no information is available, return an empty array [] for list fields or null for single value fields (like number_of_attackers).
`;
  } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Failed to create description enhancement prompt', { error: error.message });
      // Return a fallback prompt or re-throw? Returning fallback for resilience.
      return `Error creating prompt. Please analyze the following data: ${JSON.stringify(recordFields)}`;
  }
}

/**
 * Model configuration for this prompt.
 */
export const promptConfig = CONFIGS.INCIDENT_ANALYSIS; // Uses the INCIDENT_ANALYSIS config settings

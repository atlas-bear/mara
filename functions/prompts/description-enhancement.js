/**
 * Maritime incident description enhancement prompt
 * Version: 1.0.0
 * Last updated: 2025-04-04
 *
 * This prompt instructs Claude to:
 * 1. Create a concise title for the incident
 * 2. Extract location information if missing
 * 3. Standardize the incident description following nautical terminology
 * 4. Process and standardize various metadata fields
 *
 * This is used by process-raw-data-background.js to enhance raw incident data
 * before creating structured incident records.
 */

import { MODELS, CONFIGS } from "./config.js";
import { WEAPONS, ITEMS_STOLEN, RESPONSE_TYPES, AUTHORITIES } from "./reference-data.js";

/**
 * Create a prompt for maritime incident description enhancement
 * @param {Object} recordFields - Processed record fields from Airtable
 * @returns {String} - Formatted prompt for Claude
 */
export const createDescriptionEnhancementPrompt = (recordFields) => {
  // Create weapon options list from reference data
  const weaponOptions = WEAPONS.map(weapon => `     * ${weapon}`).join("\n");
  
  // Create items stolen options list from reference data
  const itemOptions = ITEMS_STOLEN.map(item => `     * ${item}`).join("\n");
  
  // Create response type options list from reference data
  const responseOptions = RESPONSE_TYPES.map(response => `     * ${response}`).join("\n");
  
  // Create authorities notified options list from reference data
  const authorityOptions = AUTHORITIES.map(authority => `     * ${authority}`).join("\n");

  return `
You are an expert maritime security analyst. Based on the maritime incident details below, please:

1. Create a concise but descriptive title for this incident (max 10 words). The title should clearly convey the incident type, location, and any distinctive characteristics. Examples of good titles:
   - "Armed Boarding of Bulk Carrier off Indonesia"
   - "Missile Attack on Commercial Vessel in Red Sea" 
   - "Pirate Kidnapping of Crew Near Nigeria"
   - "Drone Strike on Russian Naval Base in Sevastopol"

2. If location information is missing, extract the specific body of water or nearest point of reference from the description (e.g., "Singapore Strait", "Gulf of Guinea", "Takoradi Anchorage, Ghana", "North of Eyl, Somalia").

3. Rephrase and standardize the incident description following these guidelines:
   - Remain 100% faithful to the facts without inventing any information not present in the original
   - Use proper nautical terminology (e.g., use "aboard" instead of "on" a ship)
   - Abbreviate "nautical miles" to "NM" (e.g., "345NM")
   - Use title case for vessel types (e.g., "Container Ship," "Tanker," "Bulk Carrier")
   - Introduce acronyms properly on first use (e.g., "UK Maritime Trade Operations (UKMTO)", "anti-ship ballistic missile (ASBM)")
   - Format the text professionally with proper paragraph breaks where appropriate
   - Be concise while preserving all key details

4. Carefully identify any weapons mentioned in the description, even if described vaguely. Examples:
   - "gun-like object" should be classified as "Firearms (unspecified)"
   - "hammers" or similar tools used as weapons should be listed as "Improvised weapons"
   - If no weapons are explicitly mentioned, but the incident involves force, include "Unknown weapons"
   - If clearly no weapons were used, indicate "None"

5. Provide an insightful analysis of the incident (1-2 paragraphs). Focus on specific tactical details and operational significance, NOT on general statements about maritime chokepoints or well-known regional challenges. Your analysis should:
   - Skip obvious contextual statements (like "the Singapore Strait is a critical maritime chokepoint")
   - Analyze the attackers' tactics, techniques, or procedures
   - Note anything unusual or significant about this specific incident
   - Identify patterns if this incident follows a known trend of similar attacks
   - Discuss the effectiveness of any countermeasures employed

6. Provide brief, actionable recommendations for vessels in similar situations (2-3 concise bullet points).

7. Extract specific details in JSON format:

   - Weapons used (select all that apply, be thorough in identifying weapons from the description):
${weaponOptions}

   - Number of attackers (numeric value, null if unknown)

   - Items stolen (select all that apply):
${itemOptions}

   - Response type (select all that apply):
${responseOptions}

   - Authorities notified (select all that apply):
${authorityOptions}

INCIDENT DETAILS:
Original Title: ${recordFields.title || "No title available"}
Date: ${recordFields.date || "No date available"}
Location: ${recordFields.location || "Not specified in record"}
Coordinates: (${recordFields.latitude || "?"}, ${recordFields.longitude || "?"})
Description: ${recordFields.description || "No description available"}
Updates: ${recordFields.update || "None"}
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

If you specify "Other" in any category, please include details in the corresponding field.
`;
};

/**
 * Model configuration for the prompt
 */
export const promptConfig = CONFIGS.INCIDENT_ANALYSIS;
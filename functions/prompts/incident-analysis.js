/**
 * Maritime incident analysis prompt
 * Version: 1.0.0
 * Last updated: 2025-03-09
 *
 * This prompt instructs Claude to:
 * 1. Generate a concise analysis paragraph
 * 2. Create 2-3 bullet point recommendations
 * 3. Extract specific structured data from incident description
 *
 * Expected response format:
 * {
 *   "analysis": "String - concise analysis paragraph",
 *   "recommendations": ["String - bullet point 1", "String - bullet point 2"],
 *   "weapons_used": ["String - weapon type(s)"],
 *   "number_of_attackers": Number or null,
 *   "items_stolen": ["String - item type(s)"],
 *   "response_type": ["String - response type(s)"],
 *   "authorities_notified": ["String - authority type(s)"]
 * }
 */

/**
 * Create a prompt for maritime incident analysis
 * @param {Object} incidentData - The raw incident data object
 * @param {Object} recordFields - Processed record fields from Airtable
 * @returns {String} - Formatted prompt for Claude
 */
export const createIncidentAnalysisPrompt = (incidentData, recordFields) => {
  return `
  You are an expert maritime security analyst. Based on the maritime incident details below, please:
  
  1. Provide a concise, focused analysis of the incident (1 paragraph only). Focus on key facts, operational impacts, and security implications. 
  
  2. Provide brief, actionable recommendations for vessels in similar situations (2-3 concise bullet points).
  
  3. Extract specific details in JSON format:
  
     - Weapons used (select all that apply):
       * Missiles
       * Knives
       * Armed individuals (type unspecified)
       * Parangs
       * AK-47s, Machine Guns
       * UAVs
       * Handguns
       * Other weapons (specify)
       * None mentioned
  
     - Number of attackers (numeric value, null if unknown)
  
     - Items stolen (select all that apply):
       * None
       * Engine Spare Parts
       * None reported
       * Engine spares
       * Vessel under pirate control
       * Vessel equipment
       * Crew valuables
       * Funds from crew accounts
       * Other items (specify)
  
     - Response type (select all that apply):
       * Naval
       * Coalition Forces
       * Coast Guard
       * Security incident reported
       * Military response and monitoring
       * Military incident
       * Evasive maneuvers
       * Other response (specify)
       * No response mentioned
  
     - Authorities notified (select all that apply):
       * UKMTO
       * Coalition Forces
       * Flag State
       * VTIS West
       * Singapore Navy
       * Police Coast Guard
       * Singapore VTIS
       * EUNAVFOR
       * Puntland Maritime Police Force
       * Somali Authorities
       * Chinese Authorities
       * EU Delegation to Somalia
       * Russian Naval Command
       * Russian Military Authorities
       * Mexican Maritime Authorities
       * Other authorities (specify)
       * None mentioned
  
  INCIDENT DETAILS:
  Title: ${recordFields.title || "No title available"}
  Date: ${recordFields.date || "No date available"}
  Location: ${recordFields.location || "Unknown"} (${recordFields.latitude || "?"}, ${recordFields.longitude || "?"})
  Description: ${recordFields.description || "No description available"}
  Updates: ${recordFields.update || "None"}
  Incident Type: ${recordFields.incident_type_name || "Unknown type"}
  Vessel: ${recordFields.vessel_name ? `${recordFields.vessel_name} (${recordFields.vessel_type || "Unknown type"})` : "Unknown vessel"}
  Source: ${recordFields.source || "Unknown source"}
  
  Raw Data: ${JSON.stringify(incidentData, null, 2)}
  
  Please respond in JSON format ONLY, like this:
  {
    "analysis": "Your concise analysis here...",
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
export const promptConfig = {
  model: "claude-3-haiku-20240307",
  max_tokens: 1000,
  temperature: 0.2, // Lower temperature for more consistent, factual responses
};

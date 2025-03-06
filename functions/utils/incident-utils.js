import { toTitleCase } from "./string-utils.js";
import axios from "axios";

/**
 * Fetches an incident by ID from Airtable with its related vessel data
 * @param {string} incidentId - The ID of the incident to fetch
 * @returns {Object|null} The incident data with vessel information or null if not found
 */
export async function getIncident(incidentId) {
  if (!incidentId) {
    throw new Error("Incident ID is required");
  }

  console.log(`Fetching incident ${incidentId} from Airtable...`);

  try {
    // 1. Fetch the incident record
    const incidentResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AT_API_KEY || process.env.VITE_AT_API_KEY}`,
          "Content-Type": "application/json",
        },
        params: {
          filterByFormula: `{id}="${incidentId}"`,
          maxRecords: 1,
        },
      }
    );

    if (!incidentResponse.data.records || incidentResponse.data.records.length === 0) {
      console.log(`No incident found with ID ${incidentId}`);
      return null;
    }

    const incidentRecord = incidentResponse.data.records[0];
    const incidentData = incidentRecord.fields;
    console.log(`Found incident: ${incidentData.id} - ${incidentData.description?.substring(0, 50)}...`);

    // 2. Get the vessel ID from incident_vessel join table
    let vesselId = null;
    try {
      console.log(`Looking for vessel relationship for incident ${incidentId}...`);
      const incidentVesselResponse = await axios.get(
        `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AT_API_KEY || process.env.VITE_AT_API_KEY}`,
            "Content-Type": "application/json",
          },
          params: {
            filterByFormula: `{incident}="${incidentRecord.id}"`,
            maxRecords: 1,
          },
        }
      );

      if (incidentVesselResponse.data.records && incidentVesselResponse.data.records.length > 0) {
        const linkRecord = incidentVesselResponse.data.records[0].fields;
        if (linkRecord.vessel && linkRecord.vessel.length > 0) {
          vesselId = linkRecord.vessel[0];
          console.log(`Found vessel relationship, vessel ID: ${vesselId}`);
        }
      }
    } catch (error) {
      console.warn(`Error fetching incident_vessel relationship: ${error.message}`);
    }

    // 3. Get vessel details if we have a vessel ID
    let vesselData = null;
    if (vesselId) {
      try {
        console.log(`Fetching vessel details for vessel ID ${vesselId}...`);
        const vesselResponse = await axios.get(
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel/${vesselId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.AT_API_KEY || process.env.VITE_AT_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (vesselResponse.data) {
          vesselData = vesselResponse.data.fields;
          console.log(`Found vessel data: ${vesselData.name || 'Unknown'} (IMO: ${vesselData.imo || 'N/A'})`);
        }
      } catch (error) {
        console.warn(`Error fetching vessel details: ${error.message}`);
      }
    }

    // 4. Get incident type details if available
    let incidentTypeData = null;
    if (incidentData.incident_type && incidentData.incident_type.length > 0) {
      try {
        console.log(`Fetching incident type data for ${incidentData.incident_type[0]}...`);
        const typeResponse = await axios.get(
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_type/${incidentData.incident_type[0]}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.AT_API_KEY || process.env.VITE_AT_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (typeResponse.data) {
          incidentTypeData = typeResponse.data.fields;
          console.log(`Found incident type: ${incidentTypeData.name || 'Unknown'}`);
        }
      } catch (error) {
        console.warn(`Error fetching incident type details: ${error.message}`);
      }
    }

    // Return combined data
    return {
      incident: incidentData,
      vessel: vesselData,
      incidentType: incidentTypeData
    };
  } catch (error) {
    console.error(`Error fetching incident data: ${error.message}`);
    throw error;
  }
}

export async function determineIncidentType(text, incidentTypes) {
  const lowerText = text.toLowerCase();

  // Common word variations for incident types
  const wordVariations = {
    robbery: ["robber", "robbers", "robbery"],
    attack: ["attack", "attacked", "attacking"],
    boarding: ["board", "boarded", "boarding"],
    attempt: ["attempt", "attempted", "attempting"],
    suspicious: ["suspect", "suspicious", "suspicion"],
    approach: ["approach", "approached", "approaching"],
    theft: ["theft", "thief", "thieves", "steal", "stole", "stolen"],
    piracy: ["piracy", "pirate", "pirates"],
    hijack: ["hijack", "hijacked", "hijacking"],
    unauthorized: ["unauthorized", "unauthorised", "illegal"],
    armed: ["arm", "armed", "arms", "weapon", "weapons"],
  };

  // Try to find matching incident type from reference data
  const matchedType = incidentTypes.find((type) => {
    const typeName = type.name.toLowerCase();

    // Check direct match first
    if (lowerText.includes(typeName)) {
      return true;
    }

    // Check word variations
    for (const [baseWord, variations] of Object.entries(wordVariations)) {
      if (typeName.includes(baseWord)) {
        // If type contains this base word, check for any variations in text
        if (variations.some((variant) => lowerText.includes(variant))) {
          return true;
        }
      }
    }

    return false;
  });

  if (matchedType) {
    return toTitleCase(matchedType.name);
  }

  // Fallback logic if no match found
  if (
    lowerText.includes("armed") ||
    lowerText.includes("weapon") ||
    lowerText.includes("gun")
  ) {
    return "Armed Attack";
  } else if (lowerText.includes("board") && lowerText.includes("attempt")) {
    return "Attempted Boarding";
  } else if (lowerText.includes("board")) {
    return "Boarding";
  }

  return "Suspicious Approach";
}

export function determineSeverity(text) {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("gun") ||
    lowerText.includes("weapon") ||
    lowerText.includes("hostage")
  ) {
    return "high";
  } else if (lowerText.includes("knife") || lowerText.includes("armed")) {
    return "medium";
  }

  return "low";
}

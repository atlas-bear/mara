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
          Authorization: `Bearer ${process.env.AT_API_KEY}`,
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
    let incidentVesselDetails = null;
    try {
      console.log(`Looking for vessel relationship for incident ${incidentId}...`);
      const incidentVesselResponse = await axios.get(
        `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel`,
        {
          headers: {
            Authorization: `Bearer ${process.env.AT_API_KEY}`,
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
        // In our CSV data, we see that the vessel field isn't directly available
        // Instead, we'd need to look at the incident_vessel_id field from vessel table
        // Our goal is to get both incident_vessel data and vessel data
        
        // Keep track of incident_vessel data
        const incidentVesselData = linkRecord;
        console.log('Found incident_vessel data:', Object.keys(incidentVesselData).join(', '));
        
        // Try to find vessel_id
        if (linkRecord.vessel && linkRecord.vessel.length > 0) {
          vesselId = linkRecord.vessel[0];
          console.log(`Found vessel relationship via vessel field, vessel ID: ${vesselId}`);
        } else if (linkRecord.vessel_id) {
          vesselId = linkRecord.vessel_id;
          console.log(`Found vessel relationship via vessel_id field, vessel ID: ${vesselId}`);
        }
        
        // Add incident_vessel data to our return object to ensure we have all the information
        incidentVesselData.id = linkRecord.id;
        // Store for later return
        incidentVesselDetails = incidentVesselData;
        console.log('Incident vessel data added from incident_vessel table');
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
              Authorization: `Bearer ${process.env.AT_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (vesselResponse.data) {
          vesselData = vesselResponse.data.fields;
          
          // Log the full vessel data
          console.log('Vessel data details:', JSON.stringify(vesselData));
          
          // In Airtable, the fields might have different names than what our code expects
          // Make sure vessel data is normalized to have expected field names
          
          // Check for different field name possibilities
          // For example, vessel type might be in 'type' or 'vessel_type'
          if (!vesselData.name && vesselData.vessel_name) {
            vesselData.name = vesselData.vessel_name;
          }
          
          if (!vesselData.type && vesselData.vessel_type) {
            vesselData.type = vesselData.vessel_type;
          }
          
          if (!vesselData.flag && vesselData.vessel_flag) {
            vesselData.flag = vesselData.vessel_flag;
          }
          
          if (!vesselData.imo && vesselData.vessel_imo) {
            vesselData.imo = vesselData.vessel_imo;
          }
          
          // Log the final vessel data after normalization
          console.log(`Found vessel data: ${vesselData.name || 'Unknown'} (IMO: ${vesselData.imo || 'N/A'})`);
          console.log('Normalized vessel fields:');
          console.log('- name:', vesselData.name);
          console.log('- type:', vesselData.type);
          console.log('- flag:', vesselData.flag);
          console.log('- imo:', vesselData.imo);
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
              Authorization: `Bearer ${process.env.AT_API_KEY}`,
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

    // Log complete data for debugging field names
    console.log('=== COMPLETE INCIDENT DATA STRUCTURE ===');
    console.log('Incident Fields:', Object.keys(incidentData));
    console.log('Incident Sample Values:');
    Object.keys(incidentData).slice(0, 10).forEach(key => {
      console.log(`  ${key}: ${JSON.stringify(incidentData[key]).substring(0, 100)}`);
    });
    
    if (vesselData) {
      console.log('Vessel Fields:', Object.keys(vesselData));
      console.log('Vessel Sample Values:');
      Object.keys(vesselData).slice(0, 10).forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(vesselData[key]).substring(0, 100)}`);
      });
    }
    
    if (incidentTypeData) {
      console.log('Incident Type Fields:', Object.keys(incidentTypeData));
      console.log('Incident Type Sample Values:');
      Object.keys(incidentTypeData).slice(0, 5).forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(incidentTypeData[key]).substring(0, 100)}`);
      });
    }
    console.log('======================================');
    
    // Return combined data
    return {
      incident: incidentData,
      vessel: vesselData,
      incidentVessel: incidentVesselDetails,
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

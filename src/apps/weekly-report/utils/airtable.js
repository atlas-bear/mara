const AIRTABLE_API_KEY = import.meta.env.VITE_AT_API_KEY;
const AIRTABLE_BASE_ID = import.meta.env.VITE_AT_BASE_ID_CSER;

export async function fetchIncident(incidentId) {
  try {
    // Log environment variables (first few chars only for security)
    console.log("API Key exists:", !!AIRTABLE_API_KEY);
    console.log("Base ID (first 5 chars):", AIRTABLE_BASE_ID?.substring(0, 5));

    // First fetch the incident
    const incidentResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/incident?maxRecords=1&filterByFormula={id}="${incidentId}"`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Attempting to fetch:",
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/incident`
    );
    console.log("Looking for incident:", incidentId);

    if (!incidentResponse.ok) {
      const errorText = await incidentResponse.text();
      console.error(
        "Incident response not OK:",
        incidentResponse.status,
        errorText
      );
      throw new Error(
        `Failed to fetch incident: ${incidentResponse.status} ${errorText}`
      );
    }

    const incidentData = await incidentResponse.json();

    if (!incidentData.records || incidentData.records.length === 0) {
      throw new Error("No incident found");
    }

    const incident = incidentData.records[0];

    // Then fetch related incident_vessel records
    const incidentVesselResponse = await fetch(
      `https://api.airtable.com/v0/${AT_BASE_ID_CSER}/incident_vessel?filterByFormula={incident_id}='${incidentId}'`,
      {
        headers: {
          Authorization: `Bearer ${AT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const incidentVesselData = await incidentVesselResponse.json();

    // If we have incident_vessel records, fetch the related vessel details
    let vesselDetails = null;
    if (incidentVesselData.records && incidentVesselData.records.length > 0) {
      const vesselId = incidentVesselData.records[0].fields.vessel_id;
      const vesselResponse = await fetch(
        `https://api.airtable.com/v0/${AT_BASE_ID_CSER}/vessel?filterByFormula={id}='${vesselId}'`,
        {
          headers: {
            Authorization: `Bearer ${AT_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const vesselData = await vesselResponse.json();
      if (vesselData.records && vesselData.records.length > 0) {
        vesselDetails = vesselData.records[0];
      }
    }

    return formatIncidentData(
      incident,
      incidentVesselData.records[0],
      vesselDetails
    );
  } catch (error) {
    console.error("Detailed error:", error);
    throw error;
  }
}

function formatIncidentData(incident, incidentVessel, vessel) {
  return {
    id: incident.id,
    alertId: incident.fields.id,
    type: incident.fields.incident_type_name,
    title: incident.fields.title,
    dateTime: incident.fields.date_time_utc,
    location: {
      name: incident.fields.location_name,
      lat: incident.fields.latitude,
      lng: incident.fields.longitude,
    },
    description: incident.fields.description,
    analysis: incident.fields.analysis,
    recommendations: incident.fields.recommendations,
    status: incident.fields.status,
    weapons: incident.fields.weapons_used,
    attackers: incident.fields.number_of_attackers,
    itemsStolen: incident.fields.items_stolen,
    threatLevel: incident.fields.threat_level,
    region: incident.fields.region,
    responseType: incident.fields.response_type,
    authoritiesNotified: incident.fields.authorities_notified,
    // Add vessel details if available
    vesselName: vessel?.fields.vessel_name,
    vesselType: vessel?.fields.vessel_type,
    vesselFlag: vessel?.fields.flag,
    vesselImo: vessel?.fields.imo_number,
    vesselStatus: incidentVessel?.fields.vessel_status_during_incident,
    crewImpact: incidentVessel?.fields.crew_impact,
  };
}

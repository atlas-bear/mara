import { formatLocation } from "../utils/coordinates";

export async function fetchIncident(incidentId) {
  if (!incidentId) {
    throw new Error("No incident ID provided");
  }

  try {
    const response = await fetch(
      `/.netlify/functions/get-incident?id=${incidentId}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch incident");
    }

    const data = await response.json();
    // Pass the incidentType to formatIncidentData
    return formatIncidentData(
      data.incident,
      data.incidentVessel,
      data.vessel,
      data.incidentType
    );
  } catch (error) {
    throw error;
  }
}

export async function formatIncidentData(
  incident,
  incidentVessel,
  vessel,
  incidentType
) {
  if (!incident || !incident.fields) {
    throw new Error("Invalid incident data received");
  }

  console.log("Formatting with incident type:", incidentType);

  const formattedType = incidentType?.fields?.name || "Unknown";
  console.log("Formatted type:", formattedType);

  return {
    id: incident.id,
    alertId: incident.fields.id,
    type: formattedType,
    title: incident.fields.title,
    dateTime: incident.fields.date_time_utc,
    location: {
      name: incident.fields.location_name,
      lat: incident.fields.latitude,
      lng: incident.fields.longitude,
      formatted: formatLocation(
        incident.fields.latitude,
        incident.fields.longitude
      ),
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
    // Update these to match your actual field names in the vessel table
    vesselName: vessel?.fields?.name,
    vesselType: vessel?.fields?.type,
    vesselFlag: vessel?.fields?.flag,
    vesselImo: vessel?.fields?.imo,
    // These come from incident_vessel
    vesselStatus: incidentVessel?.fields?.vessel_status_during_incident,
    crewImpact: incidentVessel?.fields?.crew_impact,
  };
}

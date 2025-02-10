import axios from "axios";

const fetchIncidentDetails = async (incident, baseId, apiKey) => {
  try {
    console.log(`Processing incident ${incident.fields.id}`);

    // Fetch incident_vessel
    const incidentVesselResponse = await axios.get(
      `https://api.airtable.com/v0/${baseId}/incident_vessel?maxRecords=1&filterByFormula={incident_id}="${incident.fields.id}"`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    const incidentVessel = incidentVesselResponse.data.records[0];
    console.log(`Found incident_vessel:`, !!incidentVessel);

    let vessel = null;
    if (incidentVessel?.fields?.vessel_id?.[0]) {
      const vesselResponse = await axios.get(
        `https://api.airtable.com/v0/${baseId}/vessel?maxRecords=1&filterByFormula=RECORD_ID()="${incidentVessel.fields.vessel_id[0]}"`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      vessel = vesselResponse.data.records[0];
      console.log(`Found vessel:`, !!vessel);
    }

    let incidentType = null;
    if (incident.fields.incident_type_name?.[0]) {
      const typeResponse = await axios.get(
        `https://api.airtable.com/v0/${baseId}/incident_type?maxRecords=1&filterByFormula=RECORD_ID()="${incident.fields.incident_type_name[0]}"`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );
      incidentType = typeResponse.data.records[0];
      console.log(`Found incident type:`, incidentType?.fields?.name);
    }

    return {
      incident,
      incidentVessel,
      vessel,
      incidentType,
    };
  } catch (error) {
    console.error(`Error enriching incident ${incident.fields.id}:`, error);
    return {
      incident,
      error: error.message,
    };
  }
};

const fetchLatestIncidentsByRegion = async (baseId, apiKey) => {
  const regions = [
    "West Africa",
    "Southeast Asia",
    "Indian Ocean",
    "Americas",
    "Europe",
  ];
  const latestIncidents = {};

  await Promise.all(
    regions.map(async (region) => {
      try {
        // Fetch the most recent incident for this region
        const formula = `AND({region}='${region}', NOT({date_time_utc}=''))`;
        const response = await axios.get(
          `https://api.airtable.com/v0/${baseId}/incident?maxRecords=1&sort[0][field]=date_time_utc&sort[0][direction]=desc&filterByFormula=${encodeURIComponent(
            formula
          )}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (response.data.records.length > 0) {
          const enrichedIncident = await fetchIncidentDetails(
            response.data.records[0],
            baseId,
            apiKey
          );
          latestIncidents[region] = enrichedIncident;
        }
      } catch (error) {
        console.error(`Error fetching latest incident for ${region}:`, error);
      }
    })
  );

  return latestIncidents;
};

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { start, end } = event.queryStringParameters;
    console.log("Handler started with params:", { start, end });

    // Get incidents for the specified period
    const formula = `AND(
      {date_time_utc} >= '${start}',
      {date_time_utc} <= '${end}'
    )`;

    console.log("Using formula:", formula);

    const incidentsResponse = await axios.get(
      `https://api.airtable.com/v0/${
        process.env.AT_BASE_ID_CSER
      }/incident?filterByFormula=${encodeURIComponent(formula)}`,
      {
        headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      }
    );

    const incidents = incidentsResponse.data.records;
    console.log("Found incidents:", incidents.length);

    // Enrich the current period's incidents
    const enrichedIncidents = await Promise.all(
      incidents.map((incident) =>
        fetchIncidentDetails(
          incident,
          process.env.AT_BASE_ID_CSER,
          process.env.AT_API_KEY
        )
      )
    );

    // Fetch the most recent incident for each region
    const latestIncidents = await fetchLatestIncidentsByRegion(
      process.env.AT_BASE_ID_CSER,
      process.env.AT_API_KEY
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        incidents: enrichedIncidents,
        latestIncidents,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch incidents",
        details: error.message,
      }),
    };
  }
};

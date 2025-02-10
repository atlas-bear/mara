import axios from "axios";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    console.log("Handler started with params:", event.queryStringParameters);

    // Modified formula to use date_time_utc field with proper date format
    const formula = `AND(
      {date_time_utc} >= '2025-02-01',
      {date_time_utc} <= '2025-02-28'
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
    console.log("First incident:", JSON.stringify(incidents[0], null, 2));

    // For each incident, fetch related incident_vessel and vessel records
    const enrichedIncidents = await Promise.all(
      incidents.map(async (incident) => {
        try {
          console.log(`Processing incident ${incident.fields.id}`);

          // Fetch incident_vessel
          const incidentVesselResponse = await axios.get(
            `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel?maxRecords=1&filterByFormula={incident_id}="${incident.fields.id}"`,
            {
              headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
            }
          );

          const incidentVessel = incidentVesselResponse.data.records[0];
          console.log(`Found incident_vessel:`, !!incidentVessel);

          let vessel = null;
          if (incidentVessel?.fields?.vessel_id?.[0]) {
            const vesselResponse = await axios.get(
              `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel?maxRecords=1&filterByFormula=RECORD_ID()="${incidentVessel.fields.vessel_id[0]}"`,
              {
                headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
              }
            );
            vessel = vesselResponse.data.records[0];
            console.log(`Found vessel:`, !!vessel);
          }

          let incidentType = null;
          if (incident.fields.incident_type_name?.[0]) {
            const typeResponse = await axios.get(
              `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_type?maxRecords=1&filterByFormula=RECORD_ID()="${incident.fields.incident_type_name[0]}"`,
              {
                headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
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
          console.error(
            `Error enriching incident ${incident.fields.id}:`,
            error
          );
          return {
            incident,
            error: error.message,
          };
        }
      })
    );

    console.log("Enriched incidents count:", enrichedIncidents.length);
    console.log(
      "First enriched incident:",
      JSON.stringify(enrichedIncidents[0], null, 2)
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ incidents: enrichedIncidents }),
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

import axios from "axios";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { id } = event.queryStringParameters;
  if (!id) {
    return { statusCode: 400, body: "Incident ID is required" };
  }

  try {
    // Fetch incident with expanded incident_type_name field
    const incidentResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident?maxRecords=1&filterByFormula={id}="${id}"`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AT_API_KEY}`,
          "Content-Type": "application/json",
        },
        params: {
          // This tells Airtable to include the linked record data
          select: JSON.stringify({
            filterByFormula: `{id}="${id}"`,
            maxRecords: 1,
          }),
          expand: ["incident_type_name"],
        },
      }
    );

    const incident = incidentResponse.data.records[0];
    console.log("Incident found:", !!incident);
    console.log("Incident data:", JSON.stringify(incident.fields, null, 2));

    if (!incident) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Incident not found" }),
      };
    }

    // Fetch incident type name if we have an incident_type_name ID
    let incidentType = null;
    if (
      incident.fields.incident_type_name &&
      incident.fields.incident_type_name.length > 0
    ) {
      const typeId = incident.fields.incident_type_name[0];
      const typeResponse = await axios.get(
        `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_type?maxRecords=1&filterByFormula=RECORD_ID()="${typeId}"`,
        {
          headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
        }
      );
      if (typeResponse.data.records.length > 0) {
        incidentType = typeResponse.data.records[0];
        console.log("Found incident type:", incidentType.fields.name);
      }
    }

    // Fetch incident_vessel
    const incidentVesselResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel?maxRecords=1&filterByFormula={incident_id}="${id}"`,
      {
        headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
      }
    );

    const incidentVessel = incidentVesselResponse.data.records[0];
    console.log("Incident vessel found:", !!incidentVessel);

    let vessel = null;
    if (incidentVessel && incidentVessel.fields.vessel_id) {
      // Handle the vessel_id as an array
      const vesselId = Array.isArray(incidentVessel.fields.vessel_id)
        ? incidentVessel.fields.vessel_id[0]
        : incidentVessel.fields.vessel_id;

      // Use RECORD_ID() to match Airtable's internal record ID
      const vesselQuery = encodeURIComponent(`RECORD_ID() = "${vesselId}"`);

      const vesselResponse = await axios.get(
        `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel?maxRecords=1&filterByFormula=${vesselQuery}`,
        {
          headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
        }
      );
      vessel = vesselResponse.data.records[0];
      console.log("Vessel found:", !!vessel);
    }

    const responseData = {
      incident,
      incidentType,
      incidentVessel,
      vessel,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error("Error details:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch incident data",
        details: error.message,
      }),
    };
  }
};

const axios = require("axios");

const AIRTABLE_BASE_ID = process.env.AT_BASE_ID_CSER;
const AIRTABLE_API_KEY = process.env.AT_API_KEY;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

async function fetchAirtableRecord(table, recordId) {
  try {
    const response = await axios.get(`${AIRTABLE_URL}/${table}/${recordId}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch ${table}: ${recordId} - ${error.response?.statusText || error.message}`
    );
  }
}

async function fetchLinkedRecords(table, recordIds) {
  if (!recordIds || recordIds.length === 0) return [];

  const records = await Promise.all(
    recordIds.map((id) => fetchAirtableRecord(table, id))
  );
  return records.map((r) => r.fields);
}

exports.handler = async (event) => {
  try {
    const incidentId = event.queryStringParameters.id;
    if (!incidentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing incident ID" }),
      };
    }

    // Fetch the main incident record
    const incidentData = await fetchAirtableRecord("incident", incidentId);
    const incidentFields = incidentData.fields;

    // Resolve linked records
    const authorities = await fetchLinkedRecords(
      "authorities",
      incidentFields.authorities_notified
    );
    const incidentTypes = await fetchLinkedRecords(
      "incident_type",
      incidentFields.incident_type_name
    );
    const responseTypes = await fetchLinkedRecords(
      "response_type",
      incidentFields.response_type
    );
    const weaponsUsed = await fetchLinkedRecords(
      "weapons_used",
      incidentFields.weapons_used
    );
    const itemsStolen = await fetchLinkedRecords(
      "items_stolen",
      incidentFields.items_stolen
    );

    // Fetch linked vessels
    const incidentVessels = await fetchLinkedRecords(
      "incident_vessel",
      incidentFields.incident_vessel
    );
    const vesselIds = incidentVessels.map((v) => v.vessel_id).flat();
    const vessels = await fetchLinkedRecords("vessel", vesselIds);

    // Construct the response
    const responseBody = {
      id: incidentId,
      title: incidentFields.title,
      date_time_utc: incidentFields.date_time_utc,
      location: {
        latitude: incidentFields.latitude,
        longitude: incidentFields.longitude,
        name: incidentFields.location,
      },
      incident_type: incidentTypes.map((t) => t.name),
      description: incidentFields.description,
      analysis: incidentFields.analysis,
      recommendations: incidentFields.recommendations,
      status: incidentFields.status,
      weapons_used: weaponsUsed.map((w) => w.name),
      items_stolen: itemsStolen.map((i) => i.name),
      region: incidentFields.region,
      response_type: responseTypes.map((r) => r.name),
      authorities_notified: authorities.map((a) => a.name),
      map_image_url: incidentFields.map_image_url,
      vessels_involved: vessels.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        flag: v.flag,
        imo: v.imo,
        status_during_incident: v.status_during_incident,
        role: v.role,
        damage_sustained: v.damage_sustained,
        crew_impact: v.crew_impact,
      })),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

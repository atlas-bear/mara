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
    
    // Fetch weapons_used linked records
    let weaponsUsed = [];
    if (incident.fields.weapons_used && incident.fields.weapons_used.length > 0) {
      try {
        // Properly construct and encode the OR formula
        const orFormula = `OR(${incident.fields.weapons_used.map(id => `RECORD_ID()="${id}"`).join(",")})`;
        const encodedFormula = encodeURIComponent(orFormula);
        
        const weaponsResponse = await axios.get(
          `https://api.airtable.com/v0/${baseId}/weapons?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        // Debug the response
        console.log(`Weapons API response records count: ${weaponsResponse.data.records?.length || 0}`);
        
        if (weaponsResponse.data.records && weaponsResponse.data.records.length > 0) {
          weaponsUsed = weaponsResponse.data.records.map(record => record.fields.name);
          console.log(`Found weapons:`, weaponsUsed);
        } else {
          console.log(`No weapon records found for IDs: ${incident.fields.weapons_used.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching weapons data:`, error.message);
      }
    }
    
    // Fetch items_stolen linked records
    let itemsStolen = [];
    if (incident.fields.items_stolen && incident.fields.items_stolen.length > 0) {
      try {
        // Properly construct and encode the OR formula
        const orFormula = `OR(${incident.fields.items_stolen.map(id => `RECORD_ID()="${id}"`).join(",")})`;
        const encodedFormula = encodeURIComponent(orFormula);
        
        const itemsResponse = await axios.get(
          `https://api.airtable.com/v0/${baseId}/items_stolen?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        // Debug the response
        console.log(`Items stolen API response records count: ${itemsResponse.data.records?.length || 0}`);
        
        if (itemsResponse.data.records && itemsResponse.data.records.length > 0) {
          itemsStolen = itemsResponse.data.records.map(record => record.fields.name);
          console.log(`Found stolen items:`, itemsStolen);
        } else {
          console.log(`No items stolen records found for IDs: ${incident.fields.items_stolen.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching items stolen data:`, error.message);
      }
    }
    
    // Fetch response_type linked records
    let responseTypes = [];
    if (incident.fields.response_type && incident.fields.response_type.length > 0) {
      try {
        // Properly construct and encode the OR formula
        const orFormula = `OR(${incident.fields.response_type.map(id => `RECORD_ID()="${id}"`).join(",")})`;
        const encodedFormula = encodeURIComponent(orFormula);
        
        const responseResponse = await axios.get(
          `https://api.airtable.com/v0/${baseId}/response_type?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        // Debug the response
        console.log(`Response type API response records count: ${responseResponse.data.records?.length || 0}`);
        
        if (responseResponse.data.records && responseResponse.data.records.length > 0) {
          responseTypes = responseResponse.data.records.map(record => record.fields.name);
          console.log(`Found response types:`, responseTypes);
        } else {
          console.log(`No response type records found for IDs: ${incident.fields.response_type.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching response type data:`, error.message);
      }
    }
    
    // Fetch authorities_notified linked records
    let authoritiesNotified = [];
    if (incident.fields.authorities_notified && incident.fields.authorities_notified.length > 0) {
      try {
        // Properly construct and encode the OR formula
        const orFormula = `OR(${incident.fields.authorities_notified.map(id => `RECORD_ID()="${id}"`).join(",")})`;
        const encodedFormula = encodeURIComponent(orFormula);
        
        const authoritiesResponse = await axios.get(
          `https://api.airtable.com/v0/${baseId}/authorities_notified?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );
        
        // Debug the response
        console.log(`Authorities API response records count: ${authoritiesResponse.data.records?.length || 0}`);
        
        if (authoritiesResponse.data.records && authoritiesResponse.data.records.length > 0) {
          authoritiesNotified = authoritiesResponse.data.records.map(record => record.fields.name);
          console.log(`Found authorities:`, authoritiesNotified);
        } else {
          console.log(`No authorities records found for IDs: ${incident.fields.authorities_notified.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching authorities data:`, error.message);
      }
    }
    
    // Create a modified copy of the incident with resolved linked field values
    const modifiedIncident = {
      ...incident,
      fields: {
        ...incident.fields,
        // Keep the original IDs for reference, but add the resolved names for display
        weapons_used_names: weaponsUsed,
        items_stolen_names: itemsStolen,
        response_type_names: responseTypes,
        authorities_notified_names: authoritiesNotified
      }
    };

    return {
      incident: modifiedIncident,
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

const fetchLatestIncidentsByRegion = async (baseId, apiKey, endDate) => {
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
        // Fetch the most recent incident for this region that occurred BEFORE or ON the end date
        const formula = `AND({region}='${region}', NOT({date_time_utc}=''), {date_time_utc} <= '${endDate}')`;
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
  // Handle OPTIONS requests (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }
  
  if (event.httpMethod !== "GET") {
    return { 
      statusCode: 405, 
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: "Method Not Allowed" 
    };
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

    // Fetch the most recent incident for each region (up to the end date)
    const latestIncidents = await fetchLatestIncidentsByRegion(
      process.env.AT_BASE_ID_CSER,
      process.env.AT_API_KEY,
      end
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: JSON.stringify({
        error: "Failed to fetch incidents",
        details: error.message,
      }),
    };
  }
};

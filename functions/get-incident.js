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
    // Fetch incident
    const encodedFormula = encodeURIComponent(`{id}="${id}"`);
    const incidentResponse = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident?maxRecords=1&filterByFormula=${encodedFormula}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AT_API_KEY}`,
          "Content-Type": "application/json",
        }
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

    // Fetch weapons_used linked records
    let weaponsUsed = [];
    if (incident.fields.weapons_used && incident.fields.weapons_used.length > 0) {
      try {
        // Properly construct and encode the OR formula
        const orFormula = `OR(${incident.fields.weapons_used.map(id => `RECORD_ID()="${id}"`).join(",")})`;
        const encodedFormula = encodeURIComponent(orFormula);
        
        const weaponsResponse = await axios.get(
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/weapons?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
          }
        );
        
        // Debug the response
        console.log(`Weapons API response records count: ${weaponsResponse.data.records?.length || 0}`);
        console.log(`Weapons formula: ${orFormula}`);
        
        if (weaponsResponse.data.records && weaponsResponse.data.records.length > 0) {
          weaponsUsed = weaponsResponse.data.records.map(record => record.fields.name);
          console.log(`Found weapons:`, weaponsUsed);
        } else {
          console.log(`No weapon records found for IDs: ${incident.fields.weapons_used.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching weapons data:`, error.message);
        if (error.response) {
          console.error(`Error response:`, error.response.data);
        }
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
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/items_stolen?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
          }
        );
        
        // Debug the response
        console.log(`Items stolen API response records count: ${itemsResponse.data.records?.length || 0}`);
        console.log(`Items stolen formula: ${orFormula}`);
        
        if (itemsResponse.data.records && itemsResponse.data.records.length > 0) {
          itemsStolen = itemsResponse.data.records.map(record => record.fields.name);
          console.log(`Found stolen items:`, itemsStolen);
        } else {
          console.log(`No items stolen records found for IDs: ${incident.fields.items_stolen.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching items stolen data:`, error.message);
        if (error.response) {
          console.error(`Error response:`, error.response.data);
        }
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
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/response_type?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
          }
        );
        
        // Debug the response
        console.log(`Response type API response records count: ${responseResponse.data.records?.length || 0}`);
        console.log(`Response type formula: ${orFormula}`);
        
        if (responseResponse.data.records && responseResponse.data.records.length > 0) {
          responseTypes = responseResponse.data.records.map(record => record.fields.name);
          console.log(`Found response types:`, responseTypes);
        } else {
          console.log(`No response type records found for IDs: ${incident.fields.response_type.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching response type data:`, error.message);
        if (error.response) {
          console.error(`Error response:`, error.response.data);
        }
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
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/authorities_notified?filterByFormula=${encodedFormula}`,
          {
            headers: { Authorization: `Bearer ${process.env.AT_API_KEY}` },
          }
        );
        
        // Debug the response
        console.log(`Authorities API response records count: ${authoritiesResponse.data.records?.length || 0}`);
        console.log(`Authorities formula: ${orFormula}`);
        
        if (authoritiesResponse.data.records && authoritiesResponse.data.records.length > 0) {
          authoritiesNotified = authoritiesResponse.data.records.map(record => record.fields.name);
          console.log(`Found authorities:`, authoritiesNotified);
        } else {
          console.log(`No authorities records found for IDs: ${incident.fields.authorities_notified.join(', ')}`);
        }
      } catch (error) {
        console.error(`Error fetching authorities data:`, error.message);
        if (error.response) {
          console.error(`Error response:`, error.response.data);
        }
      }
    }
    
    // Add the resolved names to the incident fields
    const modifiedIncident = {
      ...incident,
      fields: {
        ...incident.fields,
        // Add the resolved names to the incident fields
        weapons_used_names: weaponsUsed,
        items_stolen_names: itemsStolen,
        response_type_names: responseTypes,
        authorities_notified_names: authoritiesNotified
      }
    };

    const responseData = {
      incident: modifiedIncident,
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

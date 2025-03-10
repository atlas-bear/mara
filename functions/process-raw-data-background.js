import axios from "axios";

export default async (req, context) => {
  console.log("Background function triggered", {
    time: new Date().toISOString(),
  });

  try {
    console.log("Background processing started");

    // Check environment variables
    console.log("Environment check:", {
      hasAirtableKey: !!process.env.AT_API_KEY,
      hasAirtableBaseId: !!process.env.AT_BASE_ID_CSER,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    });

    const headers = {
      Authorization: `Bearer ${process.env.AT_API_KEY}`,
      "Content-Type": "application/json",
    };

    // Get next unprocessed record from the "Process" view
    const rawDataUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;
    const unprocessedResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        view: "Process", // Use the specific view
        filterByFormula:
          "AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))",
        maxRecords: 1,
      },
    });

    if (unprocessedResponse.data.records.length === 0) {
      console.log("No unprocessed records found in the Process view");
      return;
    }

    const recordToProcess = unprocessedResponse.data.records[0];
    console.log("Found record to process:", {
      id: recordToProcess.id,
      title: recordToProcess.fields.title,
      region: recordToProcess.fields.region,
    });

    // Update the record to mark it as processing
    await axios.patch(
      `${rawDataUrl}/${recordToProcess.id}`,
      {
        fields: {
          processing_status: "Processing",
          processing_notes: `Started processing at ${new Date().toISOString()}`,
        },
      },
      { headers }
    );

    console.log("Updated record status to processing");

    // Function to properly capitalize all words in a string
    const toTitleCase = (str) => {
      if (!str) return "";
      return str
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    };

    // Function to format region name properly (from snake_case if needed)
    const formatRegion = (region) => {
      if (!region) return "Unknown";

      // First, split by underscores if they exist
      const words = region.includes("_")
        ? region.split("_")
        : region.split(" ");

      // Then capitalize each word
      return words
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
    };

    // Helper function to find or create a reference record in a lookup table
    async function findOrCreateReferenceItem(itemName, tableName) {
      if (!itemName) return null;

      const formattedName = toTitleCase(itemName);
      const tableUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/${tableName}`;

      try {
        // Try to find existing record
        const response = await axios.get(tableUrl, {
          headers,
          params: {
            filterByFormula: `{name} = '${formattedName}'`,
            maxRecords: 1,
          },
        });

        if (response.data.records.length > 0) {
          console.log(`Found existing ${tableName} item: ${formattedName}`);
          return response.data.records[0].id;
        }

        // Create new record if not found
        const createResponse = await axios.post(
          tableUrl,
          {
            fields: {
              name: formattedName,
            },
          },
          { headers }
        );

        console.log(`Created new ${tableName} item: ${formattedName}`);
        return createResponse.data.id;
      } catch (error) {
        console.error(
          `Error finding/creating ${tableName} item:`,
          error.message
        );
        return null;
      }
    }

    // Helper function to process an array of items for a reference table
    async function processReferenceItems(items, tableName) {
      if (!items || items.length === 0) return [];

      const itemIds = [];
      for (const item of items) {
        const itemId = await findOrCreateReferenceItem(item, tableName);
        if (itemId) {
          itemIds.push(itemId);
        }
      }

      return itemIds;
    }

    // First, try to find the incident type in the incident_type table
    let incidentTypeId = null;
    if (recordToProcess.fields.incident_type_name) {
      const incidentTypeName = toTitleCase(
        recordToProcess.fields.incident_type_name
      );
      console.log(`Looking up incident type: "${incidentTypeName}"`);

      try {
        const incidentTypeUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_type`;
        const typeResponse = await axios.get(incidentTypeUrl, {
          headers,
          params: {
            filterByFormula: `{name} = '${incidentTypeName}'`,
            maxRecords: 1,
          },
        });

        if (typeResponse.data.records.length > 0) {
          incidentTypeId = typeResponse.data.records[0].id;
          console.log(`Found incident type ID: ${incidentTypeId}`);
        } else {
          console.log(
            `No matching incident type found for: ${incidentTypeName}`
          );
        }
      } catch (typeError) {
        console.error("Error looking up incident type:", typeError.message);
      }
    }

    // Use Claude to enrich the incident data with improved analysis and custom title
    let enrichedData = {
      analysis: "Analysis pending.",
      recommendations: "• Recommendations pending.",
      title: recordToProcess.fields.title,
      weapons_used: [],
      number_of_attackers: null,
      items_stolen: [],
      response_type: [],
      authorities_notified: [],
    };

    try {
      console.log(
        "Calling Claude API for incident analysis and title generation"
      );

      // Create the prompt
      const prompt = `
You are an expert maritime security analyst. Based on the maritime incident details below, please:

1. Create a concise but descriptive title for this incident (max 10 words). The title should clearly convey the incident type, location, and any distinctive characteristics. Examples of good titles:
   - "Armed Boarding of Bulk Carrier off Indonesia"
   - "Missile Attack on Commercial Vessel in Red Sea" 
   - "Pirate Kidnapping of Crew Near Nigeria"
   - "Drone Strike on Russian Naval Base in Sevastopol"

2. Provide an insightful analysis of the incident (1-2 paragraphs). Your analysis should go beyond restating the facts to include:
   - Context of this incident within regional security trends
   - Tactical significance or unique aspects of this attack
   - Potential implications for maritime security
   - Possible motives or capabilities of the attackers
   - Comparison to similar incidents if relevant

   Examples of good analyses:
   - "This attack follows the pattern of recent escalation in the Red Sea region. The targeting of navigation systems suggests a sophisticated approach aimed at disabling vessel capabilities."
   - "At least three of the armed robbers reportedly fired warning shots, injuring some crew members and forcibly transferring funds from crew members' savings accounts. This marks the second such incident in ten days, with both events following a similar modus operandi: assailants armed with handguns approached the vessel, coerced crew members into transferring funds, and assaulted crew."
   - "The port, which hosts a Russian Naval base, reportedly suffered damage to two missile ships and possibly several smaller vessels, according to Ukrainian sources. The extent of the damage is still unknown, but it has been reported that the impacted warships included the DAGESTAN (FFG-693) and TATARSTAN (FFG-691). Russian sources confirmed that four UAVs targeted the area, with one drone potentially exploding over the Russian Naval garrison. This is the first time Kyiv has attacked a target in the Caspian, about 1,500km from the frontline."

3. Provide brief, actionable recommendations for vessels in similar situations (2-3 concise bullet points).

4. Extract specific details in JSON format:

   - Weapons used (select all that apply):
     * Missiles
     * Knives
     * Armed individuals (type unspecified)
     * Parangs
     * AK-47s
     * Machine Guns
     * UAVs
     * Handguns
     * Other weapons (specify)
     * None mentioned

   - Number of attackers (numeric value, null if unknown)

   - Items stolen (select all that apply):
     * None
     * Engine Spare Parts
     * None reported
     * Engine spares
     * Vessel under pirate control
     * Vessel equipment
     * Crew valuables
     * Funds from crew accounts
     * Other items (specify)

   - Response type (select all that apply):
     * Naval
     * Coalition Forces
     * Coast Guard
     * Security incident reported
     * Military response and monitoring
     * Military incident
     * Evasive maneuvers
     * Other response (specify)
     * No response mentioned

   - Authorities notified (select all that apply):
     * UKMTO
     * Coalition Forces
     * Flag State
     * VTIS West
     * Singapore Navy
     * Police Coast Guard
     * Singapore VTIS
     * EUNAVFOR
     * Puntland Maritime Police Force
     * Somali Authorities
     * Chinese Authorities
     * EU Delegation to Somalia
     * Russian Naval Command
     * Russian Military Authorities
     * Mexican Maritime Authorities
     * Other authorities (specify)
     * None mentioned

INCIDENT DETAILS:
Original Title: ${recordToProcess.fields.title || "No title available"}
Date: ${recordToProcess.fields.date || "No date available"}
Location: ${recordToProcess.fields.location || "Unknown"} (${recordToProcess.fields.latitude || "?"}, ${recordToProcess.fields.longitude || "?"})
Description: ${recordToProcess.fields.description || "No description available"}
Updates: ${recordToProcess.fields.update || "None"}
Incident Type: ${recordToProcess.fields.incident_type_name || "Unknown type"}
Vessel: ${recordToProcess.fields.vessel_name ? `${recordToProcess.fields.vessel_name} (${recordToProcess.fields.vessel_type || "Unknown type"})` : "Unknown vessel"}
Source: ${recordToProcess.fields.source || "Unknown source"}

Please respond in JSON format ONLY, like this:
{
  "title": "Your concise title here",
  "analysis": "Your insightful analysis here...",
  "recommendations": ["Brief recommendation 1", "Brief recommendation 2", "Brief recommendation 3"],
  "weapons_used": ["Option1", "Option2"],
  "number_of_attackers": 5,
  "items_stolen": ["Option1", "Option2"],
  "response_type": ["Option1", "Option2"],
  "authorities_notified": ["Option1", "Option2"]
}

If you specify "Other" in any category, please include details in the corresponding field.
      `;

      // Call Claude API with updated model
      const claudeResponse = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-5-sonnet-20240620", // Updated model
          max_tokens: 1500,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      // Extract and parse Claude's response
      const responseText = claudeResponse.data.content[0].text;

      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);

          // Format recommendations as bullet points
          const formattedRecommendations = Array.isArray(
            parsedData.recommendations
          )
            ? parsedData.recommendations.map((rec) => `• ${rec}`).join("\n")
            : parsedData.recommendations;

          enrichedData = {
            title: parsedData.title || enrichedData.title,
            analysis: parsedData.analysis || enrichedData.analysis,
            recommendations:
              formattedRecommendations || enrichedData.recommendations,
            weapons_used: parsedData.weapons_used || [],
            number_of_attackers:
              typeof parsedData.number_of_attackers === "number"
                ? parsedData.number_of_attackers
                : null,
            items_stolen: parsedData.items_stolen || [],
            response_type: parsedData.response_type || [],
            authorities_notified: parsedData.authorities_notified || [],
          };

          console.log(
            "Successfully processed Claude response with generated title"
          );
          console.log("Generated title:", enrichedData.title);
        } else {
          console.error("Could not extract JSON from Claude response");
        }
      } catch (parseError) {
        console.error("Error parsing Claude response:", parseError.message);
      }
    } catch (claudeError) {
      console.error("Error calling Claude API:", claudeError.message);
    }

    // Process reference items for linked fields
    console.log("Processing weapons_used items");
    const weaponsUsedIds = await processReferenceItems(
      enrichedData.weapons_used,
      "weapons"
    );

    console.log("Processing items_stolen items");
    const itemsStolenIds = await processReferenceItems(
      enrichedData.items_stolen,
      "items_stolen"
    );

    console.log("Processing response_type items");
    const responseTypeIds = await processReferenceItems(
      enrichedData.response_type,
      "response_type"
    );

    console.log("Processing authorities_notified items");
    const authoritiesNotifiedIds = await processReferenceItems(
      enrichedData.authorities_notified,
      "authorities_notified"
    );

    // Create incident record with LLM-generated title and enriched data
    const incidentFields = {
      title: enrichedData.title, // Use the LLM-generated title
      description:
        recordToProcess.fields.description || "No description available",
      date_time_utc: recordToProcess.fields.date || new Date().toISOString(),
      latitude: recordToProcess.fields.latitude,
      longitude: recordToProcess.fields.longitude,
      status: "Active",
      region: formatRegion(recordToProcess.fields.region),

      // LLM-enriched fields
      analysis: enrichedData.analysis,
      recommendations: enrichedData.recommendations,
      number_of_attackers: enrichedData.number_of_attackers,

      // Linked fields with IDs
      weapons_used: weaponsUsedIds.length > 0 ? weaponsUsedIds : undefined,
      items_stolen: itemsStolenIds.length > 0 ? itemsStolenIds : undefined,
      response_type: responseTypeIds.length > 0 ? responseTypeIds : undefined,
      authorities_notified:
        authoritiesNotifiedIds.length > 0 ? authoritiesNotifiedIds : undefined,
    };

    // Add incident_type_name reference only if we found a matching ID
    if (incidentTypeId) {
      // The field is named incident_type_name, but as a link field it needs array of IDs
      incidentFields.incident_type_name = [incidentTypeId];
    }

    // Add location_name only if it exists
    if (recordToProcess.fields.location) {
      incidentFields.location_name = recordToProcess.fields.location;
    }

    console.log("Creating incident with fields:", incidentFields);

    // Create the incident record
    const incidentUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`;
    const incidentResponse = await axios.post(
      incidentUrl,
      { fields: incidentFields },
      { headers }
    );

    console.log("Created incident record:", {
      incidentId: incidentResponse.data.id,
    });

    // Create vessel record if vessel data exists
    let vesselId = null;
    if (recordToProcess.fields.vessel_name) {
      // Check if vessel exists by name
      try {
        const vesselUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel`;
        const vesselCheckResponse = await axios.get(vesselUrl, {
          headers,
          params: {
            filterByFormula: `{name} = '${recordToProcess.fields.vessel_name}'`,
            maxRecords: 1,
          },
        });

        if (vesselCheckResponse.data.records.length > 0) {
          vesselId = vesselCheckResponse.data.records[0].id;
          console.log(`Found existing vessel: ${vesselId}`);
        } else {
          // Create new vessel record
          const vesselResponse = await axios.post(
            vesselUrl,
            {
              fields: {
                name: recordToProcess.fields.vessel_name,
                type: recordToProcess.fields.vessel_type,
                flag: recordToProcess.fields.vessel_flag,
                imo: recordToProcess.fields.vessel_imo,
              },
            },
            { headers }
          );

          vesselId = vesselResponse.data.id;
          console.log(`Created new vessel record: ${vesselId}`);
        }
      } catch (vesselError) {
        console.error("Error processing vessel data:", vesselError.message);
      }
    }

    // Create incident_vessel linking record if both records exist
    if (incidentResponse.data.id && vesselId) {
      try {
        const incidentVesselUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel`;
        const incidentVesselResponse = await axios.post(
          incidentVesselUrl,
          {
            fields: {
              incident_id: [incidentResponse.data.id],
              vessel_id: [vesselId],
              vessel_status_during_incident: "Normal", // Default
              vessel_role: "Target", // Default
            },
          },
          { headers }
        );

        console.log(
          `Created incident_vessel link: ${incidentVesselResponse.data.id}`
        );
      } catch (linkError) {
        console.error(
          "Error creating incident_vessel link:",
          linkError.message
        );
      }
    }

    // Mark the raw data record as processed with link to the incident
    await axios.patch(
      `${rawDataUrl}/${recordToProcess.id}`,
      {
        fields: {
          has_incident: true,
          processing_status: "Complete",
          processing_notes: `Successfully processed at ${new Date().toISOString()}`,
          linked_incident: [incidentResponse.data.id],
        },
      },
      { headers }
    );

    console.log("Marked record as processed");
    console.log("Background processing completed successfully");

    // Check if more records exist to process
    const moreRecords = await checkMoreRecordsExist(rawDataUrl, headers);

    if (moreRecords) {
      console.log("More records exist, triggering next processing job");

      // Trigger another processing run via API call
      try {
        const siteUrl = process.env.URL || "https://mara-v2.netlify.app";
        await axios.post(
          `${siteUrl}/.netlify/functions/process-raw-data-background`
        );
      } catch (triggerError) {
        console.error(
          "Failed to trigger next processing job",
          triggerError.message
        );
      }
    }
  } catch (error) {
    console.error("Background processing error:", error.message);

    // Log more detailed error information
    if (error.response) {
      console.error(
        "Error response data:",
        JSON.stringify(error.response.data, null, 2)
      );
      console.error("Error response status:", error.response.status);
    }
  }
};

// Helper function to check if more records exist to process
async function checkMoreRecordsExist(rawDataUrl, headers) {
  try {
    const response = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        view: "Process", // Use the specific view
        filterByFormula:
          "AND(NOT({has_incident}), OR(NOT({processing_status}), {processing_status} = 'pending'))",
        maxRecords: 1,
      },
    });

    return response.data.records.length > 0;
  } catch (error) {
    console.error("Error checking for more records", error.message);
    return false;
  }
}

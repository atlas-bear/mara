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
      incident_type_name: recordToProcess.fields.incident_type_name,
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

    // Process the incident_type_name from raw_data
    let incidentTypeId = null;
    let incidentTypeName = null;

    if (recordToProcess.fields.incident_type_name) {
      incidentTypeName = toTitleCase(recordToProcess.fields.incident_type_name);
      console.log(`Looking up incident type: "${incidentTypeName}"`);

      try {
        // Ensure the incident type exists in the reference table
        incidentTypeId = await findOrCreateReferenceItem(
          incidentTypeName,
          "incident_type"
        );

        if (incidentTypeId) {
          console.log(`Found/created incident type ID: ${incidentTypeId}`);
        } else {
          console.log(`Unable to process incident type: ${incidentTypeName}`);
        }
      } catch (typeError) {
        console.error("Error handling incident type:", typeError.message);
      }
    }

    // Extract location from description if not provided
    let extractedLocation = null;
    if (!recordToProcess.fields.location) {
      // We'll use Claude to extract this later, but also do basic extraction here
      const description = recordToProcess.fields.description || "";

      // Check for common location references
      const locationMatches =
        description.match(
          /in the ([\w\s]+Strait|Gulf of \w+|Red Sea|Mediterranean|Caribbean|[\w\s]+ Anchorage)/i
        ) ||
        description.match(/near ([\w\s]+)/i) ||
        description.match(/off ([\w\s]+)/i);

      if (locationMatches && locationMatches[1]) {
        extractedLocation = locationMatches[1].trim();
        console.log(
          `Extracted location from description: ${extractedLocation}`
        );
      }
    }

    // Use Claude to enrich the incident data with improved analysis and custom title
    let enrichedData = {
      analysis: "Analysis pending.",
      recommendations: "• Recommendations pending.",
      title: recordToProcess.fields.title,
      location: recordToProcess.fields.location || extractedLocation,
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

2. If location information is missing, extract the specific body of water or nearest point of reference from the description (e.g., "Singapore Strait", "Gulf of Guinea", "Takoradi Anchorage, Ghana", "North of Eyl, Somalia").

3. Carefully identify any weapons mentioned in the description, even if described vaguely. Examples:
   - "gun-like object" should be classified as "Firearms (unspecified)"
   - "hammers" or similar tools used as weapons should be listed as "Improvised weapons"
   - If no weapons are explicitly mentioned, but the incident involves force, include "Unknown weapons"
   - If clearly no weapons were used, indicate "None"

4. Provide an insightful analysis of the incident (1-2 paragraphs). Focus on specific tactical details and operational significance, NOT on general statements about maritime chokepoints or well-known regional challenges. Your analysis should:
   - Skip obvious contextual statements (like "the Singapore Strait is a critical maritime chokepoint")
   - Analyze the attackers' tactics, techniques, or procedures
   - Note anything unusual or significant about this specific incident
   - Identify patterns if this incident follows a known trend of similar attacks
   - Discuss the effectiveness of any countermeasures employed

5. Provide brief, actionable recommendations for vessels in similar situations (2-3 concise bullet points).

6. Extract specific details in JSON format:

   - Weapons used (select all that apply, be thorough in identifying weapons from the description):
     * Firearms (unspecified)
     * Knives
     * Armed individuals (type unspecified)
     * Parangs
     * AK-47s
     * Machine Guns
     * Handguns
     * Improvised weapons
     * Missiles
     * UAVs
     * USVs
     * Limpet mines
     * None
     * Other weapons (specify)

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
Location: ${recordToProcess.fields.location || "Not specified in record"}
Coordinates: (${recordToProcess.fields.latitude || "?"}, ${recordToProcess.fields.longitude || "?"})
Description: ${recordToProcess.fields.description || "No description available"}
Updates: ${recordToProcess.fields.update || "None"}
Incident Type: ${recordToProcess.fields.incident_type_name || "Unknown type"}
Vessel: ${recordToProcess.fields.vessel_name ? `${recordToProcess.fields.vessel_name} (${recordToProcess.fields.vessel_type || "Unknown type"})` : "Unknown vessel"}
Source: ${recordToProcess.fields.source || "Unknown source"}

Please respond in JSON format ONLY, like this:
{
  "title": "Your concise title here",
  "location": "Extracted or provided location",
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

          // Log the raw weapons data from Claude
          console.log("Claude identified weapons:", parsedData.weapons_used);

          // Format recommendations as bullet points
          const formattedRecommendations = Array.isArray(
            parsedData.recommendations
          )
            ? parsedData.recommendations.map((rec) => `• ${rec}`).join("\n")
            : parsedData.recommendations;

          enrichedData = {
            title: parsedData.title || enrichedData.title,
            location:
              parsedData.location ||
              recordToProcess.fields.location ||
              extractedLocation,
            analysis: parsedData.analysis || enrichedData.analysis,
            recommendations:
              formattedRecommendations || enrichedData.recommendations,
            weapons_used: Array.isArray(parsedData.weapons_used)
              ? parsedData.weapons_used
              : [],
            number_of_attackers:
              typeof parsedData.number_of_attackers === "number"
                ? parsedData.number_of_attackers
                : null,
            items_stolen: Array.isArray(parsedData.items_stolen)
              ? parsedData.items_stolen
              : [],
            response_type: Array.isArray(parsedData.response_type)
              ? parsedData.response_type
              : [],
            authorities_notified: Array.isArray(parsedData.authorities_notified)
              ? parsedData.authorities_notified
              : [],
          };

          console.log(
            "Successfully processed Claude response with generated title"
          );
          console.log("Generated title:", enrichedData.title);
          console.log("Extracted location:", enrichedData.location);
          console.log("Identified weapons:", enrichedData.weapons_used);
        } else {
          console.error("Could not extract JSON from Claude response");
        }
      } catch (parseError) {
        console.error("Error parsing Claude response:", parseError.message);
      }
    } catch (claudeError) {
      console.error("Error calling Claude API:", claudeError.message);
    }

    // If weapons array is empty but description mentions weapons, try to extract them
    if (
      (!enrichedData.weapons_used || enrichedData.weapons_used.length === 0) &&
      recordToProcess.fields.description
    ) {
      const description = recordToProcess.fields.description.toLowerCase();

      // Expanded pattern matching for various weapon types
      const weaponPatterns = {
        "Firearms (unspecified)": /gun|firearm|pistol|revolver|shot/,
        "AK-47": /ak-?47|kalashnikov/,
        "Machine Guns": /machine gun|machinegun|automatic/,
        Handguns: /handgun|pistol|revolver/,
        Knives: /knife|knives|blade/,
        Parangs: /parang|machete/,
        "Improvised weapons": /hammer|stick|pipe|tool|improvised/,
        Missiles: /missile|rocket|projectile/,
        UAVs: /uav|drone|unmanned aerial|unmanned aircraft/,
        USVs: /usv|unmanned surface|unmanned vessel|unmanned boat/,
        "Limpet mines": /limpet|mine|explosive device/,
        "Armed individuals (type unspecified)": /armed|weapon|arm/,
      };

      const detectedWeapons = [];

      for (const [weaponType, pattern] of Object.entries(weaponPatterns)) {
        if (pattern.test(description)) {
          detectedWeapons.push(weaponType);
          console.log(`Detected weapon type from description: ${weaponType}`);
        }
      }

      if (detectedWeapons.length > 0) {
        enrichedData.weapons_used = detectedWeapons;
        console.log("Extracted weapons from description:", detectedWeapons);
      } else if (description.match(/attack|board|rob|pirat|threat|force/)) {
        // If description suggests hostile action but no weapons detected
        enrichedData.weapons_used = ["Unknown weapons"];
        console.log(
          "Added 'Unknown weapons' as incident suggests hostile action"
        );
      }
    }

    // Process reference items for linked fields
    console.log("Processing weapons_used items");
    console.log("Raw weapons data:", enrichedData.weapons_used);
    const weaponsUsedIds = await processReferenceItems(
      enrichedData.weapons_used,
      "weapons"
    );
    console.log("Processed weapons used IDs:", weaponsUsedIds);

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
      location_name: enrichedData.location, // Use extracted or provided location

      // LLM-enriched fields
      analysis: enrichedData.analysis,
      recommendations: enrichedData.recommendations,
      number_of_attackers: enrichedData.number_of_attackers,

      // Linked fields with IDs - never set to undefined
      weapons_used: weaponsUsedIds.length > 0 ? weaponsUsedIds : null,
      items_stolen: itemsStolenIds.length > 0 ? itemsStolenIds : null,
      response_type: responseTypeIds.length > 0 ? responseTypeIds : null,
      authorities_notified:
        authoritiesNotifiedIds.length > 0 ? authoritiesNotifiedIds : null,
    };

    // Add incident_type_name reference if available
    if (incidentTypeId) {
      incidentFields.incident_type_name = [incidentTypeId];
    }

    console.log("Creating incident with fields:", {
      ...incidentFields,
      weapons_used: incidentFields.weapons_used, // Explicitly log weapons field
    });

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
        // Determine vessel status based on raw_data or description
        let vesselStatus = "Underway"; // Default value

        if (recordToProcess.fields.vessel_status) {
          // If vessel_status is provided in raw_data, use it directly
          const statusValue = recordToProcess.fields.vessel_status.trim();

          // Map of possible raw status values to valid single select options
          const statusMap = {
            underway: "Underway",
            "at anchor": "Anchored",
            anchored: "Anchored",
            moored: "Moored",
            berthed: "Berthed",
            "under tow": "Under Tow",
            towed: "Under Tow",
            "not under command": "Not Under Command",
            nuc: "Not Under Command",
            operating: "Operating",
          };

          // Check for exact or partial matches in the statusMap
          const lowerStatus = statusValue.toLowerCase();
          let matchFound = false;

          for (const [key, value] of Object.entries(statusMap)) {
            if (lowerStatus === key || lowerStatus.includes(key)) {
              vesselStatus = value;
              matchFound = true;
              console.log(
                `Matched vessel status "${statusValue}" to "${vesselStatus}"`
              );
              break;
            }
          }

          if (!matchFound) {
            vesselStatus = "Other"; // Default to "Other" if no match found
            console.log(
              `No match found for vessel status "${statusValue}", using "Other"`
            );
          }
        } else if (recordToProcess.fields.description) {
          // Try to extract vessel status from description
          const description = recordToProcess.fields.description.toLowerCase();

          if (
            description.includes("at anchor") ||
            description.includes("anchored")
          ) {
            vesselStatus = "Anchored";
          } else if (
            description.includes("moored") ||
            description.includes("alongside")
          ) {
            vesselStatus = "Moored";
          } else if (
            description.includes("berthed") ||
            description.includes("at berth")
          ) {
            vesselStatus = "Berthed";
          } else if (
            description.includes("tow") ||
            description.includes("towing")
          ) {
            vesselStatus = "Under Tow";
          } else if (
            description.includes("not under command") ||
            description.includes("nuc")
          ) {
            vesselStatus = "Not Under Command";
          } else if (
            description.includes("underway") ||
            description.includes("sailing") ||
            description.includes("transiting") ||
            description.includes("en route")
          ) {
            vesselStatus = "Underway";
          }

          console.log(
            `Extracted vessel status "${vesselStatus}" from description`
          );
        }

        // Prepare the data with arrays for link fields and extracted single select values
        const incidentVesselData = {
          fields: {
            // Keep as arrays since these are link fields
            incident_id: [incidentResponse.data.id],
            vessel_id: [vesselId],
            // Use extracted or default status
            vessel_status_during_incident: vesselStatus,
            vessel_role: "Target", // This is correct from your options
            // Add date_added field
            date_added: new Date().toISOString(),
          },
        };

        console.log(
          "Attempting to create incident_vessel link with data:",
          JSON.stringify(incidentVesselData, null, 2)
        );

        const incidentVesselUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel`;
        const incidentVesselResponse = await axios.post(
          incidentVesselUrl,
          incidentVesselData,
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

        // Detailed error logging
        if (linkError.response) {
          console.error(
            "Link error response data:",
            JSON.stringify(linkError.response.data, null, 2)
          );

          // Try again with minimal required fields
          try {
            console.log("Trying with minimal required fields only");

            // Try with only the required link fields
            const minimalData = {
              fields: {
                incident_id: [incidentResponse.data.id],
                vessel_id: [vesselId],
              },
            };

            const minResponse = await axios.post(
              incidentVesselUrl,
              minimalData,
              { headers }
            );

            console.log(
              `Created incident_vessel link with minimal fields: ${minResponse.data.id}`
            );
          } catch (minError) {
            console.error("Error with minimal fields:", minError.message);
            if (minError.response) {
              console.error(
                "Minimal fields error data:",
                JSON.stringify(minError.response.data, null, 2)
              );
            }
          }
        }
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

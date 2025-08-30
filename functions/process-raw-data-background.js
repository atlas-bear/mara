import axios from "axios";
import {
  calculateTimeProximityScore,
  calculateSpatialProximityScore,
} from "./utils/spatial-utils.js";
import { calculateVesselNameSimilarity } from "./utils/similarity-utils.js";
import { log } from "./utils/logger.js";

export default async (req, context) => {
  console.log("Background function triggered", {
    time: new Date().toISOString(),
  });

  try {
    console.log("Background processing started");

    // First, check for and reset any stuck records that have been in processing state for too long
    await resetStuckProcessingRecords();

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

    // Define all API URLs upfront
    const rawDataUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;
    const vesselUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel`;
    const incidentUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`;
    const incidentVesselUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident_vessel`;

    // Try multiple queries to find records to process, in order of priority
    let recordToProcess = null;

    // 1. First, try to find new unprocessed records
    console.log("Looking for new unprocessed records...");
    const newRecordsResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        view: "Process",
        filterByFormula: `NOT({has_incident})`,
        maxRecords: 1,
      },
    });

    if (newRecordsResponse.data.records.length > 0) {
      recordToProcess = newRecordsResponse.data.records[0];
      console.log("Found new unprocessed record");
    }

    // 2. If no new records, look for merged records that need linking
    if (!recordToProcess) {
      console.log("Looking for merged records that need linking...");
      const mergedRecordsResponse = await axios({
        method: "get",
        url: rawDataUrl,
        headers,
        params: {
          view: "Process",
          filterByFormula: `AND({processing_status} = 'Merged', {merge_status} = 'merged_into', {merged_into}, NOT({has_incident}))`,
          maxRecords: 1,
        },
      });

      if (mergedRecordsResponse.data.records.length > 0) {
        recordToProcess = mergedRecordsResponse.data.records[0];
        console.log("Found merged record that needs linking");
      }
    }

    // 3. If no new or merged records, look for updated records that need reprocessing
    if (!recordToProcess) {
      console.log("Looking for updated records that need reprocessing...");
      try {
        const updatedRecordsResponse = await axios({
          method: "get",
          url: rawDataUrl,
          headers,
          params: {
            view: "Process",
            filterByFormula: `AND({has_incident}, {processing_status} = 'Complete', {updated_at}, {last_processed}, IS_AFTER({updated_at}, {last_processed}))`,
            maxRecords: 1,
          },
        });

        if (updatedRecordsResponse.data.records.length > 0) {
          recordToProcess = updatedRecordsResponse.data.records[0];
          console.log("Found updated record that needs reprocessing");
        }
      } catch (updateError) {
        console.log(
          "Could not check for updated records (this is normal if fields don't exist):",
          updateError.message
        );
      }
    }

    if (!recordToProcess) {
      console.log("No records found to process");
      return;
    }
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
          last_processed: new Date().toISOString(),
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

      // Remove only the "(specify)" suffix while preserving the rest of the item name
      let cleanedName = itemName.replace(/\s*\(specify\)\s*$/i, "");

      // Log if we made a change to help track the fix
      if (cleanedName !== itemName) {
        console.log(
          `Removed "(specify)" suffix from "${itemName}" → "${cleanedName}"`
        );
      }

      const formattedName = toTitleCase(cleanedName);
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

      // Import the centralized LLM service
      const { callClaudeWithPrompt } = await import("./utils/llm-service.js");

      // Prepare the data for the prompt
      const promptData = {
        recordFields: recordToProcess.fields,
      };

      // Call Claude using the centralized service
      console.log(
        "Using centralized prompts system with descriptionEnhancement prompt"
      );
      const enhancedResult = await callClaudeWithPrompt(
        "descriptionEnhancement",
        promptData
      );

      // Log the success
      console.log("Successfully called Claude using centralized prompt system");

      // Use the response from the centralized system directly
      // The response is already parsed and formatted by the LLM processor

      // Log the raw weapons data from Claude
      console.log("Claude identified weapons:", enhancedResult.weapons_used);

      // Update our enriched data with the processed results
      enrichedData = {
        title: enhancedResult.title || enrichedData.title,
        location:
          enhancedResult.location ||
          recordToProcess.fields.location ||
          extractedLocation,
        description:
          enhancedResult.description || recordToProcess.fields.description,
        analysis: enhancedResult.analysis || enrichedData.analysis,
        recommendations:
          enhancedResult.recommendations || enrichedData.recommendations,
        weapons_used: Array.isArray(enhancedResult.weapons_used)
          ? enhancedResult.weapons_used
          : [],
        number_of_attackers: enhancedResult.number_of_attackers || null,
        items_stolen: Array.isArray(enhancedResult.items_stolen)
          ? enhancedResult.items_stolen
          : [],
        response_type: Array.isArray(enhancedResult.response_type)
          ? enhancedResult.response_type
          : [],
        authorities_notified: Array.isArray(enhancedResult.authorities_notified)
          ? enhancedResult.authorities_notified
          : [],
      };

      // Log the enhanced description
      console.log("Enhanced incident description:", {
        originalLength: recordToProcess.fields.description?.length || 0,
        enhancedLength: enrichedData.description?.length || 0,
        wasEnhanced: !!enhancedResult.description,
      });

      console.log(
        "Successfully processed Claude response with generated title"
      );
      console.log("Generated title:", enrichedData.title);
      console.log("Extracted location:", enrichedData.location);
      console.log("Identified weapons:", enrichedData.weapons_used);
    } catch (claudeError) {
      console.error(
        "Error calling Claude API through centralized prompt system:",
        claudeError.message
      );
      console.error(
        "This may be due to API issues or problems with the prompt configuration"
      );
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

    // Check if this record is part of a merge chain
    let mergedWithRecord = null;

    if (
      recordToProcess.fields.merge_status === "merged_into" &&
      recordToProcess.fields.merged_into &&
      recordToProcess.fields.merged_into.length > 0
    ) {
      log.info("This record has been merged into another record", {
        mergedInto: recordToProcess.fields.merged_into[0],
      });

      try {
        // Find the record it was merged into
        const mergedResponse = await axios({
          method: "get",
          url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data/${recordToProcess.fields.merged_into[0]}`,
          headers,
        });

        if (mergedResponse.data) {
          mergedWithRecord = mergedResponse.data;
          log.info("Found the record this was merged into", {
            mergedWithId: mergedWithRecord.id,
            mergedWithSource: mergedWithRecord.fields.source,
            mergedWithHasIncident: !!mergedWithRecord.fields.has_incident,
            mergedWithLinkedIncident:
              mergedWithRecord.fields.linked_incident || "none",
          });

          // If the merged record already has an incident, use that
          if (
            mergedWithRecord.fields.has_incident &&
            mergedWithRecord.fields.linked_incident &&
            mergedWithRecord.fields.linked_incident.length > 0
          ) {
            // Get the incident from the merged record
            const incidentResponse = await axios({
              method: "get",
              url: `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident/${mergedWithRecord.fields.linked_incident[0]}`,
              headers,
            });

            if (incidentResponse.data) {
              log.info("Found existing incident via merge chain", {
                incidentId: incidentResponse.data.id,
                title: incidentResponse.data.fields.title,
              });

              // Link this record to the same incident
              await axios.patch(
                `${rawDataUrl}/${recordToProcess.id}`,
                {
                  fields: {
                    has_incident: true,
                    processing_status: "Complete",
                    processing_notes: `Linked to existing incident via merge chain at ${new Date().toISOString()}`,
                    linked_incident: [incidentResponse.data.id],
                    last_processed: new Date().toISOString(),
                  },
                },
                { headers }
              );

              log.info("Successfully linked to incident via merge chain");
              console.log("Successfully linked to incident via merge chain");
              return; // Exit early, we're done
            }
          }
        }
      } catch (error) {
        log.error("Error checking merge chain", { error: error.message });
      }
    }

    // Before creating a new incident, check if a similar one already exists
    const existingIncident = await findSimilarExistingIncident(
      recordToProcess.fields.date,
      recordToProcess.fields.latitude,
      recordToProcess.fields.longitude,
      recordToProcess.fields.vessel_name,
      headers
    );

    log.info("Similar incident check result", {
      foundSimilarIncident: !!existingIncident,
      similarIncidentId: existingIncident ? existingIncident.id : null,
    });
    console.log("Similar incident check result:", {
      foundSimilarIncident: !!existingIncident,
      similarIncidentId: existingIncident ? existingIncident.id : null,
    });

    let incidentId = null;

    if (existingIncident) {
      // Update the existing incident with any new information
      log.info("Found similar existing incident", {
        incidentId: existingIncident.id,
        title: existingIncident.fields.title,
      });
      console.log("Found similar existing incident:", existingIncident.id);

      // Prepare fields to update - only update fields that add information
      const updateFields = {};

      // Check if we have an enhanced description that's worth using
      if (
        enrichedData.description &&
        (!existingIncident.fields.description ||
          enrichedData.description.length >
            existingIncident.fields.description.length * 1.2)
      ) {
        // Only update if the description is missing or our enhanced version is significantly more detailed (20% longer)
        updateFields.description = enrichedData.description;
        console.log("Adding enhanced description to existing incident");
      }

      // Check if enriched data provides better analysis/recommendations
      if (!existingIncident.fields.analysis && enrichedData.analysis) {
        updateFields.analysis = enrichedData.analysis;
      }

      if (
        !existingIncident.fields.recommendations &&
        enrichedData.recommendations
      ) {
        updateFields.recommendations = enrichedData.recommendations;
      }

      // Update number_of_attackers if we have that info and existing doesn't
      if (
        !existingIncident.fields.number_of_attackers &&
        enrichedData.number_of_attackers
      ) {
        updateFields.number_of_attackers = enrichedData.number_of_attackers;
      }

      // Add weapons_used if existing incident doesn't have any
      if (
        (!existingIncident.fields.weapons_used ||
          existingIncident.fields.weapons_used.length === 0) &&
        weaponsUsedIds.length > 0
      ) {
        updateFields.weapons_used = weaponsUsedIds;
      }

      // Add items_stolen if existing incident doesn't have any
      if (
        (!existingIncident.fields.items_stolen ||
          existingIncident.fields.items_stolen.length === 0) &&
        itemsStolenIds.length > 0
      ) {
        updateFields.items_stolen = itemsStolenIds;
      }

      // Add response_type if existing incident doesn't have any
      if (
        (!existingIncident.fields.response_type ||
          existingIncident.fields.response_type.length === 0) &&
        responseTypeIds.length > 0
      ) {
        updateFields.response_type = responseTypeIds;
      }

      // Add authorities_notified if existing incident doesn't have any
      if (
        (!existingIncident.fields.authorities_notified ||
          existingIncident.fields.authorities_notified.length === 0) &&
        authoritiesNotifiedIds.length > 0
      ) {
        updateFields.authorities_notified = authoritiesNotifiedIds;
      }

      // Update incident_type_name if needed
      if (
        (!existingIncident.fields.incident_type_name ||
          existingIncident.fields.incident_type_name.length === 0) &&
        incidentTypeId
      ) {
        updateFields.incident_type_name = [incidentTypeId];
      }

      // Only update if we have new information to add
      if (Object.keys(updateFields).length > 0) {
        console.log(
          "Updating existing incident with additional information:",
          updateFields
        );

        // Update the incident record
        await axios.patch(
          `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident/${existingIncident.id}`,
          { fields: updateFields },
          { headers }
        );

        console.log("Updated existing incident record with new information");
      } else {
        console.log("No new information to add to existing incident");
      }

      // Store the incident ID for linking
      incidentId = existingIncident.id;
    } else {
      // Create a new incident if no similar one exists
      const incidentFields = {
        title: enrichedData.title, // Use the LLM-generated title
        description:
          enrichedData.description ||
          recordToProcess.fields.description ||
          "No description available",
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

      console.log("Creating new incident with fields:", {
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

      console.log("Created new incident record:", {
        incidentId: incidentResponse.data.id,
      });

      // Store the incident ID for linking
      incidentId = incidentResponse.data.id;
    }

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
    let incidentVesselLinkCreated = false;
    if (incidentId && vesselId) {
      try {
        // Import vessel utilities
        const { determineVesselStatus } = await import(
          "./utils/vessel-utils.js"
        );

        // Determine vessel status using the standardized utility function
        const vesselStatus = determineVesselStatus(
          recordToProcess.fields.vessel_status ||
            recordToProcess.fields.description ||
            "underway" // Default to underway if no status info available
        );

        console.log("Determined vessel status:", vesselStatus);

        // Prepare the data with arrays for link fields and extracted single select values
        const incidentVesselData = {
          fields: {
            // Use the standardized incidentId variable
            incident_id: [incidentId],
            vessel_id: [vesselId],
            // Validate vessel status against allowed values
            vessel_status_during_incident: [
              "Underway",
              "Anchored",
              "Moored",
              "Berthed",
              "Under Tow",
              "Not Under Command",
              "Operating",
              "Other",
            ].includes(vesselStatus)
              ? vesselStatus
              : "Other",
            vessel_role: "Target",
          },
        };

        // Log all the data we have before attempting to create the link
        console.log("Creating incident_vessel link with:", {
          incidentId,
          vesselId,
          vesselStatus,
          rawData: {
            vessel_name: recordToProcess.fields.vessel_name,
            vessel_status: recordToProcess.fields.vessel_status,
            has_description: !!recordToProcess.fields.description,
          },
        });

        console.log(
          "Full incident_vessel data:",
          JSON.stringify(incidentVesselData, null, 2)
        );

        try {
          // First verify both IDs exist before attempting to create the link
          const [incidentCheck, vesselCheck] = await Promise.all([
            axios.get(
              `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident/${incidentId}`,
              { headers }
            ),
            axios.get(
              `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel/${vesselId}`,
              { headers }
            ),
          ]);

          if (incidentCheck.data && vesselCheck.data) {
            const incidentVesselResponse = await axios.post(
              incidentVesselUrl,
              incidentVesselData,
              { headers }
            );

            console.log("Successfully created incident_vessel link:", {
              linkId: incidentVesselResponse.data.id,
              incidentId,
              vesselId,
              status: vesselStatus,
            });

            // Mark success and set the flag
            incidentVesselLinkCreated = true;
          } else {
            console.error("Failed to verify incident or vessel existence:", {
              hasIncident: !!incidentCheck.data,
              hasVessel: !!vesselCheck.data,
            });
          }
        } catch (postError) {
          console.error("Failed to create incident_vessel link:", {
            error: postError.message,
            status: postError.response?.status,
            data: postError.response?.data,
            incidentId,
            vesselId,
          });
          // Don't throw, try to recover
          console.log("Attempting recovery with minimal fields...");
        }
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

          // Try up to 3 times with exponential backoff
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`Recovery attempt ${attempt}/3...`);

              // Wait with exponential backoff
              await new Promise((resolve) =>
                setTimeout(resolve, attempt * 1000)
              );

              const minimalData = {
                fields: {
                  incident_id: [incidentId],
                  vessel_id: [vesselId],
                },
              };

              const minResponse = await axios.post(
                incidentVesselUrl,
                minimalData,
                { headers }
              );

              console.log(
                `Successfully created incident_vessel link on attempt ${attempt}:`,
                {
                  linkId: minResponse.data.id,
                  incidentId,
                  vesselId,
                }
              );

              // Success, mark the link as created and break out of the retry loop
              incidentVesselLinkCreated = true;
              break;
            } catch (retryError) {
              console.error(`Recovery attempt ${attempt} failed:`, {
                error: retryError.message,
                status: retryError.response?.status,
                data: retryError.response?.data,
              });

              if (attempt === 3) {
                // Log final failure after all retries
                console.error(
                  "All recovery attempts failed for incident_vessel link",
                  {
                    incidentId,
                    vesselId,
                    error: retryError.message,
                  }
                );
              }
            }
          }
        }
      }
    }

    // Only mark the raw data record as processed if we either:
    // 1. Successfully created both incident and incident_vessel link, or
    // 2. Successfully created incident but there was no vessel data to link
    if (incidentId && (!vesselId || incidentVesselLinkCreated)) {
      try {
        await axios.patch(
          `${rawDataUrl}/${recordToProcess.id}`,
          {
            fields: {
              has_incident: true,
              processing_status: "Complete",
              processing_notes: `Successfully processed at ${new Date().toISOString()}${existingIncident ? " (linked to existing incident)" : " (created new incident)"}`,
              linked_incident: [incidentId],
              last_processed: new Date().toISOString(),
            },
          },
          { headers }
        );
      } catch (updateError) {
        console.error(
          "Failed to update raw_data record status:",
          updateError.message
        );

        // Try to reset the processing status on error
        try {
          await axios.patch(
            `${rawDataUrl}/${recordToProcess.id}`,
            {
              fields: {
                processing_status: "pending",
                processing_notes: `Processing error at ${new Date().toISOString()}: ${updateError.message}`,
              },
            },
            { headers }
          );
        } catch (resetError) {
          console.error(
            "Failed to reset processing status:",
            resetError.message
          );
        }
      }
    } else {
      console.error("Cannot mark record as processed:", {
        hasIncidentId: !!incidentId,
        hasVesselId: !!vesselId,
        incidentVesselLinkCreated,
      });

      // Reset the record to pending state since processing failed
      try {
        await axios.patch(
          `${rawDataUrl}/${recordToProcess.id}`,
          {
            fields: {
              processing_status: "pending",
              processing_notes: `Processing failed at ${new Date().toISOString()}: Failed to create incident_vessel link`,
              last_processed: new Date().toISOString(),
            },
          },
          { headers }
        );
      } catch (resetError) {
        console.error("Failed to reset processing status:", resetError.message);
      }
    }

    console.log(
      `Marked record as processed and linked to ${existingIncident ? "existing" : "new"} incident ${incidentId}`
    );
    log.info(`Raw data record processed and linked to incident`, {
      rawDataId: recordToProcess.id,
      incidentId,
      isExistingIncident: !!existingIncident,
    });
    console.log("Background processing completed successfully");
    log.info("Background processing completed successfully", {
      linkedToExistingIncident: !!existingIncident,
    });

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

    // If we were processing a specific record when the error occurred, reset its status
    if (recordToProcess && recordToProcess.id) {
      try {
        console.log(
          `Attempting to reset record ${recordToProcess.id} due to processing error`
        );

        const headers = {
          Authorization: `Bearer ${process.env.AT_API_KEY}`,
          "Content-Type": "application/json",
        };

        const rawDataUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;

        await axios.patch(
          `${rawDataUrl}/${recordToProcess.id}`,
          {
            fields: {
              processing_status: "pending",
              processing_notes: `Processing error at ${new Date().toISOString()}: ${error.message}`,
              last_processed: new Date().toISOString(),
            },
          },
          { headers }
        );

        console.log(
          `Successfully reset record ${recordToProcess.id} to pending state`
        );
      } catch (resetError) {
        console.error(
          `Failed to reset record ${recordToProcess.id}:`,
          resetError.message
        );
      }
    }
  }
};

/**
 * Find similar existing incidents based on time, location, and vessel information
 * @param {string} date The date/time of the incident
 * @param {string|number} latitude The latitude of the incident
 * @param {string|number} longitude The longitude of the incident
 * @param {string|null} vesselName The name of the vessel (if available)
 * @param {Object} headers HTTP headers for Airtable API requests
 * @returns {Object|null} The similar incident if found, null otherwise
 */
async function findSimilarExistingIncident(
  date,
  latitude,
  longitude,
  vesselName,
  headers
) {
  if (!date || !latitude || !longitude) {
    log.info("Cannot search for similar incidents: Missing required fields", {
      hasDate: !!date,
      hasLatitude: !!latitude,
      hasLongitude: !!longitude,
    });
    return null;
  }

  try {
    log.info("Searching for similar existing incidents", {
      date,
      latitude,
      longitude,
      vesselName: vesselName || "Not available",
    });

    // First get recent incidents within a wider time range (5 days before and after)
    // This limits the number of records we need to analyze in detail
    const incidentDate = new Date(date);

    // Create date range for preliminary filter (5 days before and after)
    const startDate = new Date(incidentDate);
    startDate.setDate(startDate.getDate() - 5);

    const endDate = new Date(incidentDate);
    endDate.setDate(endDate.getDate() + 5);

    const dateFilter = `AND(
      {date_time_utc} >= '${startDate.toISOString()}',
      {date_time_utc} <= '${endDate.toISOString()}'
    )`;

    // Fetch recent incidents within the time range
    const response = await axios.get(
      `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/incident`,
      {
        headers,
        params: {
          filterByFormula: dateFilter,
          sort: [{ field: "date_time_utc", direction: "desc" }],
        },
      }
    );

    if (!response.data.records || response.data.records.length === 0) {
      log.info("No incidents found within the time range", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return null;
    }

    log.info(
      `Found ${response.data.records.length} incidents within the preliminary time range`
    );

    // Now analyze each incident for similarity
    const incidents = response.data.records;
    let bestMatch = null;
    let highestScore = 0;

    for (const incident of incidents) {
      try {
        // First check essential fields are present
        if (
          !incident.fields.date_time_utc ||
          !incident.fields.latitude ||
          !incident.fields.longitude
        ) {
          continue;
        }

        // Calculate time proximity score (1.0 = same time, 0.0 = 48+ hours apart)
        const timeScore = calculateTimeProximityScore(
          date,
          incident.fields.date_time_utc
        );

        // Skip if the time difference is too large
        if (timeScore === 0) {
          continue;
        }

        // Calculate spatial proximity score (1.0 = same location, 0.0 = 50+ km apart)
        const spatialScore = calculateSpatialProximityScore(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(incident.fields.latitude),
          parseFloat(incident.fields.longitude)
        );

        // Skip if the spatial difference is too large
        if (spatialScore === 0) {
          continue;
        }

        // Calculate vessel similarity if vessel name is available
        let vesselScore = 0.5; // Default to neutral if we can't compare vessel names
        let vesselMatch = false; // Track if vessels specifically match

        if (vesselName && incident.fields.title) {
          // Extract vessel name from the incident title as a fallback
          // Many incident titles contain the vessel name
          vesselScore = calculateVesselNameSimilarity(
            vesselName,
            incident.fields.title
          );

          // If vessel score is high, consider it a vessel match
          vesselMatch = vesselScore > 0.8;
        }

        // Check if incident types match (if we have that information)
        let typeMatch = false;
        let typeInfo = {};

        if (
          recordToProcess.fields.incident_type_name &&
          incident.fields.incident_type_name
        ) {
          // Direct comparison of incident types (case-insensitive)
          const newType =
            recordToProcess.fields.incident_type_name.toLowerCase();
          const existingType = Array.isArray(incident.fields.incident_type_name)
            ? incident.fields.incident_type_name[0]?.toLowerCase()
            : incident.fields.incident_type_name.toLowerCase();

          typeMatch = newType === existingType;

          typeInfo = {
            newType,
            existingType,
            match: typeMatch,
          };

          // If types match exactly, increase confidence
          if (typeMatch) {
            vesselScore = Math.max(vesselScore, 0.6); // Boost vessel score slightly if type matches
          }
        }

        // Check if this is likely the same incident
        // For busy shipping areas like Singapore Strait, we need to be more careful

        // HIGH CONFIDENCE MATCH CRITERIA:
        // 1. Very close in time (within 12 hours) AND very close in space (within 5km) AND same/similar vessel
        // 2. Exact vessel match AND reasonably close in time and space
        // 3. Perfect time/location match with exact same details
        // 4. Types match exactly with good time/space correlation
        // 5. Very strong spatial match (within 2km) with reasonable time
        // 6. Same location name with good time/space correlation
        // 7. Matching stolen items or incident details
        let isSameIncident = false;

        // Case 1: Very close in time/space with vessel confirmation when available
        if (timeScore > 0.75 && spatialScore > 0.9 && vesselScore >= 0.7) {
          isSameIncident = true;
          log.info("Match case 1: Close time/space with vessel confirmation", {
            timeScore,
            spatialScore,
            vesselScore,
          });
        }

        // Case 2: Strong vessel match with reasonable time/space correlation
        if (vesselMatch && timeScore > 0.5 && spatialScore > 0.7) {
          isSameIncident = true;
          log.info("Match case 2: Strong vessel match with good time/space", {
            timeScore,
            spatialScore,
            vesselMatch,
          });
        }

        // Case 3: Perfect time/location match (exact same coordinates and timestamp)
        // This happens when the same incident is reported by different sources with exactly the same details
        if (timeScore > 0.95 && spatialScore > 0.95) {
          isSameIncident = true;
          log.info("Match case 3: Perfect time/location match", {
            timeScore,
            spatialScore,
          });
        }

        // Case 4: Type match with reasonable time/space correlation
        // If incident types match exactly, with good time/space correlation, it's likely the same incident
        if (typeMatch && timeScore > 0.6 && spatialScore > 0.7) {
          isSameIncident = true;
          log.info("Match case 4: Type match with good time/space", {
            timeScore,
            spatialScore,
            typeMatch,
          });
        }

        // Case 5: Very strong spatial match (within 2km) and reasonable time match (within 24 hours)
        // This is a more lenient version of Case 3 that doesn't require perfect matches
        if (spatialScore > 0.95 && timeScore > 0.6) {
          isSameIncident = true;
          log.info("Match case 5: Very strong location match with good time", {
            timeScore,
            spatialScore,
          });
        }

        // Case 6: Same location name, similar time, and in Singapore Strait (common area with many incidents)
        let locationNameMatch = false;
        if (recordToProcess.fields.location && incident.fields.location_name) {
          // Normalize location names for comparison
          const loc1 = recordToProcess.fields.location
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
          const loc2 = incident.fields.location_name
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

          // Check for substring match or direct match
          if (
            loc1.includes(loc2) ||
            loc2.includes(loc1) ||
            loc1 === loc2 ||
            // Handle common variations
            (loc1.includes("singapore") && loc2.includes("singapore"))
          ) {
            locationNameMatch = true;
          }
        }

        if (locationNameMatch && timeScore > 0.7 && spatialScore > 0.6) {
          isSameIncident = true;
          log.info("Match case 6: Location name match with good time/space", {
            timeScore,
            spatialScore,
            locationNameMatch,
          });
        }

        // Case 7: Check for mention of specific stolen items (like air compressor, padlocks)
        let stolenItemsMatch = false;
        if (recordToProcess.fields.description && incident.fields.description) {
          const recordDesc = recordToProcess.fields.description.toLowerCase();
          const incidentDesc = incident.fields.description.toLowerCase();

          // Common stolen items/equipment in maritime incidents
          const stolenItemPatterns = [
            /air\s*compressor/i,
            /breathing\s*apparatus/i,
            /padlocks?/i,
            /engine\s*spares/i,
            /ship'?s\s*equipment/i,
          ];

          // Check if both descriptions mention the same stolen item
          for (const pattern of stolenItemPatterns) {
            if (pattern.test(recordDesc) && pattern.test(incidentDesc)) {
              stolenItemsMatch = true;
              log.info("Found matching stolen items in descriptions", {
                pattern: pattern.toString(),
              });
              break;
            }
          }
        }

        if (stolenItemsMatch && timeScore > 0.5 && spatialScore > 0.5) {
          isSameIncident = true;
          log.info(
            "Match case 7: Matching stolen items with reasonable time/space",
            {
              timeScore,
              spatialScore,
              stolenItemsMatch,
            }
          );
        }

        // SAFEGUARD: Check for potential separate incidents on the same vessel
        // If vessel names match perfectly but time is too different (more than 5 days apart)
        // and locations are very different, these are likely separate incidents
        if (vesselMatch && timeScore < 0.2 && spatialScore < 0.3) {
          log.info(
            "Detected potentially separate incidents on the same vessel",
            {
              vesselName,
              timeScore,
              spatialScore,
              newDate: date,
              existingDate: incident.fields.date_time_utc,
              newLocation: `${latitude},${longitude}`,
              existingLocation: `${incident.fields.latitude},${incident.fields.longitude}`,
            }
          );

          // Override the same incident flag
          isSameIncident = false;
        }

        // Calculate composite score with weights:
        // - Time: 35%
        // - Location: 35%
        // - Vessel: 30% (increased importance)
        const totalScore =
          timeScore * 0.35 + spatialScore * 0.35 + vesselScore * 0.3;

        log.info("Incident similarity calculation", {
          incidentId: incident.id,
          timeScore,
          spatialScore,
          vesselScore,
          totalScore,
          isSameIncident,
          typeMatch,
          ...(Object.keys(typeInfo).length > 0 ? { typeInfo } : {}),
        });

        // Consider as a potential match if it's the same incident or has a very high score
        // Require a higher threshold (0.75) to avoid false positives
        if (
          (isSameIncident || totalScore >= 0.75) &&
          totalScore > highestScore
        ) {
          highestScore = totalScore;
          bestMatch = incident;
        }
      } catch (error) {
        log.error(`Error analyzing incident ${incident.id}`, error);
      }
    }

    if (bestMatch) {
      log.info("Found similar existing incident", {
        incidentId: bestMatch.id,
        similarityScore: highestScore,
      });
      return bestMatch;
    }

    log.info("No similar incidents found");
    return null;
  } catch (error) {
    log.error("Error finding similar incidents", error);
    return null;
  }
}

// Helper function to check if more records exist to process
async function checkMoreRecordsExist(rawDataUrl, headers) {
  try {
    // Check for new unprocessed records
    const newRecordsResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        view: "Process",
        filterByFormula: `NOT({has_incident})`,
        maxRecords: 1,
      },
    });

    if (newRecordsResponse.data.records.length > 0) {
      return true;
    }

    // Check for merged records that need linking
    const mergedRecordsResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        view: "Process",
        filterByFormula: `AND({processing_status} = 'Merged', {merge_status} = 'merged_into', {merged_into}, NOT({has_incident}))`,
        maxRecords: 1,
      },
    });

    if (mergedRecordsResponse.data.records.length > 0) {
      return true;
    }

    // Check for updated records that need reprocessing
    try {
      const updatedRecordsResponse = await axios({
        method: "get",
        url: rawDataUrl,
        headers,
        params: {
          view: "Process",
          filterByFormula: `AND({has_incident}, {processing_status} = 'Complete', {updated_at}, {last_processed}, IS_AFTER({updated_at}, {last_processed}))`,
          maxRecords: 1,
        },
      });

      if (updatedRecordsResponse.data.records.length > 0) {
        return true;
      }
    } catch (updateError) {
      // This is normal if the fields don't exist
      console.log("Could not check for updated records:", updateError.message);
    }

    return false;
  } catch (error) {
    console.error("Error checking for more records", error.message);
    return false;
  }
}

// Helper function to reset records that have been stuck in "Processing" state for too long
async function resetStuckProcessingRecords() {
  try {
    console.log("Checking for stuck records in 'Processing' state...");

    const headers = {
      Authorization: `Bearer ${process.env.AT_API_KEY}`,
      "Content-Type": "application/json",
    };

    const rawDataUrl = `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/raw_data`;

    // Look for records that have been in "Processing" state for more than 30 minutes
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const stuckRecordsResponse = await axios({
      method: "get",
      url: rawDataUrl,
      headers,
      params: {
        filterByFormula: `AND({processing_status} = 'Processing', IS_BEFORE({last_processed}, '${thirtyMinutesAgo.toISOString()}'))`,
        maxRecords: 10, // Limit to 10 records at a time to avoid overloading
      },
    });

    const stuckRecords = stuckRecordsResponse.data.records;

    if (stuckRecords.length === 0) {
      console.log("No stuck records found.");
      return;
    }

    console.log(
      `Found ${stuckRecords.length} records stuck in 'Processing' state.`
    );

    // Reset each stuck record to "pending" state
    for (const record of stuckRecords) {
      try {
        await axios.patch(
          `${rawDataUrl}/${record.id}`,
          {
            fields: {
              processing_status: "pending",
              processing_notes: `Reset from 'Processing' state at ${new Date().toISOString()} (was stuck for >30 minutes)`,
            },
          },
          { headers }
        );

        console.log(`Reset stuck record ${record.id} to 'pending' state.`);
      } catch (error) {
        console.error(
          `Failed to reset stuck record ${record.id}:`,
          error.message
        );
      }
    }

    return stuckRecords.length;
  } catch (error) {
    console.error("Error resetting stuck records:", error.message);
    return 0;
  }
}

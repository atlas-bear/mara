import axios from "axios";
import { calculateTimeProximityScore, calculateSpatialProximityScore } from "./utils/spatial-utils.js";
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

      // Import the centralized LLM service
      const { callClaudeWithPrompt } = await import("./utils/llm-service.js");

      // Prepare the data for the prompt
      const promptData = {
        recordFields: recordToProcess.fields
      };

      // Call Claude using the centralized service
      console.log("Using centralized prompts system with descriptionEnhancement prompt");
      const enhancedResult = await callClaudeWithPrompt("descriptionEnhancement", promptData);
      
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
        description: enhancedResult.description || recordToProcess.fields.description,
        analysis: enhancedResult.analysis || enrichedData.analysis,
        recommendations: enhancedResult.recommendations || enrichedData.recommendations,
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
        wasEnhanced: !!enhancedResult.description
      });

      console.log(
        "Successfully processed Claude response with generated title"
      );
      console.log("Generated title:", enrichedData.title);
      console.log("Extracted location:", enrichedData.location);
      console.log("Identified weapons:", enrichedData.weapons_used);
    } catch (claudeError) {
      console.error("Error calling Claude API through centralized prompt system:", claudeError.message);
      console.error("This may be due to API issues or problems with the prompt configuration");
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
        title: existingIncident.fields.title
      });
      console.log("Found similar existing incident:", existingIncident.id);

      // Prepare fields to update - only update fields that add information
      const updateFields = {};
      
      // Check if we have an enhanced description that's worth using
      if (enrichedData.description && 
          (!existingIncident.fields.description || 
           enrichedData.description.length > existingIncident.fields.description.length * 1.2)) {
        // Only update if the description is missing or our enhanced version is significantly more detailed (20% longer)
        updateFields.description = enrichedData.description;
        console.log("Adding enhanced description to existing incident");
      }
      
      // Check if enriched data provides better analysis/recommendations
      if (!existingIncident.fields.analysis && enrichedData.analysis) {
        updateFields.analysis = enrichedData.analysis;
      }
      
      if (!existingIncident.fields.recommendations && enrichedData.recommendations) {
        updateFields.recommendations = enrichedData.recommendations;
      }
      
      // Update number_of_attackers if we have that info and existing doesn't
      if (!existingIncident.fields.number_of_attackers && enrichedData.number_of_attackers) {
        updateFields.number_of_attackers = enrichedData.number_of_attackers;
      }

      // Add weapons_used if existing incident doesn't have any
      if ((!existingIncident.fields.weapons_used || existingIncident.fields.weapons_used.length === 0) && 
          weaponsUsedIds.length > 0) {
        updateFields.weapons_used = weaponsUsedIds;
      }

      // Add items_stolen if existing incident doesn't have any
      if ((!existingIncident.fields.items_stolen || existingIncident.fields.items_stolen.length === 0) && 
          itemsStolenIds.length > 0) {
        updateFields.items_stolen = itemsStolenIds;
      }

      // Add response_type if existing incident doesn't have any
      if ((!existingIncident.fields.response_type || existingIncident.fields.response_type.length === 0) && 
          responseTypeIds.length > 0) {
        updateFields.response_type = responseTypeIds;
      }

      // Add authorities_notified if existing incident doesn't have any
      if ((!existingIncident.fields.authorities_notified || existingIncident.fields.authorities_notified.length === 0) && 
          authoritiesNotifiedIds.length > 0) {
        updateFields.authorities_notified = authoritiesNotifiedIds;
      }

      // Update incident_type_name if needed
      if ((!existingIncident.fields.incident_type_name || existingIncident.fields.incident_type_name.length === 0) && 
          incidentTypeId) {
        updateFields.incident_type_name = [incidentTypeId];
      }

      // Only update if we have new information to add
      if (Object.keys(updateFields).length > 0) {
        console.log("Updating existing incident with additional information:", updateFields);
        
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
          enrichedData.description || recordToProcess.fields.description || "No description available",
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
    if (incidentId && vesselId) {
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
            vessel_role: "Target", // Default value
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
    try {
      await axios.patch(
        `${rawDataUrl}/${recordToProcess.id}`,
        {
          fields: {
            has_incident: true,
            processing_status: "Complete",
            processing_notes: `Successfully processed at ${new Date().toISOString()}${existingIncident ? ' (linked to existing incident)' : ' (created new incident)'}`,
            linked_incident: [incidentId],
            last_processed: new Date().toISOString(),
          },
        },
        { headers }
      );
    } catch (updateError) {
      console.error("Failed to update raw_data record status:", updateError.message);
      
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
        console.error("Failed to reset processing status:", resetError.message);
      }
    }

    console.log(`Marked record as processed and linked to ${existingIncident ? 'existing' : 'new'} incident ${incidentId}`);
    log.info(`Raw data record processed and linked to incident`, {
      rawDataId: recordToProcess.id,
      incidentId,
      isExistingIncident: !!existingIncident
    });
    console.log("Background processing completed successfully");
    log.info("Background processing completed successfully", {
      linkedToExistingIncident: !!existingIncident
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
        console.log(`Attempting to reset record ${recordToProcess.id} due to processing error`);
        
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
        
        console.log(`Successfully reset record ${recordToProcess.id} to pending state`);
      } catch (resetError) {
        console.error(`Failed to reset record ${recordToProcess.id}:`, resetError.message);
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
async function findSimilarExistingIncident(date, latitude, longitude, vesselName, headers) {
  if (!date || !latitude || !longitude) {
    log.info("Cannot search for similar incidents: Missing required fields", {
      hasDate: !!date,
      hasLatitude: !!latitude,
      hasLongitude: !!longitude
    });
    return null;
  }

  try {
    log.info("Searching for similar existing incidents", {
      date,
      latitude,
      longitude,
      vesselName: vesselName || "Not available"
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
          sort: [{ field: "date_time_utc", direction: "desc" }]
        }
      }
    );
    
    if (!response.data.records || response.data.records.length === 0) {
      log.info("No incidents found within the time range", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      return null;
    }
    
    log.info(`Found ${response.data.records.length} incidents within the preliminary time range`);
    
    // Now analyze each incident for similarity
    const incidents = response.data.records;
    let bestMatch = null;
    let highestScore = 0;
    
    for (const incident of incidents) {
      try {
        // First check essential fields are present
        if (!incident.fields.date_time_utc || !incident.fields.latitude || !incident.fields.longitude) {
          continue;
        }
        
        // Calculate time proximity score (1.0 = same time, 0.0 = 48+ hours apart)
        const timeScore = calculateTimeProximityScore(date, incident.fields.date_time_utc);
        
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
          vesselScore = calculateVesselNameSimilarity(vesselName, incident.fields.title);
          
          // If vessel score is high, consider it a vessel match
          vesselMatch = vesselScore > 0.8;
        }
        
        // Check if incident types match (if we have that information)
        let typeMatch = false;
        let typeInfo = {};
        
        if (recordToProcess.fields.incident_type_name && incident.fields.incident_type_name) {
          // Direct comparison of incident types (case-insensitive)
          const newType = recordToProcess.fields.incident_type_name.toLowerCase();
          const existingType = Array.isArray(incident.fields.incident_type_name) 
            ? incident.fields.incident_type_name[0]?.toLowerCase() 
            : incident.fields.incident_type_name.toLowerCase();
          
          typeMatch = newType === existingType;
          
          typeInfo = {
            newType,
            existingType,
            match: typeMatch
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
        let isSameIncident = false;
        
        // Case 1: Very close in time/space with vessel confirmation when available
        if (timeScore > 0.75 && spatialScore > 0.9 && vesselScore >= 0.7) {
          isSameIncident = true;
        }
        
        // Case 2: Strong vessel match with reasonable time/space correlation
        if (vesselMatch && timeScore > 0.5 && spatialScore > 0.7) {
          isSameIncident = true;
        }
        
        // Case 3: Perfect time/location match (exact same coordinates and timestamp)
        // This happens when the same incident is reported by different sources with exactly the same details
        if (timeScore > 0.95 && spatialScore > 0.95) {
          isSameIncident = true;
        }
        
        // Case 4: Type match with reasonable time/space correlation
        // If incident types match exactly, with good time/space correlation, it's likely the same incident
        if (typeMatch && timeScore > 0.6 && spatialScore > 0.7) {
          isSameIncident = true;
        }
        
        // SAFEGUARD: Check for potential separate incidents on the same vessel
        // If vessel names match perfectly but time is too different (more than 5 days apart)
        // and locations are very different, these are likely separate incidents
        if (vesselMatch && timeScore < 0.2 && spatialScore < 0.3) {
          log.info("Detected potentially separate incidents on the same vessel", {
            vesselName,
            timeScore,
            spatialScore,
            newDate: date,
            existingDate: incident.fields.date_time_utc,
            newLocation: `${latitude},${longitude}`,
            existingLocation: `${incident.fields.latitude},${incident.fields.longitude}`
          });
          
          // Override the same incident flag
          isSameIncident = false;
        }
        
        // Calculate composite score with weights:
        // - Time: 35%
        // - Location: 35%
        // - Vessel: 30% (increased importance)
        const totalScore = timeScore * 0.35 + spatialScore * 0.35 + vesselScore * 0.3;
        
        log.info("Incident similarity calculation", {
          incidentId: incident.id,
          timeScore,
          spatialScore,
          vesselScore,
          totalScore,
          isSameIncident,
          typeMatch,
          ...(Object.keys(typeInfo).length > 0 ? { typeInfo } : {})
        });
        
        // Consider as a potential match if it's the same incident or has a very high score
        // Require a higher threshold (0.75) to avoid false positives
        if ((isSameIncident || totalScore >= 0.75) && totalScore > highestScore) {
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
        similarityScore: highestScore
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
    
    console.log(`Found ${stuckRecords.length} records stuck in 'Processing' state.`);
    
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
        console.error(`Failed to reset stuck record ${record.id}:`, error.message);
      }
    }
    
    return stuckRecords.length;
  } catch (error) {
    console.error("Error resetting stuck records:", error.message);
    return 0;
  }
}

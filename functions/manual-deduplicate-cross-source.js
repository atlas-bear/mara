/**
 * Manual Cross-Source Deduplication Function
 *
 * Exact copy of deduplicate-cross-source-background.js that can be triggered manually
 * to diagnose issues with the background function. This function performs the full
 * deduplication process and triggers process-raw-data-background just like the
 * scheduled background function.
 */
import axios from "axios";
import { log } from "./utils/logger.js";
import {
  calculateSimilarityScore,
  determinePrimaryRecord,
  mergeComplementaryData,
} from "./utils/deduplication-utils.js";

/**
 * Main deduplication function that can be triggered via HTTP request
 * Identical to the background function's implementation
 */
export const handler = async (req, context) => {
  log.info("Manual Cross-Source Deduplication Function started", {
    time: new Date().toISOString(),
  });

  // Process parameters - potentially passed via querystring in manual triggering
  const dryRun = req.queryStringParameters?.dryRun === "true";
  const confidenceThreshold =
    parseFloat(req.queryStringParameters?.confidenceThreshold) || 0.7; // Lower threshold to catch more matches
  const maxRecords = parseInt(req.queryStringParameters?.maxRecords) || 100;

  log.info("Configuration", {
    dryRun,
    confidenceThreshold,
    maxRecords,
  });

  try {
    // Set up Airtable API parameters
    const airtableBaseId = process.env.AT_BASE_ID_CSER;
    const airtableApiKey = process.env.AT_API_KEY;

    if (!airtableBaseId || !airtableApiKey) {
      throw new Error(
        "Missing required environment variables: Airtable API key or Base ID"
      );
    }

    const headers = {
      Authorization: `Bearer ${airtableApiKey}`,
      "Content-Type": "application/json",
    };

    // Get recent raw_data records from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoString = thirtyDaysAgo.toISOString();

    log.info("Fetching recent raw_data records", {
      since: thirtyDaysAgoString,
    });

    // Use pagination to handle large datasets
    let rawDataRecords = [];
    let offset = null;

    do {
      // Construct filter formula
      const filterFormula = `AND(
      IS_AFTER({date}, '${thirtyDaysAgoString}'),
      OR(
        NOT({merge_status}),
        {merge_status} = ''
      )
    )`;

      log.info("Querying Airtable with filter:", {
        filterFormula,
        thirtyDaysAgo: thirtyDaysAgoString,
      });

      const params = {
        filterByFormula: filterFormula,
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: maxRecords,
        ...(offset ? { offset } : {}),
      };

      // First check what records exist without any filter
      const checkResponse = await axios.get(
        `https://api.airtable.com/v0/${airtableBaseId}/raw_data`,
        {
          headers,
          params: {
            maxRecords: 10,
            sort: [{ field: "date", direction: "desc" }],
          },
        }
      );

      log.info("Sample of recent records:", {
        count: checkResponse.data.records.length,
        records: checkResponse.data.records.map((r) => ({
          id: r.id,
          date: r.fields.date,
          merge_status: r.fields.merge_status || "not set",
          has_incident: r.fields.has_incident || false,
        })),
      });

      // Now get records with our filter
      const response = await axios.get(
        `https://api.airtable.com/v0/${airtableBaseId}/raw_data`,
        { headers, params }
      );

      rawDataRecords = [...rawDataRecords, ...response.data.records];
      offset = response.data.offset;

      log.info(`Fetched ${response.data.records.length} records`, {
        total: rawDataRecords.length,
        hasMore: !!offset,
      });

      // Break if we've reached the maximum number of records to process
      if (rawDataRecords.length >= maxRecords) {
        log.info(`Reached maximum record limit (${maxRecords})`);
        break;
      }
    } while (offset);

    log.info(`Retrieved ${rawDataRecords.length} records for processing`);

    // Skip processing if no records found
    if (rawDataRecords.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "No records found for deduplication",
        }),
      };
    }

    // Initialize counters for stats
    let potentialMatchesCount = 0;
    let highConfidenceMatches = 0;
    let mediumConfidenceMatches = 0;
    let mergedRecords = 0;

    // Group records by source to ensure we only compare across different sources
    const recordsBySource = {};
    rawDataRecords.forEach((record) => {
      const source = record.fields.source;
      if (!recordsBySource[source]) {
        recordsBySource[source] = [];
      }
      recordsBySource[source].push(record);
    });

    // Get all source names
    const sourceNames = Object.keys(recordsBySource);
    log.info(`Found ${sourceNames.length} different sources`, {
      sources: sourceNames,
    });

    // Analyze pairs of records from different sources
    const potentialMatches = [];

    // Compare each source with every other source
    for (let i = 0; i < sourceNames.length; i++) {
      const source1 = sourceNames[i];
      const records1 = recordsBySource[source1];

      for (let j = i + 1; j < sourceNames.length; j++) {
        const source2 = sourceNames[j];
        const records2 = recordsBySource[source2];

        log.info(
          `Comparing records from ${source1} (${records1.length} records) and ${source2} (${records2.length} records)`
        );

        // Compare each record from source1 with each record from source2
        for (const record1 of records1) {
          for (const record2 of records2) {
            // Skip if either record has already been merged
            if (
              record1.fields.merge_status === "merged" ||
              record1.fields.merge_status === "merged_into" ||
              record2.fields.merge_status === "merged" ||
              record2.fields.merge_status === "merged_into"
            ) {
              // Instead of just skipping, if one record is merged_into, find its primary record
              // and consider transitivity
              if (
                record1.fields.merge_status === "merged_into" &&
                record1.fields.merged_into
              ) {
                log.info(
                  `Record ${record1.id} already merged into ${record1.fields.merged_into}. Skipping direct comparison.`
                );
              } else if (
                record2.fields.merge_status === "merged_into" &&
                record2.fields.merged_into
              ) {
                log.info(
                  `Record ${record2.id} already merged into ${record2.fields.merged_into}. Skipping direct comparison.`
                );
              }
              continue;
            }

            // Calculate similarity score - this is now an async function!
            const similarityScore = await calculateSimilarityScore(
              record1,
              record2
            );

            // Skip if score is 0 (records are definitely not the same incident)
            if (similarityScore.total === 0) {
              continue;
            }

            potentialMatchesCount++;

            // Add to potential matches if score is above threshold
            if (similarityScore.total >= 0.6) {
              potentialMatches.push({
                record1,
                record2,
                score: similarityScore,
              });

              if (similarityScore.total >= 0.8) {
                highConfidenceMatches++;
              } else {
                mediumConfidenceMatches++;
              }
            }
          }
        }
      }
    }

    log.info(`Found ${potentialMatches.length} potential matches`, {
      highConfidence: highConfidenceMatches,
      mediumConfidence: mediumConfidenceMatches,
      analyzedPairs: potentialMatchesCount,
    });

    // Sort potential matches by confidence score (highest first)
    potentialMatches.sort((a, b) => b.score.total - a.score.total);

    // Helper function to find the ultimate primary record in a merge chain
    async function findPrimaryRecord(recordId, headers) {
      // Start with the given record
      let currentId = recordId;
      let depth = 0;
      const maxDepth = 5; // Prevent infinite loops

      try {
        while (depth < maxDepth) {
          // Get the record
          const response = await axios.get(
            `https://api.airtable.com/v0/${airtableBaseId}/raw_data/${currentId}`,
            { headers }
          );

          const record = response.data;

          // If this record is merged into another, follow the chain
          if (
            record.fields.merge_status === "merged_into" &&
            record.fields.merged_into &&
            record.fields.merged_into.length > 0
          ) {
            // Move to the next record in the chain
            currentId = record.fields.merged_into[0];
            depth++;
            log.info(
              `Following merge chain: ${recordId} -> ${currentId} (depth: ${depth})`
            );
          } else {
            // We've found the end of the chain
            return record;
          }
        }

        log.warn(
          `Merge chain too deep for record ${recordId}, reached max depth ${maxDepth}`
        );
        return null;
      } catch (error) {
        log.error(`Error finding primary record for ${recordId}`, {
          error: error.message,
        });
        return null;
      }
    }

    // Process potential matches and merge records
    const processedRecords = new Set(); // Keep track of already processed records
    const mergeResults = [];

    for (const match of potentialMatches) {
      // Skip if either record has already been processed
      if (
        processedRecords.has(match.record1.id) ||
        processedRecords.has(match.record2.id)
      ) {
        continue;
      }

      // Only process high confidence matches if not in dry run mode
      if (!dryRun && match.score.total >= confidenceThreshold) {
        log.info(`Processing high confidence match`, {
          score: match.score.total,
          record1: `${match.record1.fields.source} - ${match.record1.id}`,
          record2: `${match.record2.fields.source} - ${match.record2.id}`,
        });

        // Check for existing merge relationships and processing status
        let record1Effective = match.record1;
        let skipMerge = false;

        // First check if either record has been marked with processing status
        const hasProcessingStatus1 =
          match.record1.fields.processing_status === "Processing" ||
          match.record1.fields.processing_status === "Complete";
        const hasProcessingStatus2 =
          match.record2.fields.processing_status === "Processing" ||
          match.record2.fields.processing_status === "Complete";

        // Check for incident linkage in one or both records
        const hasIncident1 =
          match.record1.fields.linked_incident &&
          match.record1.fields.linked_incident.length > 0;
        const hasIncident2 =
          match.record2.fields.linked_incident &&
          match.record2.fields.linked_incident.length > 0;

        // If both records have incident links
        if (hasIncident1 && hasIncident2) {
          log.info(
            "Both records already linked to incidents, checking if same incident",
            {
              record1Incident: match.record1.fields.linked_incident[0],
              record2Incident: match.record2.fields.linked_incident[0],
            }
          );

          // If they're linked to the same incident, no need to merge
          if (
            match.record1.fields.linked_incident[0] ===
            match.record2.fields.linked_incident[0]
          ) {
            log.info(
              "Records already linked to the same incident, skipping merge"
            );
            skipMerge = true;
          } else {
            // They're linked to different incidents - this is a complex case
            // We'll still process them but log a warning as this requires manual review
            log.warn(
              "Records linked to DIFFERENT incidents - potential duplicate incidents detected",
              {
                record1: {
                  id: match.record1.id,
                  source: match.record1.fields.source,
                  incidentId: match.record1.fields.linked_incident[0],
                },
                record2: {
                  id: match.record2.id,
                  source: match.record2.fields.source,
                  incidentId: match.record2.fields.linked_incident[0],
                },
                similarityScore: match.score.total,
              }
            );
            // We'll continue processing to merge the records, and our special handling
            // in the merge section will ensure we preserve an incident link
          }
        } else if (hasIncident1 || hasIncident2) {
          // One record has an incident link, the other doesn't
          // This is normal and we'll handle it in the merge section
          log.info("One record has incident link, will preserve during merge", {
            record1HasLink: hasIncident1,
            record2HasLink: hasIncident2,
            incidentId: hasIncident1
              ? match.record1.fields.linked_incident[0]
              : match.record2.fields.linked_incident[0],
          });
        }

        if (skipMerge) {
          log.info("Skipping merge due to existing incident relationships");
          processedRecords.add(match.record1.id);
          processedRecords.add(match.record2.id);
          continue;
        }

        // Check if either record is involved in an existing merge chain
        let record2Effective = match.record2;

        // Check for merge chains - find the "root" record if part of a chain
        // Use the 'record1Effective' declared earlier in this scope
        if (match.record1.fields.merge_status === "merged") {
          log.info(
            `Record1 (${match.record1.id}) is already a primary merged record`
          );
        } else if (
          match.record1.fields.merge_status === "merged_into" &&
          match.record1.fields.merged_into
        ) {
          // Find the primary record for this chain
          const primaryRecord = await findPrimaryRecord(
            match.record1.id,
            headers
          );
          if (primaryRecord) {
            log.info(
              `Record1 (${match.record1.id}) is part of merge chain, using primary: ${primaryRecord.id}`
            );
            record1Effective = primaryRecord;
          }
        }

        if (match.record2.fields.merge_status === "merged") {
          log.info(
            `Record2 (${match.record2.id}) is already a primary merged record`
          );
        } else if (
          match.record2.fields.merge_status === "merged_into" &&
          match.record2.fields.merged_into
        ) {
          // Find the primary record for this chain
          const primaryRecord = await findPrimaryRecord(
            match.record2.id,
            headers
          );
          if (primaryRecord) {
            log.info(
              `Record2 (${match.record2.id}) is part of merge chain, using primary: ${primaryRecord.id}`
            );
            record2Effective = primaryRecord;
          }
        }

        // Determine primary and secondary records (using the effective records)
        const { primary, secondary } = determinePrimaryRecord(
          record1Effective,
          record2Effective
        );

        // Special handling for existing incident links - ensure we preserve any incident linkage
        let linkedIncidentId = null;

        // Check if either record is already linked to an incident
        if (
          primary.fields.linked_incident &&
          primary.fields.linked_incident.length > 0
        ) {
          linkedIncidentId = primary.fields.linked_incident[0];
          log.info(
            `Primary record already linked to incident: ${linkedIncidentId}`
          );
        } else if (
          secondary.fields.linked_incident &&
          secondary.fields.linked_incident.length > 0
        ) {
          linkedIncidentId = secondary.fields.linked_incident[0];
          log.info(
            `Secondary record already linked to incident: ${linkedIncidentId}, will link primary to same incident`
          );
        }

        // Merge complementary data
        const mergedFields = mergeComplementaryData(primary, secondary);

        // If we found an incident link, make sure it's preserved in the merge
        if (linkedIncidentId) {
          mergedFields.linked_incident = [linkedIncidentId];
          mergedFields.has_incident = true;
          log.info(
            `Preserved incident link to ${linkedIncidentId} in merged record`
          );
        }

        try {
          // Update primary record with merged data
          await axios.patch(
            `https://api.airtable.com/v0/${airtableBaseId}/raw_data/${primary.id}`,
            { fields: mergedFields },
            { headers }
          );

          // Mark secondary record as merged into primary
          await axios.patch(
            `https://api.airtable.com/v0/${airtableBaseId}/raw_data/${secondary.id}`,
            {
              fields: {
                merge_status: "merged_into",
                merged_into: [primary.id],
                processing_status: "Merged",
                processing_notes: `Merged into ${primary.id} (${primary.fields.source}) at ${new Date().toISOString()}`,
                last_processed: new Date().toISOString(),
              },
            },
            { headers }
          );

          mergedRecords++;
          log.info(`Successfully merged records`, {
            primaryId: primary.id,
            secondaryId: secondary.id,
          });

          mergeResults.push({
            success: true,
            primaryId: primary.id,
            secondaryId: secondary.id,
            score: match.score.total,
            mergedFields,
          });
        } catch (error) {
          log.error(`Error merging records`, {
            primaryId: primary.id,
            secondaryId: secondary.id,
            error: error.message,
          });

          mergeResults.push({
            success: false,
            primaryId: primary.id,
            secondaryId: secondary.id,
            score: match.score.total,
            error: error.message,
          });
        }
      } else {
        // In dry run mode, just record the potential merge
        mergeResults.push({
          dryRun: true,
          record1Id: match.record1.id,
          record2Id: match.record2.id,
          record1Source: match.record1.fields.source,
          record2Source: match.record2.fields.source,
          score: match.score,
        });
      }

      // Mark both records as processed
      processedRecords.add(match.record1.id);
      processedRecords.add(match.record2.id);
    }

    // Generate summary
    const summary = {
      recordsAnalyzed: rawDataRecords.length,
      sourceCount: sourceNames.length,
      potentialMatchesFound: potentialMatches.length,
      highConfidenceMatches,
      mediumConfidenceMatches,
      mergesPerformed: mergedRecords,
      dryRun,
    };

    log.info("Cross-Source Deduplication complete", summary);

    // Refresh the Process view in Airtable
    try {
      log.info("Refreshing Process view in Airtable...");

      // Make a request to the view to trigger a refresh
      await axios.get(
        `https://api.airtable.com/v0/${airtableBaseId}/raw_data`,
        {
          headers,
          params: {
            view: "Process",
            maxRecords: 1,
          },
        }
      );

      log.info("Process view refreshed");

      // Now trigger the process-raw-data-background function
      const siteUrl = process.env.PUBLIC_URL;
      if (!siteUrl) {
        throw new Error("PUBLIC_URL environment variable not set");
      }

      await axios.post(
        `${siteUrl}/.netlify/functions/process-raw-data-background`
      );
      log.info("Triggered process-raw-data-background function");
    } catch (error) {
      log.error("Error refreshing view or triggering background function:", {
        error: error.message,
      });
      throw error; // Re-throw to ensure the function fails visibly
    }

    // Return HTTP response (different format from background function)
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        summary,
        results: dryRun ? mergeResults : `Merged ${mergedRecords} records`,
      }),
    };
  } catch (error) {
    log.error("Error in Cross-Source Deduplication", {
      error: error.message,
      stack: error.stack,
    });

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};

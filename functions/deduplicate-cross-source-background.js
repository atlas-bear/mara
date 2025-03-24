/**
 * Cross-Source Deduplication Background Function
 *
 * Identifies and merges duplicate incident reports from different maritime reporting sources.
 * Uses spatial, temporal, and semantic similarity to detect matches and combines complementary information.
 */
import axios from "axios";
import { logDebug, logError, logInfo } from "./utils/logger.js";
import {
  calculateSimilarityScore,
  determinePrimaryRecord,
  mergeComplementaryData,
} from "./utils/deduplication-utils.js";

/**
 * Main deduplication function that runs as a Netlify serverless function
 */
export default async (req, context) => {
  logInfo("Cross-Source Deduplication Background Function started", {
    time: new Date().toISOString(),
  });

  // Process parameters - potentially passed via querystring in manual triggering
  const dryRun = req.queryStringParameters?.dryRun === "true";
  const confidenceThreshold =
    parseFloat(req.queryStringParameters?.confidenceThreshold) || 0.8;
  const maxRecords = parseInt(req.queryStringParameters?.maxRecords) || 100;

  logInfo("Configuration", {
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

    logInfo("Fetching recent raw_data records", { since: thirtyDaysAgoString });

    // Use pagination to handle large datasets
    let rawDataRecords = [];
    let offset = null;

    do {
      const params = {
        filterByFormula: `AND(
          IS_AFTER({date}, '${thirtyDaysAgoString}'),
          OR(
            NOT({merge_status}),
            {merge_status} = ''
          )
        )`,
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: maxRecords,
        ...(offset ? { offset } : {}),
      };

      const response = await axios.get(
        `https://api.airtable.com/v0/${airtableBaseId}/raw_data`,
        { headers, params }
      );

      rawDataRecords = [...rawDataRecords, ...response.data.records];
      offset = response.data.offset;

      logDebug(`Fetched ${response.data.records.length} records`, {
        total: rawDataRecords.length,
        hasMore: !!offset,
      });

      // Break if we've reached the maximum number of records to process
      if (rawDataRecords.length >= maxRecords) {
        logInfo(`Reached maximum record limit (${maxRecords})`);
        break;
      }
    } while (offset);

    logInfo(`Retrieved ${rawDataRecords.length} records for processing`);

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
    logInfo(`Found ${sourceNames.length} different sources`, {
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

        logInfo(
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

    logInfo(`Found ${potentialMatches.length} potential matches`, {
      highConfidence: highConfidenceMatches,
      mediumConfidence: mediumConfidenceMatches,
      analyzedPairs: potentialMatchesCount,
    });

    // Sort potential matches by confidence score (highest first)
    potentialMatches.sort((a, b) => b.score.total - a.score.total);

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
        logInfo(`Processing high confidence match`, {
          score: match.score.total,
          record1: `${match.record1.fields.source} - ${match.record1.id}`,
          record2: `${match.record2.fields.source} - ${match.record2.id}`,
        });

        // Determine primary and secondary records
        const { primary, secondary } = determinePrimaryRecord(
          match.record1,
          match.record2
        );

        // Merge complementary data
        const mergedFields = mergeComplementaryData(primary, secondary);

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
          logInfo(`Successfully merged records`, {
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
          logError(`Error merging records`, {
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

    logInfo("Cross-Source Deduplication complete", summary);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        summary,
        results: dryRun ? mergeResults : `Merged ${mergedRecords} records`,
      }),
    };
  } catch (error) {
    logError("Error in Cross-Source Deduplication", {
      error: error.message,
      stack: error.stack,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};

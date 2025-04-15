/**
 * Manual Test Function for Cross-Source Deduplication Logic
 *
 * Allows manual triggering to test the core deduplication steps without
 * background execution or triggering subsequent functions.
 */
import axios from "axios";
// Using original logger (no Logflare/axios import here)
import { log } from "./utils/logger.js";
import {
  calculateSimilarityScore,
  determinePrimaryRecord,
  mergeComplementaryData,
} from "./utils/deduplication-utils.js";

// Named export for Netlify handler
export const handler = async (req, context) => {
  const functionName = "manual-deduplicate-test";
  log.info(`${functionName} started`, { time: new Date().toISOString() });

  // Process parameters - allow manual override via query string
  const dryRun = req.queryStringParameters?.dryRun === "true";
  const confidenceThreshold =
    parseFloat(req.queryStringParameters?.confidenceThreshold) || 0.7;
  const maxRecords = parseInt(req.queryStringParameters?.maxRecords) || 100; // Limit records for manual test

  log.info("Configuration", { dryRun, confidenceThreshold, maxRecords });

  try {
    // Set up Airtable API parameters
    const airtableBaseId = process.env.AT_BASE_ID_CSER;
    const airtableApiKey = process.env.AT_API_KEY;

    if (!airtableBaseId || !airtableApiKey) {
      throw new Error("Missing Airtable API key or Base ID env vars");
    }
    const headers = {
      Authorization: `Bearer ${airtableApiKey}`,
      "Content-Type": "application/json",
    };

    // --- Core Deduplication Logic (copied from background function) ---

    // 1. Fetch recent raw_data records
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoString = thirtyDaysAgo.toISOString();
    log.info("Fetching recent raw_data records", {
      since: thirtyDaysAgoString,
    });

    let rawDataRecords = [];
    let offset = null;
    let fetchCount = 0;
    const maxFetches = 5; // Limit fetches for manual test

    do {
      const params = {
        filterByFormula: `AND(IS_AFTER({date}, '${thirtyDaysAgoString}'), OR(NOT({merge_status}), {merge_status} = ''))`,
        sort: [{ field: "date", direction: "desc" }],
        maxRecords: Math.min(maxRecords, 100), // Airtable max is 100 per page
        ...(offset ? { offset } : {}),
      };
      const response = await axios.get(
        `https://api.airtable.com/v0/${airtableBaseId}/raw_data`,
        { headers, params }
      );
      rawDataRecords = [...rawDataRecords, ...response.data.records];
      offset = response.data.offset;
      fetchCount++;
      log.info(
        `Fetched page ${fetchCount}, total records: ${rawDataRecords.length}`
      );
      if (rawDataRecords.length >= maxRecords || fetchCount >= maxFetches)
        break;
    } while (offset);

    log.info(`Retrieved ${rawDataRecords.length} records for processing.`);
    if (rawDataRecords.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "No recent unprocessed records found.",
        }),
      };
    }

    // 2. Group records by source
    const recordsBySource = {};
    rawDataRecords.forEach((r) => {
      const source = r.fields.source;
      if (!recordsBySource[source]) recordsBySource[source] = [];
      recordsBySource[source].push(r);
    });
    const sourceNames = Object.keys(recordsBySource);
    log.info(`Found ${sourceNames.length} sources.`);

    // 3. Analyze pairs and find potential matches
    const potentialMatches = [];
    let potentialMatchesCount = 0,
      highConfidenceMatches = 0,
      mediumConfidenceMatches = 0;
    for (let i = 0; i < sourceNames.length; i++) {
      for (let j = i + 1; j < sourceNames.length; j++) {
        const records1 = recordsBySource[sourceNames[i]];
        const records2 = recordsBySource[sourceNames[j]];
        for (const record1 of records1) {
          for (const record2 of records2) {
            if (
              record1.fields.merge_status === "merged" ||
              record1.fields.merge_status === "merged_into" ||
              record2.fields.merge_status === "merged" ||
              record2.fields.merge_status === "merged_into"
            ) {
              continue;
            }
            const similarityScore = await calculateSimilarityScore(
              record1,
              record2
            );
            if (similarityScore.total === 0) continue;
            potentialMatchesCount++;
            if (similarityScore.total >= 0.6) {
              potentialMatches.push({
                record1,
                record2,
                score: similarityScore,
              });
              if (similarityScore.total >= 0.8) highConfidenceMatches++;
              else mediumConfidenceMatches++;
            }
          }
        }
      }
    }
    log.info(`Found ${potentialMatches.length} potential matches.`);
    potentialMatches.sort((a, b) => b.score.total - a.score.total);

    // 4. Process matches (Merge logic - simplified for test, actual merge commented out if not dryRun)
    const processedRecords = new Set();
    const mergeResults = [];
    let mergedRecords = 0;

    // Define findPrimaryRecord helper locally for this test function
    async function findPrimaryRecord(recordId, localHeaders) {
      let currentId = recordId,
        depth = 0;
      const maxDepth = 5;
      try {
        while (depth < maxDepth) {
          const response = await axios.get(
            `https://api.airtable.com/v0/${airtableBaseId}/raw_data/${currentId}`,
            { headers: localHeaders }
          );
          const record = response.data;
          if (
            record.fields.merge_status === "merged_into" &&
            record.fields.merged_into?.length > 0
          ) {
            currentId = record.fields.merged_into[0];
            depth++;
          } else {
            return record;
          }
        }
        log.warn(`Merge chain too deep for ${recordId}`);
        return null;
      } catch (error) {
        log.error(`Error finding primary for ${recordId}`, error);
        return null;
      }
    }

    for (const match of potentialMatches) {
      if (
        processedRecords.has(match.record1.id) ||
        processedRecords.has(match.record2.id)
      )
        continue;

      if (!dryRun && match.score.total >= confidenceThreshold) {
        log.info(
          `Processing high confidence match: ${match.record1.id} <> ${match.record2.id}`
        );

        let record1Effective = match.record1;
        if (
          match.record1.fields.merge_status === "merged_into" &&
          match.record1.fields.merged_into
        ) {
          const primary = await findPrimaryRecord(match.record1.id, headers);
          if (primary) record1Effective = primary;
        }
        let record2Effective = match.record2;
        if (
          match.record2.fields.merge_status === "merged_into" &&
          match.record2.fields.merged_into
        ) {
          const primary = await findPrimaryRecord(match.record2.id, headers);
          if (primary) record2Effective = primary;
        }

        const { primary, secondary } = determinePrimaryRecord(
          record1Effective,
          record2Effective
        );
        const mergedFields = mergeComplementaryData(primary, secondary);

        // --- Actual Airtable Updates Commented Out for Safety in Manual Test ---
        // try {
        //   await axios.patch(`https://api.airtable.com/v0/${airtableBaseId}/raw_data/${primary.id}`, { fields: mergedFields }, { headers });
        //   await axios.patch(`https://api.airtable.com/v0/${airtableBaseId}/raw_data/${secondary.id}`, { fields: { merge_status: "merged_into", merged_into: [primary.id], processing_status: "Merged", /* ... */ } }, { headers });
        //   mergedRecords++;
        //   log.info(`Successfully merged: ${primary.id} <- ${secondary.id}`);
        //   mergeResults.push({ success: true, primaryId: primary.id, secondaryId: secondary.id, score: match.score.total });
        // } catch (error) { log.error(`Error merging records ${primary.id}, ${secondary.id}`, error); mergeResults.push({ success: false, /*...*/ }); }
        // --- End Commented Out Section ---

        // Simulate merge for logging/response in test
        mergedRecords++; // Increment even if commented out
        log.info(`Simulated merge: ${primary.id} <- ${secondary.id}`);
        mergeResults.push({
          success: true,
          simulated: true,
          primaryId: primary.id,
          secondaryId: secondary.id,
          score: match.score.total,
        });
      } else if (dryRun) {
        mergeResults.push({
          dryRun: true,
          record1Id: match.record1.id,
          record2Id: match.record2.id,
          score: match.score,
        });
      }
      processedRecords.add(match.record1.id);
      processedRecords.add(match.record2.id);
    }

    // 5. Generate summary
    const summary = {
      recordsAnalyzed: rawDataRecords.length,
      potentialMatchesFound: potentialMatches.length,
      highConfidenceMatches,
      mediumConfidenceMatches,
      mergesPerformedOrSimulated: mergedRecords,
      dryRun,
    };
    log.info("Manual Deduplication Test complete", summary);

    // --- Removed Trigger Logic ---

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, summary }),
    };
  } catch (error) {
    log.error(`Error in ${functionName}`, {
      error: error.message,
      stack: error.stack,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

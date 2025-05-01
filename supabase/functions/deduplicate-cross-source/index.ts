/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';
import {
    calculateSimilarityScore,
    determinePrimaryRecord,
    mergeComplementaryData,
} from '../_shared/deduplicationUtils.ts';
import { settings, getLookbackDate, validateSummary, type DeduplicationSummary } from './config.ts';

// Define basic type for raw_data records from Supabase
// deno-lint-ignore no-explicit-any
type RawDataRecord = Record<string, any> & { id: string }; // Ensure 'id' is present

// --- Main Deduplication Logic ---

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    log.info('Cross-Source Deduplication Function triggered', { time: new Date().toISOString() });

    try {
        const lookbackDate = getLookbackDate();
        const lookbackDateString = lookbackDate.toISOString();

        log.info('Fetching recent raw_data records for deduplication', { 
            since: lookbackDateString, 
            limit: settings.maxRecordsToProcess 
        });

        // Fetch recent records that haven't been merged into another record yet
        // Order by date descending to process newest first
        const { data: rawDataRecords, error: fetchError } = await supabaseAdmin
            .from('raw_data')
            .select('*') // Select all columns needed for similarity/completeness/merge
            .gte('date', lookbackDateString) // Filter by date
            .or('merge_status.is.null,merge_status.neq.merged_into') // Get records that are not secondary merge records
            .order('date', { ascending: false })
            .limit(settings.maxRecordsToProcess);

        if (fetchError) {
            log.error('Error fetching raw_data records', { error: fetchError });
            throw new Error(`DB error fetching records: ${fetchError.message}`);
        }

        if (!rawDataRecords || rawDataRecords.length === 0) {
            log.info('No suitable records found for deduplication in the lookback window.');
            return successResponse({
                status: 'no-records',
                message: 'No records found for deduplication'
            });
        }

    log.info(`Retrieved ${rawDataRecords.length} records for potential deduplication.`);

    // --- Deduplication Processing ---
    let potentialMatchesCount = 0;
    let highConfidenceMatches = 0;
    let mediumConfidenceMatches = 0;
    let mergesAttempted = 0;
    let mergesSucceeded = 0;
    let mergeErrors = 0;

    const recordsById = new Map<string, RawDataRecord>(rawDataRecords.map((r: RawDataRecord) => [r.id, r])); // Add type annotation
    const processedRecordIds = new Set<string>(); // Track processed records to avoid redundant comparisons/updates

    for (let i = 0; i < rawDataRecords.length; i++) {
      const record1 = rawDataRecords[i];

      // Skip if already processed as part of a previous merge in this run
      if (processedRecordIds.has(record1.id)) continue;
      // Skip if already merged into another record previously
      if (record1.merge_status === 'merged_into') continue;

      for (let j = i + 1; j < rawDataRecords.length; j++) {
        const record2 = rawDataRecords[j];

        // Skip if same record or already processed/merged
        if (record1.id === record2.id || processedRecordIds.has(record2.id) || record2.merge_status === 'merged_into') continue;

        // Skip if same source
        if (record1.source === record2.source) continue;

        potentialMatchesCount++;

        // Calculate similarity
        const similarityScore = await calculateSimilarityScore(record1, record2);

        // Check if score meets threshold
        if (similarityScore.total >= settings.confidenceThreshold) {
            log.info(`Potential match found`, { 
                record1Id: record1.id, 
                record2Id: record2.id, 
                score: similarityScore.total.toFixed(4) 
            });

            if (similarityScore.total >= settings.highConfidenceThreshold) {
                highConfidenceMatches++;
            } else {
                mediumConfidenceMatches++;
            }

           // Determine primary/secondary
           const { primary, secondary } = determinePrimaryRecord(record1, record2);

           // Prepare updates for both records
           const secondaryUpdates = {
               merge_status: 'merged_into',
               merged_into_raw_data_id: primary.id, // Link to primary record's ID
               processing_status: 'ready', // Set to ready so it will be processed to update the incident
               processing_notes: `Merged into ${primary.id} (${primary.source}) at ${new Date().toISOString()}`,
               last_processed: new Date().toISOString(),
           };

           const primaryUpdates = {
               ...mergeComplementaryData(primary, secondary),
               processing_status: 'ready', // Set primary to ready as well
               processing_notes: `Updated with merged data from ${secondary.id} (${secondary.source}) at ${new Date().toISOString()}`,
               last_processed: new Date().toISOString(),
           };

           mergesAttempted++;

           // Perform updates in Supabase within a transaction if possible, or sequentially
           try {
               // Update primary record
               const { error: primaryUpdateError } = await supabaseAdmin
                   .from('raw_data')
                   .update(primaryUpdates)
                   .eq('id', primary.id);

               if (primaryUpdateError) throw new Error(`Primary update failed: ${primaryUpdateError.message}`);

               // Update secondary record
               const { error: secondaryUpdateError } = await supabaseAdmin
                   .from('raw_data')
                   .update(secondaryUpdates)
                   .eq('id', secondary.id);

               if (secondaryUpdateError) throw new Error(`Secondary update failed: ${secondaryUpdateError.message}`);

               log.info(`Successfully merged ${secondary.id} into ${primary.id}`);
               mergesSucceeded++;

               // Mark both as processed for this run
               processedRecordIds.add(primary.id);
               processedRecordIds.add(secondary.id);

               // Break inner loop once secondary is merged to avoid merging it again
               break;

           } catch (mergeErr) {
               const error = mergeErr instanceof Error ? mergeErr : new Error(String(mergeErr));
               log.error('Error performing merge update', { primaryId: primary.id, secondaryId: secondary.id, error: error.message });
               mergeErrors++;
               // Optionally mark records with an error status?
           }
        }
      }
       // Mark record1 as processed even if no match was found above threshold in this pass
       processedRecordIds.add(record1.id);
    }

    // --- Summary ---
    const summary = {
      recordsAnalyzed: rawDataRecords.length,
      potentialMatchesChecked: potentialMatchesCount,
      highConfidenceMatches,
      mediumConfidenceMatches,
      mergesAttempted,
      mergesSucceeded,
      mergeErrors,
    };
    log.info('Cross-Source Deduplication finished.', summary);

    // Note: Triggering the next step (processing) should ideally happen
    // via DB triggers on the 'raw_data' table updates (e.g., when merge_status changes).
    // Removed the explicit HTTP call to trigger processing function.

        // Validate summary before returning
        if (!validateSummary(summary)) {
            throw new Error('Invalid deduplication summary generated');
        }

        return successResponse({
            status: 'success',
            summary,
            config: {
                confidenceThreshold: settings.confidenceThreshold,
                maxRecordsToProcess: settings.maxRecordsToProcess,
                lookbackDays: settings.lookbackDays
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Critical error in Deduplication Function', { error: errorMessage });
        return errorResponse('Failed to process deduplication', errorMessage);
    }
});

/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { fetchHtmlContent } from '../_shared/fetch.ts';
import { parseCwdHtmlContent } from '../_shared/parser.ts';
import { standardizeIncident } from '../_shared/standardizer.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';

const SOURCE = 'CWD'; // Clearwater Dynamics
const SOURCE_URL = Deno.env.get('SOURCE_URL_CWD'); // Ensure this is set

// --- Helper Functions ---

// --- Main Function Logic ---

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    try {
        log.info(`Function ${SOURCE} triggered.`);
    const startTime = Date.now();

    if (!SOURCE_URL) {
      throw new Error('Missing environment variable: SOURCE_URL_CWD');
    }

    // 1. Fetch HTML Content
    // Pass empty headers object or specific ones if needed by CWD source
    const htmlContent = await fetchHtmlContent(SOURCE_URL, {});

    // 2. Parse HTML to get Raw Incidents using the imported utility
    const rawIncidents = parseCwdHtmlContent(htmlContent, SOURCE); // Pass SOURCE name
    log.info(`Parsed ${rawIncidents.length} raw incidents from ${SOURCE} HTML.`);

        if (rawIncidents.length === 0) {
            log.info(`No incidents parsed from ${SOURCE} HTML.`);
            return successResponse({
                status: 'no-data',
                message: `No incidents parsed from ${SOURCE}`
            });
        }

    // 3. Process, Standardize, Validate, and Filter New Incidents
    const potentialReferences: string[] = [];
    const processedIncidents: Record<string, any>[] = [];
    let processingErrorCount = 0;

    for (const rawIncident of rawIncidents) {
        try {
            // CWD parser likely returns a more structured object already
            // Standardize (which includes validation)
            const finalIncidentData = standardizeIncident(rawIncident, SOURCE, SOURCE_URL); // Assuming rawIncident is the processed form from parser

            // Ensure reference exists for DB check
            if (!finalIncidentData.reference) {
                log.warn('Skipping CWD incident due to missing reference ID after processing', { rawIncident });
                processingErrorCount++;
                continue;
            }
            finalIncidentData.referenceId = `${SOURCE}-${finalIncidentData.reference}`; // Standardize reference format if needed
            potentialReferences.push(finalIncidentData.referenceId);
            processedIncidents.push(finalIncidentData);

        } catch (procErr) {
            const processingError = procErr instanceof Error ? procErr : new Error(String(procErr));
            log.error('Error processing/validating CWD incident', { error: processingError.message, rawIncident });
            processingErrorCount++;
        }
    }
    log.info('CWD Incident processing summary', { processed: processedIncidents.length, errors: processingErrorCount });


        if (potentialReferences.length === 0) {
            log.warn('No valid references generated from processed CWD data.');
            return errorResponse('No valid references generated', null, 400);
        }

    // 4. Get Existing References from Supabase
    const { data: existingRawData, error: dbError } = await supabaseAdmin
      .from('raw_data')
      .select('reference')
      .in('reference', potentialReferences)
      .eq('source', SOURCE);

    if (dbError) {
      log.error('Error fetching existing CWD references from DB', { error: dbError });
      throw new Error(`DB error checking existing records: ${dbError.message}`);
    }

    const existingReferences = new Set(existingRawData?.map((r: { reference: string }) => r.reference) || []);
    log.info(`Found ${existingReferences.size} existing ${SOURCE} references in DB out of ${potentialReferences.length} potential.`);

    // 5. Filter out existing and prepare for insert
    const newIncidentsToInsert = [];
    let skippedCount = 0;

    for (const finalIncidentData of processedIncidents) {
        if (existingReferences.has(finalIncidentData.referenceId)) {
            skippedCount++;
            continue;
        }

        // Map to Supabase raw_data table structure
        const dbRecord = {
            reference: finalIncidentData.referenceId,
            source: SOURCE, // Use constant SOURCE
            title: finalIncidentData.title,
            description: finalIncidentData.description,
            date: finalIncidentData.date, // Ensure date is ISO format
            latitude: finalIncidentData.latitude,
            longitude: finalIncidentData.longitude,
            location: finalIncidentData.location, // Adjust field name if needed
            region: finalIncidentData.region,
            incident_type_name: finalIncidentData.category, // Map category/type
            vessel_name: finalIncidentData.vessel_name,
            vessel_type: finalIncidentData.vessel_type,
            vessel_flag: finalIncidentData.vesselFlag, // Map from standardized object
            vessel_imo: finalIncidentData.vesselImo, // Map from standardized object
            raw_json: finalIncidentData.raw, // Store original parsed data if available
            processing_status: 'new', // Set initial status for pipeline
        };
        // We only insert if validation didn't mark it as critically invalid
        // Add check if needed: if (finalIncidentData._metadata?.validationStatus !== 'error')
        newIncidentsToInsert.push(dbRecord);
    }

    log.info('CWD Incident filtering summary', { totalProcessed: processedIncidents.length, toInsert: newIncidentsToInsert.length, skipped: skippedCount, processingErrors: processingErrorCount });

    // 6. Insert New Incidents
    if (newIncidentsToInsert.length > 0) {
      const BATCH_SIZE_DB = 500;
      for (let i = 0; i < newIncidentsToInsert.length; i += BATCH_SIZE_DB) {
          const batch = newIncidentsToInsert.slice(i, i + BATCH_SIZE_DB);
          log.info(`Inserting CWD batch ${i / BATCH_SIZE_DB + 1}...`, { batchSize: batch.length });
          const { error: insertError } = await supabaseAdmin
              .from('raw_data')
              .insert(batch);
          if (insertError) {
              log.error('Error inserting CWD batch into DB', { batchStart: i, error: insertError });
              throw new Error(`DB error inserting CWD records: ${insertError.message}`);
          }
      }
      log.info(`Successfully inserted ${newIncidentsToInsert.length} new ${SOURCE} incidents.`);
    } else {
      log.info(`No new ${SOURCE} incidents to insert.`);
    }

    const duration = Date.now() - startTime;
        log.info(`Function ${SOURCE} completed successfully.`, { duration, inserted: newIncidentsToInsert.length, skipped: skippedCount, errors: processingErrorCount });

        return successResponse({
            status: 'success',
            inserted: newIncidentsToInsert.length,
            skipped: skippedCount,
            errors: processingErrorCount
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Critical error in ${SOURCE} function`, { error: errorMessage });
        return errorResponse(`Failed to collect data from ${SOURCE}`, errorMessage);
    }
});

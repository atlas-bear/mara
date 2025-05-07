/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { fetchWithRetry } from '../_shared/fetch.ts';
import { standardizeIncident } from '../_shared/standardizer.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';

const SOURCE = 'UKMTO';
const SOURCE_URL = Deno.env.get('SOURCE_URL_UKMTO'); // Ensure this is set in Supabase env vars

// --- Helper Functions ---

// deno-lint-ignore no-explicit-any
async function fetchUKMTOData(): Promise<any[]> {
  if (!SOURCE_URL) {
    log.error('Missing environment variable: SOURCE_URL_UKMTO');
    throw new Error('Missing environment variable: SOURCE_URL_UKMTO');
  }
  log.info(`Fetching ${SOURCE} data from ${SOURCE_URL}`);

  const headers = {
    // Headers from original function
    'Origin': 'https://www.ukmto.org',
    'Referer': 'https://www.ukmto.org/',
  };

  // Use the shared fetchWithRetry utility, which handles proxy via env vars
  const response = await fetchWithRetry(SOURCE_URL, {
    method: 'GET', // Assuming GET based on original code
    headers: headers,
    // Add options like maxRetries, retryDelayMs, timeoutMs if needed
    // timeoutMs: 15000
  });

  const data = await response.json();
  if (!Array.isArray(data)) {
      log.warn(`${SOURCE} API did not return an array`, { responseData: data });
      return [];
  }
  log.info(`Fetched ${data.length} raw incidents from ${SOURCE}`);
  return data;
  // Error handling managed by fetchWithRetry and main handler
}

// Ported processRawIncident logic
// deno-lint-ignore no-explicit-any
function processRawIncident(rawIncident: any): Record<string, any> | null {
   try {
     // Basic validation from original function
     if (!rawIncident.incidentNumber || !rawIncident.utcDateOfIncident) {
        log.warn('Skipping raw UKMTO incident due to missing incidentNumber or timestamp', { rawIncident });
        return null;
     }
     // Attempt to parse date to ensure it's valid ISO format or Date object
     const dateOccurred = new Date(rawIncident.utcDateOfIncident);
     if (isNaN(dateOccurred.getTime())) {
         log.warn('Skipping raw UKMTO incident due to invalid date', { date: rawIncident.utcDateOfIncident, incidentNumber: rawIncident.incidentNumber });
         return null;
     }

     return {
        referenceId: `${SOURCE}-${rawIncident.incidentNumber}`,
        source: SOURCE,
        dateOccurred: dateOccurred.toISOString(),
        title: rawIncident.incidentTypeName,
        description: rawIncident.otherDetails,
        latitude: rawIncident.locationLatitude,
        longitude: rawIncident.locationLongitude,
        locationPlace: rawIncident.place || null,
        locationDMSLat: rawIncident.locationLatitudeDDDMMSS,
        locationDMSLon: rawIncident.locationLongitudeDDDMMSS,
        region: 'indian_ocean', // Default for UKMTO, might need refinement
        category: rawIncident.incidentTypeName,
        severity: rawIncident.incidentTypeLevel,
        vesselName: rawIncident.vesselName || null,
        vesselType: rawIncident.vesselType || null,
        vesselStatusPiracy: rawIncident.vesselUnderPirateControl, // Boolean
        vesselCaptureDate: rawIncident.dateVesselTaken,
        vesselCrewHeld: rawIncident.crewHeld, // Boolean? Text?
        statusField: rawIncident.vesselUnderPirateControl ? 'active_piracy' : 'active', // Example mapping
        isAlert: !rawIncident.hideFromTicker, // Boolean
        isAdvisory: Boolean(rawIncident.extendTickerTime), // Boolean
        reportedBy: rawIncident.incidentIssuer || SOURCE,
        createdAtSource: rawIncident.utcDateCreated, // Keep if needed
        raw: rawIncident, // Store original raw data
     };
   } catch (err) {
     const error = err instanceof Error ? err : new Error(String(err));
     log.error('Error in processRawIncident (UKMTO)', { error: error.message, rawIncident });
     return null;
   }
}

// --- Main Function Logic ---

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    try {
        log.info(`Function ${SOURCE} triggered.`);
    const startTime = Date.now();

    // 1. Fetch Raw Data
    const rawIncidents = await fetchUKMTOData();

        if (rawIncidents.length === 0) {
            log.info(`No incidents found from ${SOURCE}.`);
            return successResponse({
                status: 'no-data',
                message: `No incidents received from ${SOURCE}`
            });
        }

    // 2. Get Existing References from Supabase
    const potentialReferences = rawIncidents
        .map(inc => inc.incidentNumber ? `${SOURCE}-${inc.incidentNumber}` : null)
        .filter(ref => ref !== null) as string[];

        if (potentialReferences.length === 0) {
            log.warn('No valid incident numbers found in raw UKMTO data.');
            return errorResponse('No valid references in fetched data', null, 400);
        }

    const { data: existingRawData, error: dbError } = await supabaseAdmin
      .from('raw_data')
      .select('reference')
      .in('reference', potentialReferences)
      .eq('source', SOURCE);

    if (dbError) {
      log.error('Error fetching existing UKMTO references from DB', { error: dbError });
      throw new Error(`DB error checking existing records: ${dbError.message}`);
    }

    const existingReferences = new Set(existingRawData?.map((r: { reference: string }) => r.reference) || []);
    log.info(`Found ${existingReferences.size} existing ${SOURCE} references in DB out of ${potentialReferences.length} potential.`);

    // 3. Process and Filter New Incidents
    const newIncidentsToInsert = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rawIncident of rawIncidents) {
       let referenceId: string | null = null;
       try {
         const processed = processRawIncident(rawIncident);
         if (!processed) {
           errorCount++;
           continue;
         }
         referenceId = processed.referenceId;

         if (existingReferences.has(referenceId)) {
           skippedCount++;
           continue;
         }

         // Standardize (which includes validation)
         const finalIncidentData = standardizeIncident(processed, SOURCE, SOURCE_URL);

         // Map to Supabase raw_data table structure
         // Note: standardizeIncident returns the final structure, including _metadata
         const dbRecord = {
           reference: finalIncidentData.referenceId,
           source: finalIncidentData.source,
           title: finalIncidentData.title,
           description: finalIncidentData.description,
           date: finalIncidentData.dateOccurred,
           latitude: finalIncidentData.latitude,
           longitude: finalIncidentData.longitude,
           location: finalIncidentData.locationPlace,
           region: finalIncidentData.region,
           incident_type_name: finalIncidentData.category,
           vessel_name: finalIncidentData.vesselName,
           vessel_type: finalIncidentData.vesselType,
           // vessel_flag: null, // UKMTO data might not have flag - handled by standardizer
           // vessel_imo: null, // UKMTO data might not have IMO - handled by standardizer
           raw_json: finalIncidentData.raw,
           processing_status: 'new', // Set initial status for pipeline
           // Add other UKMTO specific fields if columns exist and map from finalIncidentData
           // e.g., vessel_status: finalIncidentData.statusField, // If statusField exists after standardization
         };
         // We only insert if validation didn't mark it as critically invalid (though current validation doesn't)
         // Add check if needed: if (finalIncidentData._metadata?.validationStatus !== 'error')
         newIncidentsToInsert.push(dbRecord);
         processedCount++;

       } catch (procErr) {
         const processingError = procErr instanceof Error ? procErr : new Error(String(procErr));
         log.error('Error processing/validating UKMTO incident', { referenceId: referenceId ?? rawIncident.incidentNumber, error: processingError.message });
         errorCount++;
       }
    }

    log.info('UKMTO Incident processing summary', { processedCount, skippedCount, errorCount });

    // 4. Insert New Incidents
    if (newIncidentsToInsert.length > 0) {
      const BATCH_SIZE_DB = 500;
      for (let i = 0; i < newIncidentsToInsert.length; i += BATCH_SIZE_DB) {
          const batch = newIncidentsToInsert.slice(i, i + BATCH_SIZE_DB);
          log.info(`Inserting UKMTO batch ${i / BATCH_SIZE_DB + 1}...`, { batchSize: batch.length });
          const { error: insertError } = await supabaseAdmin
              .from('raw_data')
              .insert(batch);
          if (insertError) {
              log.error('Error inserting UKMTO batch into DB', { batchStart: i, error: insertError });
              throw new Error(`DB error inserting UKMTO records: ${insertError.message}`);
          }
      }
      log.info(`Successfully inserted ${newIncidentsToInsert.length} new ${SOURCE} incidents.`);
    } else {
      log.info(`No new ${SOURCE} incidents to insert.`);
    }

    // Note: Metrics validation logic from original function is omitted for now.
    // It relied on cache and might be implemented differently if needed (e.g., using a DB table).

    const duration = Date.now() - startTime;
        log.info(`Function ${SOURCE} completed successfully.`, { duration, inserted: newIncidentsToInsert.length, skipped: skippedCount, errors: errorCount });

        return successResponse({
            status: 'success',
            inserted: newIncidentsToInsert.length,
            skipped: skippedCount,
            errors: errorCount
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Critical error in ${SOURCE} function`, { error: errorMessage });
        return errorResponse(`Failed to collect data from ${SOURCE}`, errorMessage);
    }
});

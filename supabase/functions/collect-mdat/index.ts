/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { fetchWithRetry } from '../_shared/fetch.ts';
import { standardizeIncident } from '../_shared/standardizer.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';

const SOURCE = 'MDAT';
const BASE_URL = Deno.env.get('SOURCE_URL_MDAT') || 'https://gog-mdat.org/api/occurrences/getPoints';

// Configuration constants for date handling
const DATE_CONFIG = {
  COLLECTION_WINDOW_DAYS: 60, // Base collection window
  OVERLAP_DAYS: 2, // Extra days for overlap
};

// --- Helper Functions ---

function generateFetchUrl(): string {
  const now = new Date();
  const windowStart = new Date();
  windowStart.setDate(now.getDate() - (DATE_CONFIG.COLLECTION_WINDOW_DAYS + DATE_CONFIG.OVERLAP_DAYS));

  // MDAT API seems to expect the start date in the URL path
  const startDateISO = windowStart.toISOString();
  log.info('Generating date range for MDAT collection', { startDateISO, windowDays: DATE_CONFIG.COLLECTION_WINDOW_DAYS });
  return `${BASE_URL}/${startDateISO}`;
}

// deno-lint-ignore no-explicit-any
async function fetchMDATData(url: string): Promise<any[]> {
  log.info(`Fetching ${SOURCE} data from ${url}`);
  const headers = {
    'Accept': 'application/json',
    'Origin': 'https://gog-mdat.org', // Keep headers if required
  };

  // Use the shared fetchWithRetry utility
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: headers,
  });

  const data = await response.json();

  // Validate the expected structure (GeoJSON FeatureCollection)
  if (!data || !Array.isArray(data.features)) {
      log.warn(`${SOURCE} API did not return a valid FeatureCollection`, { responseData: data });
      return [];
  }
  log.info(`Fetched ${data.features.length} raw incidents (features) from ${SOURCE}`);
  return data.features; // Return the array of features
}

// Ported processRawIncident logic for MDAT GeoJSON features
// deno-lint-ignore no-explicit-any
function processRawIncident(rawFeature: any): Record<string, any> | null {
   try {
     const properties = rawFeature.properties;
     const geometry = rawFeature.geometry;

     // Basic validation
     if (!properties || !geometry || !properties.serial || !properties.gdh) {
        log.warn('Skipping raw MDAT feature due to missing properties, geometry, serial, or gdh', { rawFeature });
        return null;
     }
     const dateOccurred = new Date(properties.gdh);
     if (isNaN(dateOccurred.getTime())) {
         log.warn('Skipping raw MDAT feature due to invalid date', { date: properties.gdh, serial: properties.serial });
         return null;
     }
     if (!geometry.coordinates || geometry.coordinates.length < 2) {
         log.warn('Skipping raw MDAT feature due to missing coordinates', { serial: properties.serial });
         return null;
     }

     const vesselInfo = properties.vessel || {};

     return {
        referenceId: `${SOURCE}-${properties.serial}`,
        source: SOURCE,
        dateOccurred: dateOccurred.toISOString(),
        title: properties.title,
        description: properties.description,
        latitude: geometry.coordinates[1], // GeoJSON format: [longitude, latitude]
        longitude: geometry.coordinates[0],
        locationPlace: properties.location || 'Gulf of Guinea',
        locationDescription: properties.locationDetail,
        region: 'west_africa', // Default for MDAT
        category: properties.occurrenceType?.label,
        severity: properties.severity,
        vesselName: vesselInfo.name || null,
        vesselType: vesselInfo.type || null,
        vesselFlag: vesselInfo.flag || null,
        vesselImo: vesselInfo.imo || null,
        isAlert: Boolean(properties.isAlert),
        isAdvisory: Boolean(properties.isAdvisory),
        reportedBy: properties.reporter || SOURCE,
        verifiedBy: properties.verifier || null,
        lastUpdatedSource: properties.lastModified || properties.gdh,
        createdAtSource: properties.gdh,
        raw: rawFeature, // Store original GeoJSON feature
     };
   } catch (err) {
     const error = err instanceof Error ? err : new Error(String(err));
     log.error('Error in processRawIncident (MDAT)', { error: error.message, rawFeature });
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

    // 1. Generate Fetch URL
    const fetchUrl = generateFetchUrl();

    // 2. Fetch Raw Data
    const rawFeatures = await fetchMDATData(fetchUrl);

        if (rawFeatures.length === 0) {
            log.info(`No incidents found from ${SOURCE}.`);
            return successResponse({
                status: 'no-data',
                message: `No incidents received from ${SOURCE}`
            });
        }

    // 3. Get Existing References from Supabase
    const potentialReferences = rawFeatures
        .map(feat => feat.properties?.serial ? `${SOURCE}-${feat.properties.serial}` : null)
        .filter(ref => ref !== null) as string[];

        if (potentialReferences.length === 0) {
            log.warn('No valid serial numbers found in raw MDAT data.');
            return errorResponse('No valid references in fetched data', null, 400);
        }

    const { data: existingRawData, error: dbError } = await supabaseAdmin
      .from('raw_data')
      .select('reference')
      .in('reference', potentialReferences)
      .eq('source', SOURCE);

    if (dbError) {
      log.error('Error fetching existing MDAT references from DB', { error: dbError });
      throw new Error(`DB error checking existing records: ${dbError.message}`);
    }

    const existingReferences = new Set(existingRawData?.map((r: { reference: string }) => r.reference) || []);
    log.info(`Found ${existingReferences.size} existing ${SOURCE} references in DB out of ${potentialReferences.length} potential.`);

    // 4. Process and Filter New Incidents
    const newIncidentsToInsert = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rawFeature of rawFeatures) {
       let referenceId: string | null = null;
       try {
         const processed = processRawIncident(rawFeature);
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
         const finalIncidentData = standardizeIncident(processed, SOURCE, BASE_URL); // Pass BASE_URL as sourceUrl

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
           vessel_flag: finalIncidentData.vesselFlag,
           vessel_imo: finalIncidentData.vesselImo,
           raw_json: finalIncidentData.raw,
           processing_status: 'new', // Set initial status for pipeline
           // Add other MDAT specific fields if columns exist and map from finalIncidentData
         };
         // We only insert if validation didn't mark it as critically invalid
         // Add check if needed: if (finalIncidentData._metadata?.validationStatus !== 'error')
         newIncidentsToInsert.push(dbRecord);
         processedCount++;

       } catch (procErr) {
         const processingError = procErr instanceof Error ? procErr : new Error(String(procErr));
         log.error('Error processing/validating MDAT incident', { referenceId: referenceId ?? rawFeature.properties?.serial, error: processingError.message });
         errorCount++;
       }
    }

    log.info('MDAT Incident processing summary', { processedCount, skippedCount, errorCount });

    // 5. Insert New Incidents
    if (newIncidentsToInsert.length > 0) {
      const BATCH_SIZE_DB = 500;
      for (let i = 0; i < newIncidentsToInsert.length; i += BATCH_SIZE_DB) {
          const batch = newIncidentsToInsert.slice(i, i + BATCH_SIZE_DB);
          log.info(`Inserting MDAT batch ${i / BATCH_SIZE_DB + 1}...`, { batchSize: batch.length });
          const { error: insertError } = await supabaseAdmin
              .from('raw_data')
              .insert(batch);
          if (insertError) {
              log.error('Error inserting MDAT batch into DB', { batchStart: i, error: insertError });
              throw new Error(`DB error inserting MDAT records: ${insertError.message}`);
          }
      }
      log.info(`Successfully inserted ${newIncidentsToInsert.length} new ${SOURCE} incidents.`);
    } else {
      log.info(`No new ${SOURCE} incidents to insert.`);
    }

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

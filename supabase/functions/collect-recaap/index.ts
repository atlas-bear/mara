/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { fetchWithRetry } from '../_shared/fetch.ts';
import { standardizeIncident } from '../_shared/standardizer.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';

const SOURCE = 'RECAAP'; // Consistent naming
const SOURCE_URL = Deno.env.get('SOURCE_URL_RECAAP') || 'https://portal.recaap.org/OpenMap/MapSearchIncidentServlet/';

// Configuration constants for date handling (can be adjusted)
const DATE_CONFIG = {
  COLLECTION_WINDOW_DAYS: 30, // Base collection window
  OVERLAP_DAYS: 2, // Extra days for overlap
};

// --- Helper Functions ---

function generateDateRange() {
  const now = new Date();
  const windowStart = new Date();
  windowStart.setDate(now.getDate() - (DATE_CONFIG.COLLECTION_WINDOW_DAYS + DATE_CONFIG.OVERLAP_DAYS));

  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    // Use Intl for month formatting in Deno
    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  return {
    startDate: formatDate(windowStart),
    endDate: formatDate(now),
  };
}

// deno-lint-ignore no-explicit-any
async function fetchReCAAPData(startDate: string, endDate: string): Promise<any[]> {
  log.info('Fetching ReCAAP data', { startDate, endDate });
  const requestBody = {
    incidentDateFrom: startDate,
    incidentDateTo: endDate,
    shipName: '',
    shipImoNumber: '',
    shipFlag: '',
    shipType: '',
    areaLocation: [],
    incidentType: '',
    reportType: 'Case',
    incidentNo: '',
  };

  const headers = {
    'accept': '*/*',
    'content-type': 'application/json',
    'x-requested-with': 'XMLHttpRequest',
    'referer': 'https://portal.recaap.org/OpenMap', // Keep referer if needed by API
  };

  // Use the shared fetchWithRetry utility
  const response = await fetchWithRetry(SOURCE_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
    // Add options like maxRetries, retryDelayMs, timeoutMs if needed
    // timeoutMs: 15000 // Example: 15 second timeout
  });

  // fetchWithRetry throws on non-ok status after retries, so no need to check response.ok here

  const data = await response.json();
  if (!Array.isArray(data)) {
      log.warn(`${SOURCE} API did not return an array`, { responseData: data });
      return []; // Return empty array if response is not as expected
  }
  log.info(`Fetched ${data.length} raw incidents from ${SOURCE}`);
  return data;
  // Error handling is managed by fetchWithRetry and the main handler's catch block
}

// Placeholder for processRawIncident - needs porting
// This function takes the raw object from the API and maps it to a standardized structure
// deno-lint-ignore no-explicit-any
function processRawIncident(rawIncident: any): Record<string, any> | null {
  try {
    // --- Ported Logic from Netlify function's processRawIncident ---
    const latDeg = parseFloat(rawIncident.latDegree || 0).toFixed(0);
    const latMin = parseFloat(rawIncident.latMinute || 0).toFixed(2);
    const longDeg = parseFloat(rawIncident.longDegree || 0).toFixed(0);
    const longMin = parseFloat(rawIncident.longMinute || 0).toFixed(2);

    const latitude = parseFloat(latDeg) + (parseFloat(latMin) / 60) * (rawIncident.latOption === 'S' ? -1 : 1);
    const longitude = parseFloat(longDeg) + (parseFloat(longMin) / 60) * (rawIncident.longOption === 'W' ? -1 : 1);
    const locationFormatted = `${latDeg}°${latMin}'${rawIncident.latOption} ${longDeg}°${longMin}'${rawIncident.longOption}`;

    // Basic validation within processing
    if (!rawIncident.incidentNo || !rawIncident.fullTimestampOfIncident) {
        log.warn('Skipping raw incident due to missing incidentNo or timestamp', { incidentNo: rawIncident.incidentNo });
        return null;
    }

    return {
      // Keep standardized fields needed for DB insertion and potential later steps
      referenceId: `${SOURCE}-${rawIncident.incidentNo}`, // Use consistent naming
      source: SOURCE,
      dateOccurred: new Date(rawIncident.fullTimestampOfIncident).toISOString(),
      title: `${rawIncident.incidentType || 'Incident'} - ${rawIncident.shipName || 'Unknown Vessel'} (${rawIncident.shipType || 'Unknown Type'})`,
      description: rawIncident.attackMethodDesc,
      latitude: isNaN(latitude) ? null : latitude,
      longitude: isNaN(longitude) ? null : longitude,
      locationPlace: locationFormatted, // Specific field for formatted location
      locationDescription: rawIncident.areaDescription,
      region: 'southeast_asia', // Default for ReCAAP, might need refinement
      category: rawIncident.incidentType || 'other', // Incident type/category
      severity: rawIncident.classification || null, // Incident severity/level
      vesselName: rawIncident.shipName || null,
      vesselType: rawIncident.shipType || null,
      vesselImo: rawIncident.shipImoNumber || null,
      vesselFlag: rawIncident.shipFlag || null,
      originalSourceField: rawIncident.sourceOfInformation, // Keep original source field if needed
      raw: rawIncident, // Store the original raw data
    };
  } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Error in processRawIncident', { error: error.message, rawIncident });
      return null; // Return null if processing fails
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

    // 1. Generate Date Range
    const { startDate, endDate } = generateDateRange();

    // 2. Fetch Raw Data from Source API
    const rawIncidents = await fetchReCAAPData(startDate, endDate);

        if (rawIncidents.length === 0) {
            log.info(`No incidents found from ${SOURCE} for the period.`);
            return successResponse({
                status: 'no-data',
                message: `No incidents received from ${SOURCE}`
            });
        }

    // 3. Get Existing Incident References from Supabase
    // Extract potential reference IDs from raw data first
    const potentialReferences = rawIncidents
        .map(inc => inc.incidentNo ? `${SOURCE}-${inc.incidentNo}` : null)
        .filter(ref => ref !== null) as string[];

    if (potentialReferences.length === 0) {
            log.warn('No valid incident numbers found in raw data to check against DB.');
            // Return an error response as this indicates an issue with the fetched data
            return errorResponse('No valid references in fetched data', null, 400);
        }

    const { data: existingRawData, error: dbError } = await supabaseAdmin
      .from('raw_data')
      .select('reference')
      .in('reference', potentialReferences)
      .eq('source', SOURCE);

    if (dbError) {
      log.error('Error fetching existing references from DB', { error: dbError });
      throw new Error(`DB error checking existing records: ${dbError.message}`);
    }

    const existingReferences = new Set(existingRawData?.map((r: { reference: string }) => r.reference) || []);
    log.info(`Found ${existingReferences.size} existing ${SOURCE} references in DB out of ${potentialReferences.length} potential.`);

    // 4. Process and Filter New Incidents
    const newIncidentsToInsert = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rawIncident of rawIncidents) {
      let referenceId: string | null = null;
      try {
        // Process (map fields)
        const processed = processRawIncident(rawIncident);
        if (!processed) {
          errorCount++; // Count as error if processing returns null
          continue;
        }
        referenceId = processed.referenceId; // Get reference ID after processing

        if (existingReferences.has(referenceId)) {
          skippedCount++;
           continue; // Skip already existing incident
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
          date: finalIncidentData.dateOccurred, // Matches 'date' column in schema
          latitude: finalIncidentData.latitude,
          longitude: finalIncidentData.longitude,
          location: finalIncidentData.locationPlace, // Matches 'location' column
          region: finalIncidentData.region,
          incident_type_name: finalIncidentData.category, // Matches column name
          vessel_name: finalIncidentData.vesselName,
          vessel_type: finalIncidentData.vesselType,
           vessel_flag: finalIncidentData.vesselFlag,
           vessel_imo: finalIncidentData.vesselImo,
           raw_json: finalIncidentData.raw, // Store original raw data as jsonb
           // Add other relevant fields from standardized object if they exist in the schema
           original_source: finalIncidentData.originalSourceField,
           processing_status: 'new', // Set initial status for pipeline
         };
         // We only insert if validation didn't mark it as critically invalid (though current validation doesn't)
         // Add check if needed: if (finalIncidentData._metadata?.validationStatus !== 'error')
         newIncidentsToInsert.push(dbRecord);
         processedCount++;

       } catch (procErr) {
         const processingError = procErr instanceof Error ? procErr : new Error(String(procErr));
         // Log error during standardization/validation step
         log.error('Error standardizing/validating individual incident', { referenceId: referenceId ?? rawIncident.incidentNo, error: processingError.message });
        errorCount++;
      }
    }

    log.info('Incident processing summary', { processedCount, skippedCount, errorCount });

    // 5. Insert New Incidents into Supabase
    if (newIncidentsToInsert.length > 0) {
      // Insert in batches if necessary, though Supabase client handles reasonable sizes well
      const BATCH_SIZE_DB = 500; // Example batch size for DB insert
      for (let i = 0; i < newIncidentsToInsert.length; i += BATCH_SIZE_DB) {
          const batch = newIncidentsToInsert.slice(i, i + BATCH_SIZE_DB);
          log.info(`Inserting batch ${i / BATCH_SIZE_DB + 1} of ${Math.ceil(newIncidentsToInsert.length / BATCH_SIZE_DB)}...`, { batchSize: batch.length });
          const { error: insertError } = await supabaseAdmin
              .from('raw_data')
              .insert(batch);

          if (insertError) {
              log.error('Error inserting batch into DB', { batchStart: i, error: insertError });
              // Decide how to handle partial failures - stop, log, continue?
              // For now, we throw, stopping the process. Consider a retry or logging mechanism.
              throw new Error(`DB error inserting records: ${insertError.message}`);
          }
      }
      log.info(`Successfully inserted ${newIncidentsToInsert.length} new ${SOURCE} incidents.`);
    } else {
      log.info(`No new ${SOURCE} incidents to insert.`);
    }

    const duration = Date.now() - startTime;
        log.info(`Function ${SOURCE} completed successfully.`, { duration, inserted: newIncidentsToInsert.length, skipped: skippedCount, errors: errorCount });

        // Respond using shared utility
        return successResponse({
            status: 'success',
            inserted: newIncidentsToInsert.length,
            skipped: skippedCount,
            errors: errorCount
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Critical error in ${SOURCE} function`, { error: errorMessage });
        // Respond using shared utility
        return errorResponse(`Failed to collect data from ${SOURCE}`, errorMessage);
    }
});

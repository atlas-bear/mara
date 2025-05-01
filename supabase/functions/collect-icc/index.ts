/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { fetchWithRetry } from '../_shared/fetch.ts';
import { standardizeIncident } from '../_shared/standardizer.ts';
import { referenceData } from '../_shared/referenceData.ts';
import { extractVesselInfo } from '../_shared/vesselUtils.ts';
import { determineIncidentType, determineSeverity } from '../_shared/incidentUtils.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/http.ts';

const SOURCE = 'ICC';
const SOURCE_URL = Deno.env.get('SOURCE_URL_ICC'); // Ensure this is set

// --- Helper Functions ---

// Ported from original collect-icc.js - specific helper for this collector
function extractLocationFromSitrep(sitrep: string): string | null {
    // Try to extract location after "Posn:" and before the period
    const locationMatch = sitrep.match(/Posn:.*?,\s*([^.]+)/);
    if (locationMatch) {
      // Clean up coordinates from the location string
      return locationMatch[1]
        .replace(/\d+:\d+\.\d+[NS]\s*[-–]\s*\d+:\d+\.\d+[EW]/g, "") // Remove "01:08.6N – 103:46.2E" format
        .replace(/\d+°\d+'\w\s*[-–]\s*\d+°\d+'\w/g, "") // Remove "06°26.1'N – 003°18.9'E" format
        .trim();
    }
    log.warn('Could not extract location string from sitrep', { sitrep: sitrep?.substring(0, 100) });
    return null;
}


// Ported parseIncident logic (using imported utilities)
// deno-lint-ignore no-explicit-any
async function parseIncident(marker: any, refData: any): Promise<Record<string, any> | null> {
  try {
    // Find the incident number, date, and sitrep from custom fields
    const getCustomFieldValue = (fieldId: number): string | null => {
      const field = marker.custom_field_data?.find((f: any) => f.id === fieldId);
      return field ? field.value : null;
    };

    const incidentNumber = getCustomFieldValue(9);
    const dateString = getCustomFieldValue(75); // Format like "YYYY-MM-DD" ?
    const sitrep = getCustomFieldValue(66);

    if (!incidentNumber || !dateString || !sitrep) {
        log.warn('Skipping ICC marker due to missing custom fields (9, 75, or 66)', { marker });
        return null;
    }

    // Extract the UTC time and coordinates from the sitrep
    const timeMatch = sitrep.match(/(\d{2}\.\d{2}\.\d{4}):\s*(\d{4})\s*UTC/);
    const datePart = timeMatch ? timeMatch[1].split('.').reverse().join('-') : dateString; // Use matched date if available, else custom field
    const timePart = timeMatch ? `${timeMatch[2].slice(0, 2)}:${timeMatch[2].slice(2)}:00` : '00:00:00';

    // Construct a proper ISO date string
    const dateObj = new Date(`${datePart}T${timePart}Z`); // Assume Z (UTC)
     if (isNaN(dateObj.getTime())) {
         log.warn('Skipping ICC marker due to invalid date parsing', { dateString, timePart, incidentNumber });
         return null;
     }

    // Format location data
    const lat = parseFloat(marker.lat);
    const lng = parseFloat(marker.lng);
     if (isNaN(lat) || isNaN(lng)) {
         log.warn('Skipping ICC marker due to invalid coordinates', { lat: marker.lat, lng: marker.lng, incidentNumber });
         return null;
     }

    // Use reference data utility to determine region
    // Note: refData is fetched once in the main handler now
    const region = await referenceData.findRegionByCoordinates(lat, lng); // Use the utility method

    // Extract vessel information and match against reference data
    // Pass the fetched vesselTypes from refData
    const vesselInfo = extractVesselInfo(sitrep, refData.vesselTypes);

    // Clean up the description by removing the date, time, and position
    // Regex might need adjustment based on actual sitrep variations
    const cleanDescription = sitrep
      .replace(/^\d{2}\.\d{2}\.\d{4}:\s*\d{4}\s*UTC:\s*Posn:.*?,\s*[^.]+\./, '')
      .trim();

    const incidentType = await determineIncidentType(sitrep, refData.incidentTypes);
    const locationString = extractLocationFromSitrep(sitrep);

    return {
      referenceId: `${SOURCE}-${incidentNumber}`,
      source: SOURCE,
      dateOccurred: dateObj.toISOString(),
      title: `Maritime Incident ${incidentNumber}`, // Simple title, maybe enhance later
      description: cleanDescription,
      latitude: lat,
      longitude: lng,
      region: region?.name?.toLowerCase().replace(/\s+/g, '_') || 'other',
      locationPlace: locationString || null,
      // locationDetails: { ... }, // Add if needed
      vesselName: vesselInfo.name,
      vesselType: vesselInfo.type,
      vesselStatus: vesselInfo.status,
      vesselFlag: vesselInfo.flag,
      vesselImo: vesselInfo.imo,
      category: incidentType, // Incident type/category
      severity: determineSeverity(sitrep), // Incident severity/level
      reportedBy: SOURCE,
      // lastUpdated: new Date().toISOString(), // Set during DB insert/update
      raw: marker, // Store original marker data
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error('Error in parseIncident (ICC)', { error: error.message, stack: error.stack, incidentNumber: marker?.custom_field_data?.find((f: any) => f.id === 9)?.value });
    return null; // Return null on parsing error
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

    if (!SOURCE_URL) {
      throw new Error('Missing environment variable: SOURCE_URL_ICC');
    }

    // 1. Fetch Reference Data using the singleton instance
    const refData = await referenceData.getAllReferenceData();
    // Basic validation of fetched reference data
    if (!refData || !refData.vesselTypes || !refData.maritimeRegions || !refData.incidentTypes) {
        throw new Error('Failed to load necessary reference data.');
    }
    log.info('Reference data loaded for ICC processing', {
        vesselTypes: refData.vesselTypes.length,
        regions: refData.maritimeRegions.length,
        incidentTypes: refData.incidentTypes.length,
    });


    // 2. Fetch Raw Data from Source API
    log.info(`Fetching ${SOURCE} data from ${SOURCE_URL}`);
    const response = await fetchWithRetry(SOURCE_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    const rawData = await response.json();

    if (!rawData || !Array.isArray(rawData.markers)) {
      throw new Error('Invalid response format from ICC: missing markers array');
    }
    const rawMarkers = rawData.markers;
    log.info(`Fetched ${rawMarkers.length} raw markers from ${SOURCE}`);

        if (rawMarkers.length === 0) {
            log.info(`No incidents found from ${SOURCE}.`);
            return successResponse({
                status: 'no-data',
                message: `No incidents received from ${SOURCE}`
            });
        }

    // 3. Get Existing References from Supabase
    const potentialReferences = rawMarkers
        .map((marker: any) => {
            const idField = marker.custom_field_data?.find((f: any) => f.id === 9);
             return idField?.value ? `${SOURCE}-${idField.value}` : null;
         })
         .filter((ref: string | null): ref is string => ref !== null); // Use type predicate

        if (potentialReferences.length === 0) {
            log.warn('No valid incident numbers found in raw ICC data.');
            return errorResponse('No valid references in fetched data', null, 400);
        }

    const { data: existingRawData, error: dbError } = await supabaseAdmin
      .from('raw_data')
      .select('reference')
      .in('reference', potentialReferences)
      .eq('source', SOURCE);

    if (dbError) {
      log.error('Error fetching existing ICC references from DB', { error: dbError });
      throw new Error(`DB error checking existing records: ${dbError.message}`);
    }

    const existingReferences = new Set(existingRawData?.map((r: { reference: string }) => r.reference) || []);
    log.info(`Found ${existingReferences.size} existing ${SOURCE} references in DB out of ${potentialReferences.length} potential.`);

    // 4. Process and Filter New Incidents
    const newIncidentsToInsert = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rawMarker of rawMarkers) {
       let referenceId: string | null = null;
       try {
         // Pass refData to parseIncident
         const processed = await parseIncident(rawMarker, refData);
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
           vessel_flag: finalIncidentData.vesselFlag,
           vessel_imo: finalIncidentData.vesselImo,
           raw_json: finalIncidentData.raw,
           processing_status: 'new', // Set initial status for pipeline
           // Add other ICC specific fields if columns exist and map from finalIncidentData
         };
         // We only insert if validation didn't mark it as critically invalid
         // Add check if needed: if (finalIncidentData._metadata?.validationStatus !== 'error')
         newIncidentsToInsert.push(dbRecord);
         processedCount++;

       } catch (procErr) {
         const processingError = procErr instanceof Error ? procErr : new Error(String(procErr));
         const markerId = rawMarker.custom_field_data?.find((f: any) => f.id === 9)?.value;
         log.error('Error processing/validating ICC incident', { referenceId: referenceId ?? markerId, error: processingError.message });
         errorCount++;
       }
    }

    log.info('ICC Incident processing summary', { processedCount, skippedCount, errorCount });

    // 5. Insert New Incidents
    if (newIncidentsToInsert.length > 0) {
      const BATCH_SIZE_DB = 500;
      for (let i = 0; i < newIncidentsToInsert.length; i += BATCH_SIZE_DB) {
          const batch = newIncidentsToInsert.slice(i, i + BATCH_SIZE_DB);
          log.info(`Inserting ICC batch ${i / BATCH_SIZE_DB + 1}...`, { batchSize: batch.length });
          const { error: insertError } = await supabaseAdmin
              .from('raw_data')
              .insert(batch);
          if (insertError) {
              log.error('Error inserting ICC batch into DB', { batchStart: i, error: insertError });
              throw new Error(`DB error inserting ICC records: ${insertError.message}`);
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

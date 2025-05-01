/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';
import { findOrCreateReferenceItem, processReferenceItems, clearReferenceItemCache } from '../_shared/referenceUtils.ts';
import { findOrCreateVessel, linkIncidentVessel, clearVesselCache } from '../_shared/vesselProcessing.ts';
import { callClaudeWithPrompt } from '../_shared/llmService.ts';
import { findSimilarExistingIncident } from '../_shared/incidentFinder.ts'; // Import new utility

// Define basic type for raw_data records from Supabase
// deno-lint-ignore no-explicit-any
type RawDataRecord = Record<string, any> & { id: string };
// deno-lint-ignore no-explicit-any
type IncidentRecord = Record<string, any> & { id: string }; // Basic type for incident

import { handleCors, successResponse, errorResponse, parseRequestBody } from '../_shared/http.ts';

// --- Helper Functions ---

/**
 * Updates the many-to-many links for an incident.
 * Deletes existing links for the specified types and inserts new ones.
 * Assumes link tables are named like 'incident_weapon_link' with columns 'incident_id' and 'weapon_id'.
 * @param incidentId The UUID of the incident to update links for.
 * @param links An object where keys are the foreign key column names (e.g., 'weapon_id')
 *              and values are arrays of UUIDs to link.
 */
async function updateIncidentLinks(incidentId: string, links: Record<string, string[]>) {
    log.info('Updating M2M links for incident', { incidentId, linkTypes: Object.keys(links) });

    for (const [foreignKeyCol, newIds] of Object.entries(links)) {
        if (!Array.isArray(newIds)) {
            log.warn(`Invalid IDs provided for ${foreignKeyCol}, skipping update.`);
            continue;
        }

        // Determine table name based on foreign key column (e.g., weapon_id -> incident_weapon_link)
        const linkTableName = `incident_${foreignKeyCol.replace('_id', '')}_link`;
        log.info(`Updating links in table: ${linkTableName}`);

        try {
            // 1. Delete existing links for this incident in this table
            const { error: deleteError } = await supabaseAdmin
                .from(linkTableName)
                .delete()
                .eq('incident_id', incidentId)
                .schema('cser');

            if (deleteError) {
                // Log error but potentially continue to insert new links? Or throw?
                log.error(`Error deleting existing links from ${linkTableName}`, { incidentId, error: deleteError });
                // Decide if this is critical - throwing for now
                throw new Error(`Failed to delete existing links for ${foreignKeyCol}: ${deleteError.message}`);
            }

            // 2. Insert new links if any IDs were provided
            if (newIds.length > 0) {
                const linksToInsert = newIds.map(linkId => ({
                    incident_id: incidentId,
                    [foreignKeyCol]: linkId, // Use dynamic key for the foreign ID column
                }));

                const { error: insertError } = await supabaseAdmin
                    .from(linkTableName)
                    .insert(linksToInsert)
                    .schema('cser');

                if (insertError) {
                     // Log error but potentially continue? Or throw?
                    log.error(`Error inserting new links into ${linkTableName}`, { incidentId, error: insertError });
                    // Throwing for now
                    throw new Error(`Failed to insert new links for ${foreignKeyCol}: ${insertError.message}`);
                }
                log.info(`Inserted ${newIds.length} links into ${linkTableName} for incident ${incidentId}`);
            } else {
                 log.info(`No new links to insert for ${foreignKeyCol} for incident ${incidentId}`);
            }

        } catch (err) {
             const error = err instanceof Error ? err : new Error(String(err));
             log.error(`Error updating links for ${foreignKeyCol}`, { incidentId, error: error.message });
             // Re-throw to indicate failure in the overall process?
             throw error;
        }
    }
}


// --- Main Processing Function ---

async function processRecord(recordId: string): Promise<{ status: string; incidentId?: string; operation?: string; message?: string }> {
    let recordToProcess: RawDataRecord | null = null;
    // Clear reference item cache at the start of processing each record
    clearReferenceItemCache();
    try {
        // 1. Fetch the specific raw_data record
        const { data: recordData, error: fetchError } = await supabaseAdmin
            .from('raw_data')
            .select('*')
            .eq('id', recordId)
            .maybeSingle();

         if (fetchError) throw new Error(`DB error fetching record: ${fetchError.message}`);
         if (!recordData) throw new Error(`Raw data record not found: ${recordId}`);

         // Assign and assert non-null for subsequent code
         recordToProcess = recordData as RawDataRecord;
         if (!recordToProcess) { // Double check just in case, though maybeSingle should handle
             throw new Error(`Record data is unexpectedly null after fetch for ID: ${recordId}`);
         }

         // 2. Check Status
        if (recordToProcess.has_incident || ['processing', 'complete'].includes(recordToProcess.processing_status)) {
            log.info('Record already processed or currently processing. Skipping.', { id: recordId, status: recordToProcess.processing_status, has_incident: recordToProcess.has_incident });
            return { status: 'skipped', message: 'Record already processed or in progress' };
        }

        // If this is a merged record, fetch the primary record it was merged into
        let primaryRecord = null;
        if (recordToProcess.merge_status === 'merged_into' && recordToProcess.merged_into_raw_data_id) {
            const { data: primary, error: primaryError } = await supabaseAdmin
                .from('raw_data')
                .select('*')
                .eq('id', recordToProcess.merged_into_raw_data_id)
                .single();

            if (primaryError) {
                log.error('Error fetching primary record for merged record', { 
                    mergedId: recordId, 
                    primaryId: recordToProcess.merged_into_raw_data_id, 
                    error: primaryError 
                });
                throw new Error(`Failed to fetch primary record: ${primaryError.message}`);
            }

            if (!primary) {
                log.error('Primary record not found for merged record', { 
                    mergedId: recordId, 
                    primaryId: recordToProcess.merged_into_raw_data_id 
                });
                throw new Error('Primary record not found');
            }

            primaryRecord = primary;
            log.info('Found primary record for merged record', { 
                mergedId: recordId, 
                primaryId: primaryRecord.id 
            });
        }

        // 3. Mark as Processing
        const { error: updateProcessingError } = await supabaseAdmin
            .from('raw_data')
            .update({
                processing_status: 'processing',
                processing_notes: `Started processing at ${new Date().toISOString()}`,
                last_processed: new Date().toISOString(),
                processing_attempts: (recordToProcess.processing_attempts || 0) + 1
            })
            .eq('id', recordId);
        if (updateProcessingError) throw new Error(`DB error marking record as processing: ${updateProcessingError.message}`);
        log.info('Marked record as processing', { id: recordId });

        // 4. Enrichment (LLM Call) - Use imported service
        const enrichedData = await callClaudeWithPrompt('descriptionEnhancement', { recordFields: recordToProcess });

        // 5. Process Reference Items - Use imported utils
        const weaponsUsedIds = await processReferenceItems(enrichedData.weapons_used, 'weapon', 'cser');
        const itemsStolenIds = await processReferenceItems(enrichedData.items_stolen, 'item_stolen', 'cser');
        const responseTypeIds = await processReferenceItems(enrichedData.response_type, 'response_type', 'cser');
        const authoritiesNotifiedIds = await processReferenceItems(enrichedData.authorities_notified, 'authority', 'cser');
        const incidentTypeId = await findOrCreateReferenceItem(recordToProcess.incident_type_name, 'incident_type', 'cser');

        // 6. Get Incident to Update
        let existingIncident = null;
        let incidentId: string | null = null;
        let operationType: 'created' | 'updated' | 'linked' = 'linked';

        if (primaryRecord) {
            // For merged records, get the incident from the primary record
            if (primaryRecord.incident_id) {
                const { data: incident, error: incidentError } = await supabaseAdmin
                    .from('incident')
                    .select('*')
                    .eq('id', primaryRecord.incident_id)
                    .single();

                if (incidentError) {
                    log.error('Error fetching incident for primary record', { 
                        primaryId: primaryRecord.id, 
                        incidentId: primaryRecord.incident_id, 
                        error: incidentError 
                    });
                    throw new Error(`Failed to fetch incident: ${incidentError.message}`);
                }

                if (incident) {
                    existingIncident = incident;
                    log.info('Found incident from primary record', { 
                        primaryId: primaryRecord.id, 
                        incidentId: incident.id 
                    });
                }
            }
        } else {
            // For non-merged records, search for similar incidents
            existingIncident = await findSimilarExistingIncident(recordToProcess);
        }

        // 7. Create or Update Incident - Placeholder logic
        if (existingIncident) {
            incidentId = existingIncident.id;
            operationType = 'updated';
            log.info('Found similar existing incident, preparing update', { incidentId });

            // Prepare fields to update in cser.incident
            const incidentUpdateFields: Record<string, any> = {};
            // Only update if new data is potentially better/more complete
            if (enrichedData.title && (!existingIncident.title || enrichedData.title.length > existingIncident.title.length)) incidentUpdateFields.title = enrichedData.title;
            if (enrichedData.description && (!existingIncident.description || enrichedData.description.length > existingIncident.description.length)) incidentUpdateFields.description = enrichedData.description;
            if (enrichedData.analysis && !existingIncident.analysis) incidentUpdateFields.analysis = enrichedData.analysis;
            if (enrichedData.recommendations && !existingIncident.recommendations) incidentUpdateFields.recommendations = enrichedData.recommendations;
            if (enrichedData.number_of_attackers !== null && existingIncident.number_of_attackers === null) incidentUpdateFields.number_of_attackers = enrichedData.number_of_attackers;
            if (enrichedData.location && !existingIncident.location_name) incidentUpdateFields.location_name = enrichedData.location;
            // Add other fields to potentially update if new data is better

            if (Object.keys(incidentUpdateFields).length > 0) {
                const { error: updateIncidentError } = await supabaseAdmin
                    .from('incident')
                    .update(incidentUpdateFields)
                    .eq('id', incidentId)
                    .schema('cser');
                if (updateIncidentError) throw new Error(`DB error updating incident: ${updateIncidentError.message}`);
                log.info('Updated existing incident main fields', { incidentId, updatedFields: Object.keys(incidentUpdateFields) });
            }

            // Update M2M links using the helper function
            // Ensure incidentId is not null before calling
            if (incidentId) {
                await updateIncidentLinks(incidentId, {
                    incident_type_id: incidentTypeId ? [incidentTypeId] : [],
                    weapon_id: weaponsUsedIds,
                    item_stolen_id: itemsStolenIds,
                    response_type_id: responseTypeIds,
                    authority_id: authoritiesNotifiedIds,
                });
            } else {
                 log.error('Cannot update links because incidentId is null during update operation.', { recordId });
                 // This case shouldn't happen if existingIncident was found, but adding safety check.
            }

        } else {
            operationType = 'created';
            log.info('No similar incident found, creating new incident');

            // Prepare fields for new incident insert
            const incidentInsertFields = {
                // reference_id is generated by DB trigger
                title: enrichedData.title || recordToProcess.title || 'Untitled Incident',
                description: enrichedData.description || recordToProcess.description,
                date_time_utc: recordToProcess.date,
                latitude: recordToProcess.latitude,
                longitude: recordToProcess.longitude,
                status: 'Active', // Default status
                region: recordToProcess.region || 'other',
                location_name: enrichedData.location || recordToProcess.location || 'Unknown Location',
                analysis: enrichedData.analysis,
                recommendations: enrichedData.recommendations,
                number_of_attackers: enrichedData.number_of_attackers,
                // M2M links handled separately below
            };

            const { data: newIncident, error: createIncidentError } = await supabaseAdmin
                .from('incident')
                .insert(incidentInsertFields)
                .select('id') // Select the generated ID
                .single()
                .schema('cser');

            if (createIncidentError) throw new Error(`DB error creating incident: ${createIncidentError.message}`);
            if (!newIncident?.id) throw new Error('Incident insert did not return an ID.'); // Check if ID is returned

            incidentId = newIncident.id;
            log.info('Created new incident', { incidentId });

            // Insert M2M links for the new incident
            // Ensure incidentId is not null before calling
            if (incidentId) {
                await updateIncidentLinks(incidentId, {
                    incident_type_id: incidentTypeId ? [incidentTypeId] : [],
                    weapon_id: weaponsUsedIds,
                    item_stolen_id: itemsStolenIds,
                    response_type_id: responseTypeIds,
                    authority_id: authoritiesNotifiedIds,
                });
            } else {
                 log.error('Cannot insert links because incidentId is null after create operation.', { recordId });
                 // This case indicates a failure in the insert operation returning the ID.
            }
        }

        // 8. Process Vessel and Link
        const vesselId = await findOrCreateVessel(recordToProcess); // Pass necessary fields
        if (incidentId && vesselId) {
            await linkIncidentVessel(incidentId, vesselId, recordToProcess.vessel_status);
        }

        // 9. Mark Raw Data as Complete
        const finalNotes = `Successfully processed at ${new Date().toISOString()} (${operationType} incident ${incidentId})`;
        const { error: updateCompleteError } = await supabaseAdmin
            .from('raw_data')
            .update({
                has_incident: true,
                processing_status: 'complete',
                processing_notes: finalNotes,
                incident_id: incidentId,
                last_processed: new Date().toISOString(),
            })
             .eq('id', recordId);
         if (updateCompleteError) throw new Error(`DB error marking record complete: ${updateCompleteError.message}`);

         log.info(`Marked raw_data ${recordId} as complete.`, { incidentId: incidentId ?? 'N/A', operationType }); // Use nullish coalescing for logging
         return { status: 'success', incidentId: incidentId ?? undefined, operation: operationType }; // Return undefined if null

     } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error('Error processing record', { recordId, error: error.message, stack: error.stack });
        // Attempt to mark record with error status
        if (recordId) {
            try {
                 await supabaseAdmin
                    .from('raw_data')
                    .update({
                        processing_status: 'error',
                        processing_notes: `Error at ${new Date().toISOString()}: ${error.message.substring(0, 500)}`,
                        last_processed: new Date().toISOString(),
                    })
                    .eq('id', recordId);
                  log.info('Marked record with error status', { recordId });
             } catch (updateErr) {
                  const updateError = updateErr instanceof Error ? updateErr : new Error(String(updateErr));
                  log.error('Failed to mark record with error status', { recordId, updateError: updateError.message });
             }
         }
        // Re-throw the original error to indicate failure
        throw error;
    }
}


// --- HTTP Server Logic ---
// This part handles the incoming request (e.g., from a DB trigger webhook)

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCors();
    }

    try {
        // Parse and validate request
        const payload = await parseRequestBody<{ record?: { id: string }; id?: string }>(req, (body) => {
            const recordId = body?.record?.id || body?.id;
            if (!recordId) {
                return 'Record ID not found in request payload';
            }
            return true;
        });

        const recordId = payload.record?.id || payload.id;
        log.info(`Received request to process record: ${recordId}`);
        
        const result = await processRecord(recordId!);
        return successResponse(result);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Critical error in process-raw-data function handler', { error: errorMessage });
        return errorResponse('Failed to process raw data record', errorMessage);
    }
});

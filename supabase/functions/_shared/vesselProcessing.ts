/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { supabaseAdmin } from './supabaseClient.ts';
import { log } from './logger.ts';
// Import helper from incidentUtils if needed, or redefine here
// For now, redefine to avoid potential circular dependency issues
function toTitleCase(str: unknown): string | unknown {
  if (typeof str !== 'string' || !str) return str;
  try {
    return str.replace(
      /\b\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Error in toTitleCase (vesselProcessing)', { input: str, error: error.message });
    return str;
  }
}

// Cache for vessel IDs found/created during a single function invocation
// Key: `imo:${imo}` or `name:${normalizedName}`, Value: uuid
const vesselCache = new Map<string, string>();

/**
 * Finds or creates a vessel record in the gida.vessel table.
 * Prioritizes finding by IMO, then by name.
 * Uses an in-memory cache for the invocation.
 *
 * @param vesselData Object containing vessel details (vessel_name, vessel_imo, vessel_type, vessel_flag).
 * @returns The UUID of the found or created vessel record, or null if insufficient data.
 */
// deno-lint-ignore no-explicit-any
export async function findOrCreateVessel(vesselData: Record<string, any>): Promise<string | null> {
    const name = vesselData.vessel_name as string | null;
    const imo = vesselData.vessel_imo as string | number | null;
    const type = vesselData.vessel_type as string | null;
    const flag = vesselData.vessel_flag as string | null;

    // Need at least IMO or Name to proceed
    if (!imo && (!name || name.trim().length === 0)) {
        log.info('Insufficient data to find or create vessel (missing IMO and Name).');
        return null;
    }

    const normalizedName = name?.trim().toUpperCase() || ''; // Normalize name for lookup/cache
    const imoStr = imo?.toString() || null;

    // Generate cache keys
    const imoCacheKey = imoStr ? `imo:${imoStr}` : null;
    const nameCacheKey = normalizedName ? `name:${normalizedName}` : null;

    // Check cache first (by IMO then by Name)
    if (imoCacheKey && vesselCache.has(imoCacheKey)) return vesselCache.get(imoCacheKey)!;
    if (nameCacheKey && vesselCache.has(nameCacheKey)) return vesselCache.get(nameCacheKey)!;

    const tableName = 'vessel';
    const schema = 'gida';

    try {
        let existingVesselId: string | null = null;

        // 1. Try finding by IMO (most reliable)
        if (imoStr) {
            const { data: imoMatch, error: imoError } = await supabaseAdmin
                .from(tableName)
                .select('id')
                .eq('imo', imoStr)
                .schema(schema)
                .maybeSingle();

            if (imoError) log.error(`Error finding vessel by IMO ${imoStr}`, { schema, error: imoError });
            if (imoMatch) existingVesselId = imoMatch.id;
        }

        // 2. If not found by IMO, try finding by Name (case-insensitive)
        if (!existingVesselId && normalizedName) {
             const { data: nameMatch, error: nameError } = await supabaseAdmin
                .from(tableName)
                .select('id')
                .ilike('name', normalizedName) // Case-insensitive match
                .schema(schema)
                .limit(1) // Take the first match if multiple exist
                .maybeSingle();

             if (nameError) log.error(`Error finding vessel by name '${normalizedName}'`, { schema, error: nameError });
             if (nameMatch) existingVesselId = nameMatch.id;
        }

        // 3. If found, cache and return ID
        if (existingVesselId) {
            log.info(`Found existing vessel`, { id: existingVesselId, imo: imoStr, name });
            if (imoCacheKey) vesselCache.set(imoCacheKey, existingVesselId);
            if (nameCacheKey) vesselCache.set(nameCacheKey, existingVesselId);
            return existingVesselId;
        }

        // 4. If not found, create new vessel record
        log.info('Creating new vessel record', { name, imo, type, flag });
        const vesselFieldsToInsert = {
            name: toTitleCase(name), // Store name in Title Case
            imo: imoStr,
            type: toTitleCase(type),
            flag: toTitleCase(flag),
        };
        // Remove null fields before insert
        Object.keys(vesselFieldsToInsert).forEach(key => {
            if (vesselFieldsToInsert[key as keyof typeof vesselFieldsToInsert] === null) {
                delete vesselFieldsToInsert[key as keyof typeof vesselFieldsToInsert];
            }
        });


        const { data: newData, error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert(vesselFieldsToInsert)
            .select('id')
            .single()
            .schema(schema);

        if (insertError) {
            // Handle potential race condition (unique constraint on IMO?)
            if (insertError.code === '23505' && imoStr) { // Unique violation on IMO
                 log.warn(`Unique violation on insert for vessel IMO ${imoStr}, retrying find.`, { schema });
                 const { data: retryData, error: retryError } = await supabaseAdmin
                    .from(tableName).select('id').eq('imo', imoStr).schema(schema).maybeSingle();
                 if (retryError) throw retryError; // Throw if retry fails
                 if (retryData) {
                     if (imoCacheKey) vesselCache.set(imoCacheKey, retryData.id);
                     if (nameCacheKey) vesselCache.set(nameCacheKey, retryData.id);
                     return retryData.id;
                 }
            }
            throw insertError; // Throw other insert errors
        }

        if (newData) {
            log.info('Created new vessel', { id: newData.id, name, imo });
            if (imoCacheKey) vesselCache.set(imoCacheKey, newData.id);
            if (nameCacheKey) vesselCache.set(nameCacheKey, newData.id);
            return newData.id;
        } else {
            throw new Error('Insert call for vessel returned no data and no error.');
        }

    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error('Error in findOrCreateVessel', { name, imo, error: error.message });
        return null; // Return null on error
    }
}

/**
 * Creates a link between an incident and a vessel in the cser.incident_vessel table.
 *
 * @param incidentId The UUID of the incident.
 * @param vesselId The UUID of the vessel.
 * @param status The vessel's status during the incident (optional).
 * @param role The vessel's role in the incident (defaults to 'Target').
 */
export async function linkIncidentVessel(
    incidentId: string,
    vesselId: string,
    status: string | null | undefined,
    role: string = 'Target'
): Promise<void> {
    if (!incidentId || !vesselId) {
        log.warn('Missing incidentId or vesselId for linking.', { incidentId, vesselId });
        return;
    }

    const tableName = 'incident_vessel';
    const schema = 'cser';

    // Prepare data, mapping to expected enum values if necessary
    // TODO: Confirm the exact enum values for vessel_status_during_incident and vessel_role in the DB schema
    const linkData = {
        incident_id: incidentId,
        vessel_id: vesselId,
        vessel_status_during_incident: status || 'Other', // Use provided status or default
        vessel_role: role, // Use provided role or default
    };

    log.info(`Attempting to link incident ${incidentId} to vessel ${vesselId}`);

    try {
        // Check if link already exists to prevent duplicates
        const { data: existingLink, error: findError } = await supabaseAdmin
            .from(tableName)
            .select('id')
            .eq('incident_id', incidentId)
            .eq('vessel_id', vesselId)
            .schema(schema)
            .maybeSingle();

        if (findError) {
            log.error('Error checking for existing incident_vessel link', { incidentId, vesselId, error: findError.message });
            // Decide whether to proceed or throw. Proceeding might create duplicates if check fails.
        }

        if (existingLink) {
            log.info(`Link already exists between incident ${incidentId} and vessel ${vesselId}. Skipping insert.`);
            return; // Link already exists
        }

        // Insert the new link
        const { error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert(linkData)
            .schema(schema);

        if (insertError) {
            // Handle potential errors (e.g., foreign key violation if IDs are wrong)
            log.error('Error creating incident_vessel link', { incidentId, vesselId, error: insertError });
            throw insertError; // Re-throw to indicate failure
        }

        log.info(`Successfully linked incident ${incidentId} to vessel ${vesselId}`);

    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        // Log error but don't necessarily stop the entire process if linking fails
        log.error('Failed to link incident and vessel', { incidentId, vesselId, error: error.message });
        // Depending on requirements, might want to re-throw 'err' here
    }
}

/**
 * Clears the in-memory vessel cache.
 */
export function clearVesselCache(): void {
    vesselCache.clear();
    log.info('Cleared in-memory vessel cache.');
}

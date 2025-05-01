/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { supabaseAdmin } from './supabaseClient.ts';
import { log } from './logger.ts';

// Cache for reference item IDs found/created during a single function invocation
// Key: `${schema}.${tableName}:${normalizedName}`, Value: uuid
const referenceItemCache = new Map<string, string>();

/**
 * Finds an existing record in a reference table by name or creates it if not found.
 * Uses an in-memory cache to avoid redundant lookups within the same function execution.
 *
 * @param itemName The name of the item to find or create.
 * @param tableName The name of the reference table (e.g., 'weapon', 'incident_type').
 * @param schema The schema of the table (e.g., 'cser', 'gida').
 * @param nameColumn The name of the column storing the item name (defaults to 'name').
 * @returns The UUID of the found or created record, or null if input is invalid/empty.
 */
export async function findOrCreateReferenceItem(
    itemName: string | null | undefined,
    tableName: string,
    schema: string = 'cser',
    nameColumn: string = 'name'
): Promise<string | null> {
    if (!itemName || typeof itemName !== 'string' || itemName.trim().length === 0) {
        return null;
    }

    // Normalize the name for lookup and storage (e.g., trim, consistent case)
    // Keep original case for insertion? Or store normalized? Storing Title Case for now.
    const cleanedName = itemName.replace(/\s*\(specify\)\s*$/i, '').trim();
    const normalizedName = cleanedName.toLowerCase(); // Use lowercase for cache key and lookup
    const formattedName = cleanedName.replace(/\b\w/g, l => l.toUpperCase()); // Store Title Case

    if (!formattedName) return null; // Skip if name becomes empty after cleaning

    const cacheKey = `${schema}.${tableName}:${normalizedName}`;

    // Check memory cache first
    if (referenceItemCache.has(cacheKey)) {
        return referenceItemCache.get(cacheKey)!;
    }

    try {
        // Try to find existing record (case-insensitive lookup)
        const { data: existingData, error: findError } = await supabaseAdmin
            .from(tableName)
            .select('id')
            .eq(nameColumn, formattedName) // Query with formatted name
            // .ilike(nameColumn, formattedName) // Use ilike for case-insensitive if needed and collation allows
            .schema(schema)
            .maybeSingle();

        if (findError) {
            log.error(`Error finding ${tableName} item '${formattedName}'`, { schema, error: findError });
            // Decide whether to throw or return null. Returning null might be safer.
            return null;
        }

        if (existingData) {
            log.info(`Found existing ${tableName} item: '${formattedName}'`, { id: existingData.id });
            referenceItemCache.set(cacheKey, existingData.id); // Cache the found ID
            return existingData.id;
        }

        // Create new record if not found
        log.info(`Creating new ${tableName} item: '${formattedName}'`, { schema });
        const { data: newData, error: insertError } = await supabaseAdmin
            .from(tableName)
            .insert({ [nameColumn]: formattedName }) // Insert the formatted name
            .select('id')
            .single()
            .schema(schema);

        if (insertError) {
            // Handle potential race condition if another process inserted between find and insert
            if (insertError.code === '23505') { // Unique violation code
                 log.warn(`Unique violation on insert for ${tableName} '${formattedName}', retrying find.`, { schema });
                 // Retry the find operation once
                 const { data: retryData, error: retryError } = await supabaseAdmin
                    .from(tableName)
                    .select('id')
                    .eq(nameColumn, formattedName)
                    .schema(schema)
                    .maybeSingle();

                 if (retryError) {
                     log.error(`Error retrying find for ${tableName} item '${formattedName}'`, { schema, error: retryError });
                     return null;
                 }
                 if (retryData) {
                     referenceItemCache.set(cacheKey, retryData.id);
                     return retryData.id;
                 } else {
                     log.error(`Unique violation but failed to find existing record on retry for ${tableName} '${formattedName}'`, { schema });
                     return null; // Failed to resolve
                 }
            } else {
                log.error(`Error creating ${tableName} item '${formattedName}'`, { schema, error: insertError });
                return null; // Return null on insert error
            }
        }

        if (newData) {
            log.info(`Created new ${tableName} item: '${formattedName}'`, { id: newData.id });
            referenceItemCache.set(cacheKey, newData.id); // Cache the new ID
            return newData.id;
        } else {
             log.error(`Insert call for ${tableName} '${formattedName}' returned no data and no error.`, { schema });
             return null;
        }

    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Unexpected error in findOrCreateReferenceItem for ${tableName} '${formattedName}'`, { schema, error: error.message });
        return null;
    }
}

/**
 * Processes an array of item names, finding or creating them in a reference table.
 *
 * @param items Array of item names.
 * @param tableName The reference table name.
 * @param schema The schema name.
 * @returns An array of UUIDs for the found/created items.
 */
export async function processReferenceItems(
    items: string[] | null | undefined,
    tableName: string,
    schema: string = 'cser'
): Promise<string[]> {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return [];
    }

    const itemIds: string[] = [];
    // Use Promise.all to process items concurrently for potential speedup
    const results = await Promise.allSettled(
        items.map(item => findOrCreateReferenceItem(item, tableName, schema))
    );

    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            itemIds.push(result.value);
        } else if (result.status === 'rejected') {
            log.error(`Failed to process reference item '${items[index]}' for table ${tableName}`, { reason: result.reason });
        } else {
             log.warn(`Processing reference item '${items[index]}' for table ${tableName} resulted in null ID.`);
        }
    });

    // Return unique IDs
    return [...new Set(itemIds)];
}

/**
 * Clears the in-memory reference item cache.
 * Should be called at the beginning of a function invocation if necessary,
 * though the cache is typically short-lived anyway.
 */
export function clearReferenceItemCache(): void {
    referenceItemCache.clear();
    log.info('Cleared in-memory reference item cache.');
}

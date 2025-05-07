/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';
import { validateIncident } from './validation.ts'; // Correct import path

/**
 * Capitalizes the first letter of each word in a string.
 * Handles null/undefined/non-string inputs gracefully.
 */
function capitalizeWords(str: unknown): string | unknown {
  if (typeof str !== 'string' || !str) return str;
  try {
    // Handle potential hyphens or multiple words correctly
    return str.replace(/\b\w+/g, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Error capitalizing words', { input: str, error: error.message });
    return str; // Return original on error
  }
}

/**
 * Converts a string to uppercase.
 * Handles null/undefined/non-string inputs gracefully.
 */
function toUpperCase(str: unknown): string | unknown {
  if (typeof str !== 'string' || !str) return str;
  try {
    return str.toUpperCase();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Error converting to uppercase', { input: str, error: error.message });
    return str; // Return original on error
  }
}

/**
 * Standardizes the format of an incident object from various sources.
 *
 * @param incident - The raw or partially processed incident data.
 * @param sourceName - The name of the source system (e.g., "UKMTO", "RECAAP").
 * @param sourceUrl - The URL of the source system (optional).
 * @returns A standardized incident object.
 */
// deno-lint-ignore no-explicit-any
export function standardizeIncident(incident: Record<string, any>, sourceName: string, sourceUrl?: string): Record<string, any> {
  if (!incident) {
    log.error('standardizeIncident called with null or undefined incident');
    return {}; // Return empty object or throw error?
  }

  // Ensure sourceName is uppercase for consistency
  const SOURCE_UPPER = sourceName.toUpperCase();

  // Determine the reference ID - use referenceId if present, otherwise construct from reference/sourceId
  const referenceId = incident.referenceId || incident.reference || incident.sourceId;
  const finalReferenceId = referenceId?.startsWith(SOURCE_UPPER + '-') ? referenceId : `${SOURCE_UPPER}-${referenceId}`;

  // Basic check for essential ID
  if (!finalReferenceId) {
      log.error('Cannot standardize incident without a reference ID', { incident });
      // Maybe return a minimal object or throw?
      return { ...incident, _metadata: { validationStatus: 'error', validationErrors: ['Missing reference ID'] } };
  }

  // Standardized structure
  const standardized = {
    // Core Fields
    referenceId: finalReferenceId, // Ensure consistent format
    source: SOURCE_UPPER, // Use uppercase source name
    sourceUrl: sourceUrl || incident.sourceUrl || null, // Optional source URL
    dateOccurred: incident.dateOccurred || incident.date, // Prefer dateOccurred
    title: incident.title || null,
    description: incident.description || null,
    latitude: incident.latitude, // Assume these are numbers or null
    longitude: incident.longitude,
    region: incident.region?.toLowerCase().replace(/\s+/g, '_') || null, // Normalize region
    category: incident.category || incident.type || null, // Prefer category

    // Vessel Information (handle nested object or flat properties)
    vesselName: toUpperCase(incident.vesselName || incident.vessel?.name) || null,
    vesselType: capitalizeWords(incident.vesselType || incident.vessel?.type) || null,
    vesselFlag: capitalizeWords(incident.vesselFlag || incident.vessel?.flag) || null,
    vesselImo: incident.vesselImo || incident.vessel?.imo || null,
    vesselStatus: incident.vesselStatus || incident.vessel?.status || null,

    // Location Details (handle nested object or flat properties)
    locationPlace: typeof incident.location === 'string' ? incident.location : (incident.locationPlace || incident.location?.place) || null,
    locationDescription: incident.locationDescription || incident.location?.description || null,

    // Status Information
    status: incident.status || 'active', // Default to active
    isAlert: incident.isAlert !== undefined ? Boolean(incident.isAlert) : false, // Default to false
    isAdvisory: incident.isAdvisory !== undefined ? Boolean(incident.isAdvisory) : false, // Default to false
    severity: incident.severity || incident.incidentTypeLevel || null,

    // Updates and References (ensure arrays)
    updates: Array.isArray(incident.updates) ? incident.updates : [],
    relatedIncidents: Array.isArray(incident.relatedIncidents) ? incident.relatedIncidents : [],
    externalReferences: Array.isArray(incident.externalReferences) ? incident.externalReferences : [],
    update_text: incident.update_text || null, // Keep parsed update text if present

    // Actors
    aggressors: incident.aggressors || null,
    victims: incident.victims || null,

    // Metadata
    reportedBy: incident.reportedBy || SOURCE_UPPER,
    verifiedBy: incident.verifiedBy || null,
    lastUpdatedSource: incident.lastUpdatedSource || incident.lastUpdated || null, // Timestamp from source if available
    createdAtSource: incident.createdAtSource || null, // Timestamp from source if available

    // Original Data
    raw: incident.raw || incident, // Store original input if 'raw' wasn't already populated
    _metadata: incident._metadata || {}, // Initialize metadata from input or empty object
  };

  // Validate the standardized incident (using the imported placeholder)
  const validation = validateIncident(standardized, SOURCE_UPPER);

  if (!validation.isValid) {
    log.warn('Incident validation warnings/errors after standardization', {
      referenceId: standardized.referenceId,
      errors: validation.errors,
    });
  }

  // Merge any normalized fields from validation back into the object
  // Ensure metadata is properly structured
  const finalIncident = {
    ...standardized,
    ...validation.normalized, // Overwrite standardized fields with validated/normalized ones
    // Safely merge metadata
    _metadata: {
      ...(standardized._metadata || {}), // Use existing metadata or empty object
      ...(validation.normalized._metadata || {}), // Merge metadata from validation or empty object
      standardizedAt: new Date().toISOString(),
      sourceName: SOURCE_UPPER, // Ensure sourceName is in metadata
      sourceUrl: standardized.sourceUrl, // Ensure sourceUrl is in metadata
      validationStatus: validation.isValid ? 'valid' : 'invalid',
      validationErrors: validation.errors,
    },
  };

  // Optional: Clean up top-level null values if desired, but often better to keep explicit nulls
  // Object.keys(finalIncident).forEach(key => {
  //   if (finalIncident[key] === null) {
  //     // delete finalIncident[key]; // Or handle as needed
  //   }
  // });

  return finalIncident;
}

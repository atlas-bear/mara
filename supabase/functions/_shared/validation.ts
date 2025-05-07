/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

// High-level regions (ported)
export const HIGH_LEVEL_REGIONS = [
  'west_africa',
  'indian_ocean',
  'southeast_asia',
  'americas',
  'europe',
  'other',
];

// Simple helper to clean location strings (ported)
export function cleanLocation(location: unknown): string | null {
  if (!location || typeof location !== 'string') return null;
  return location.trim() || null;
}

/**
 * Validates that object fields match their expected types.
 * Handles required and optional fields.
 * Allows specifying multiple valid types for optional fields using an array.
 */
// deno-lint-ignore no-explicit-any
function validateFields(data: Record<string, any>, requiredFields: Record<string, string>, optionalFields: Record<string, string | string[]> = {}): string[] {
  const errors: string[] = [];

  // Validate required fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!Object.prototype.hasOwnProperty.call(data, field) || data[field] === null || data[field] === undefined) {
      // Check for null/undefined as well as missing property
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
    }
  }

  // Validate optional fields if present and not null/undefined
  for (const [field, typeOrTypes] of Object.entries(optionalFields)) {
    if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== null && data[field] !== undefined) {
      const actualType = typeof data[field];
      if (Array.isArray(typeOrTypes)) {
        // Check against an array of allowed types
        if (!typeOrTypes.includes(actualType)) {
          errors.push(`Invalid type for optional field ${field}: expected one of [${typeOrTypes.join(', ')}], got ${actualType}`);
        }
      } else {
        // Check against a single allowed type
        if (actualType !== typeOrTypes) {
          errors.push(`Invalid type for optional field ${field}: expected ${typeOrTypes}, got ${actualType}`);
        }
      }
    }
  }

  return errors;
}


/**
 * Validates a standardized incident object and normalizes its fields.
 * Note: This validation focuses on structure and basic normalization.
 * It currently returns isValid: true always, logging errors instead of rejecting data.
 */
// deno-lint-ignore no-explicit-any
export function validateIncident(incident: Record<string, any>, source: string): { isValid: boolean; errors: string[]; normalized: Record<string, any> } {
  const errors: string[] = [];
  // Start with a deep copy to avoid modifying the original object unintentionally
  // Using structuredClone for deep copy, available in Deno
  const normalized = structuredClone(incident);

  // Define expected types for core fields
  const requiredFieldTypes = {
    referenceId: 'string', // Changed from sourceId in original validation
    source: 'string',
    dateOccurred: 'string', // Expecting ISO string after processing/standardization
    title: 'string',
    description: 'string',
    latitude: 'number',
    longitude: 'number',
  };
  const optionalFieldTypes = {
    sourceUrl: 'string',
    region: 'string',
    category: 'string',
    vesselName: 'string',
    vesselType: 'string',
    vesselFlag: 'string',
    vesselImo: 'string',
    vesselStatus: 'string',
    locationPlace: 'string',
    locationDescription: 'string',
    status: 'string',
    isAlert: 'boolean',
    isAdvisory: 'boolean',
    severity: 'string', // Can be string or null, handle null check in validateFields
    update_text: 'string',
    aggressors: 'string', // Assuming string, adjust if object/array
    victims: 'string', // Assuming string, adjust if object/array
    reportedBy: 'string',
    verifiedBy: 'string',
    lastUpdatedSource: 'string',
    createdAtSource: 'string',
    raw: 'object', // Expecting the raw data object
    _metadata: 'object', // Expecting metadata object
  };

  // Get core validation errors
  const fieldErrors = validateFields(normalized, requiredFieldTypes, optionalFieldTypes);
  errors.push(...fieldErrors);

  // Validate and normalize region if present
  if (normalized.region && typeof normalized.region === 'string') {
    let normalizedRegion = normalized.region.toLowerCase().trim();

    // Replace spaces/hyphens with underscores
    normalizedRegion = normalizedRegion.replace(/[\s-]+/g, '_');

    // Map common region variations to standard formats
    // Consider making this map more robust or data-driven
    const regionMap: Record<string, string> = {
      'indian': 'indian_ocean',
      'west': 'west_africa', // Be careful with generic terms
      'africa': 'west_africa', // Defaulting Africa to West Africa might be wrong
      'gulf_of_guinea': 'west_africa',
      'southeast': 'southeast_asia',
      'south_east': 'southeast_asia',
      'asia': 'southeast_asia', // Defaulting Asia might be wrong
      'america': 'americas',
      'central_america': 'americas',
      'south_america': 'americas',
      'north_america': 'americas',
      'european': 'europe',
      'mediterranean': 'europe',
      // Add more specific mappings as needed
    };

    // Apply mapping if a key is found within the normalized region string
    let mapped = false;
    for (const [key, value] of Object.entries(regionMap)) {
      if (normalizedRegion.includes(key)) {
        normalizedRegion = value;
        mapped = true;
        break;
      }
    }

    if (!HIGH_LEVEL_REGIONS.includes(normalizedRegion)) {
      log.info(`Non-standard region detected: '${incident.region}' (normalized to '${normalizedRegion}'), defaulting to 'other'`, { referenceId: normalized.referenceId });
      normalized.region = 'other'; // Default to 'other' if not standard
    } else {
      normalized.region = normalizedRegion; // Assign the validated/normalized region
    }
  } else if (!normalized.region) {
      // If region is missing entirely after standardization, default to 'other'
      normalized.region = 'other';
      errors.push('Missing region, defaulted to other');
  }

  // Ensure coordinates are valid numbers
  if (typeof normalized.latitude !== 'number' || typeof normalized.longitude !== 'number' || isNaN(normalized.latitude) || isNaN(normalized.longitude)) {
      errors.push(`Invalid coordinates: lat=${normalized.latitude}, lon=${normalized.longitude}`);
      // Optionally nullify invalid coordinates
      // normalized.latitude = null;
      // normalized.longitude = null;
  } else {
      // Validate coordinate ranges
      if (normalized.latitude < -90 || normalized.latitude > 90) {
          errors.push(`Invalid latitude range: ${normalized.latitude}`);
      }
      if (normalized.longitude < -180 || normalized.longitude > 180) {
          errors.push(`Invalid longitude range: ${normalized.longitude}`);
      }
  }


  // Add/update metadata - ensure _metadata exists
  normalized._metadata = {
    ...(normalized._metadata || {}), // Keep existing metadata
    validatedAt: new Date().toISOString(),
    source: source, // Ensure source is in metadata
    validationErrors: errors, // Store errors found
    // processingNotes: [], // Initialize if needed later
  };

  // Original logic returned isValid: true always. Keep this behavior for now.
  // Data is collected, errors are logged and stored in metadata.
  return {
    isValid: true,
    errors,
    normalized,
  };
}

import { log } from "./logger.js";

/**
 * Validates that all required fields exist in the provided data
 * @param {Object} data - The data object to validate
 * @param {Array} requiredFields - Array of field names that are required
 * @returns {Object} Object with valid flag and error message
 */
export function validateData(data, requiredFields) {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }
  
  return { valid: true };
}

// High-level regions
export const HIGH_LEVEL_REGIONS = [
  "west_africa",
  "indian_ocean",
  "southeast_asia",
  "americas",
  "europe",
  "other",
];

// Simple helper to clean location strings
export function cleanLocation(location) {
  if (!location) return null;
  if (typeof location !== "string") return null;
  return location.trim() || null;
}

export function validateDateFormat(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  if (isNaN(date.getTime())) {
    return { isValid: false, error: "Invalid date format" };
  }

  if (date > now) {
    return { isValid: false, error: "Date is in the future" };
  }

  return { isValid: true };
}

export function validateCoordinates(latitude, longitude) {
  const errors = [];

  if (latitude < -90 || latitude > 90) {
    errors.push("Invalid latitude");
  }
  if (longitude < -180 || longitude > 180) {
    errors.push("Invalid longitude");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateFields(data, requiredFields, optionalFields = {}) {
  const errors = [];

  // Validate required fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!data.hasOwnProperty(field)) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(
        `Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`
      );
    }
  }

  // Validate optional fields if present
  for (const [field, type] of Object.entries(optionalFields)) {
    if (data.hasOwnProperty(field) && data[field] !== null) {
      if (Array.isArray(type)) {
        if (!type.includes(typeof data[field])) {
          errors.push(
            `Invalid type for ${field}: expected one of [${type.join(
              ", "
            )}], got ${typeof data[field]}`
          );
        }
      } else if (typeof data[field] !== type) {
        errors.push(
          `Invalid type for ${field}: expected ${type}, got ${typeof data[
            field
          ]}`
        );
      }
    }
  }

  return errors;
}

// Validate the entire incident
export function validateIncident(incident, source) {
  const errors = [];
  const normalized = { ...incident }; // Start with a copy of the original

  // Get core validation errors
  const fieldErrors = validateFields(
    incident,
    {
      sourceId: "string",
      title: "string",
      description: "string",
    },
    {
      source: "string",
      category: "string",
      region: "string",
    }
  );

  // Add any field validation errors
  errors.push(...fieldErrors);

  // Validate and clean location if present
  if (incident.location || incident.place) {
    normalized.location = cleanLocation(incident.location || incident.place);
  }

  // Validate region if present
  if (incident.region) {
    const normalizedRegion = incident.region.toLowerCase().trim();
    if (!HIGH_LEVEL_REGIONS.includes(normalizedRegion)) {
      normalized.region = "other";
      log.info(
        `Non-standard region detected: ${incident.region}, defaulting to 'other'`
      );
    } else {
      normalized.region = normalizedRegion;
    }
  }

  // Add metadata
  normalized._metadata = {
    validatedAt: new Date().toISOString(),
    source,
    validationErrors: errors,
    processingNotes: [],
  };

  // Return valid even with errors, but include them in metadata
  return {
    isValid: true, // We'll allow all data through but track errors
    errors,
    normalized,
  };
}

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

/**
 * Validates if a date string is in a valid format and not in the future
 * 
 * @param {string} dateString - The date string to validate
 * @returns {Object} Object containing isValid flag and error message if invalid
 */
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

/**
 * Validates if latitude and longitude values are within valid ranges
 * 
 * @param {number} latitude - The latitude value to validate (-90 to 90)
 * @param {number} longitude - The longitude value to validate (-180 to 180)
 * @returns {Object} Object containing isValid flag and array of error messages
 */
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

/**
 * Validates that object fields match their expected types
 * 
 * @param {Object} data - The data object to validate
 * @param {Object} requiredFields - Object mapping field names to expected types (e.g., {id: 'string'})
 * @param {Object} optionalFields - Object mapping optional field names to expected types
 * @returns {Array} Array of error messages, empty if validation passes
 */
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

/**
 * Validates a standardized incident object and normalizes its fields
 * 
 * @param {Object} incident - The incident object to validate
 * @param {string} source - The name of the source system (e.g., "ukmto")
 * @returns {Object} Object containing:
 *   - isValid {boolean} Whether the incident passes validation
 *   - errors {Array} List of validation error messages
 *   - normalized {Object} A normalized copy of the incident with fixed fields
 */
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

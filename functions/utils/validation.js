import { log } from "./logger.js";

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

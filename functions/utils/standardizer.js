import { validateIncident } from "./validation.js";
import { log } from "./logger.js";

/**
 * Standardizes the format of an incident object from various sources
 * 
 * @param {Object} incident - The raw incident data to standardize
 * @param {string} sourceName - The name of the source system (e.g., "ukmto", "recaap")
 * @param {string} sourceUrl - The URL of the source system
 * @returns {Object} A standardized incident object with normalized fields
 */
export const standardizeIncident = (incident, sourceName, sourceUrl) => {
  /**
   * Capitalizes the first letter of each word in a string
   * 
   * @param {string} str - The string to process
   * @returns {string|*} The string with each word capitalized, or the original value if not a string
   * @private
   */
  function capitalizeWords(str) {
    if (typeof str !== "string") return str; // Return as is if not a string
    return str.replace(
      /\b\w+\b/g,
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }

  /**
   * Converts a string to uppercase
   * 
   * @param {string} str - The string to convert
   * @returns {string|*} The uppercase string, or the original value if not a string
   * @private
   */
  function toUpperCase(str) {
    if (typeof str !== "string") return str; // Return as is if not a string
    return str.toUpperCase();
  }

  // Standardized structure
  const standardized = {
    // Core Fields
    sourceId: incident.sourceId || `${sourceName}-${incident.reference}`,
    source: sourceName,
    sourceUrl: sourceUrl,
    dateOccurred: incident.dateOccurred || incident.date,
    title: incident.title,
    description: incident.description,
    originalSource: incident.originalSource || "",
    latitude: incident.latitude,
    longitude: incident.longitude,
    region: incident.region,
    category: incident.category || incident.type,

    // Vessel Information
    vessel: {
      name: toUpperCase(incident.vesselName || incident.vessel?.name), // Ensure vessel name is uppercase
      type: capitalizeWords(incident.vesselType || incident.vessel?.type), // Ensure vessel type is title case
      flag: capitalizeWords(incident.vesselFlag || incident.vessel?.flag), // Ensure vessel flag is title case
      imo: incident.vesselImo || incident.vessel?.imo,
      status: incident.vesselStatus || incident.vessel?.status,
    },

    // Location Details
    location:
      typeof incident.location === "string"
        ? incident.location
        : {
            place: incident.place || incident.location?.place,
            description: incident.locationDescription,
            coordinates: {
              latitude: incident.latitude,
              longitude: incident.longitude,
            },
          },

    // Status Information
    status: incident.status || "active",
    isAlert: Boolean(incident.isAlert),
    isAdvisory: Boolean(incident.isAdvisory),
    severity: incident.severity || incident.incidentTypeLevel,

    // Updates and References
    updates: incident.updates || [],
    relatedIncidents: incident.relatedIncidents || [],
    externalReferences: incident.externalReferences || [],

    // Actors
    aggressors: incident.aggressors || null,
    victims: incident.victims || null,

    // Metadata
    reportedBy: incident.reportedBy || sourceName,
    verifiedBy: incident.verifiedBy || null,
    lastUpdated:
      incident.lastUpdated || incident.timestamp || new Date().toISOString(),

    // Original Data
    raw: incident,
  };

  // Validate the standardized incident
  const validation = validateIncident(standardized, sourceName);

  if (!validation.isValid) {
    // Log validation errors but don't throw - we want to collect the data even if imperfect
    log.error("Incident validation errors", {
      sourceId: standardized.sourceId,
      errors: validation.errors,
    });
  }

  // Merge any normalized fields from validation
  const finalIncident = {
    ...standardized,
    ...validation.normalized,
    _metadata: {
      ...validation.normalized._metadata,
      standardizedAt: new Date().toISOString(),
      sourceName,
      sourceUrl,
      validationStatus: validation.isValid ? "valid" : "invalid",
      validationErrors: validation.errors,
    },
  };

  // Clean up any null/undefined values for consistent structure
  Object.keys(finalIncident).forEach((key) => {
    if (finalIncident[key] === null || finalIncident[key] === undefined) {
      if (Array.isArray(standardized[key])) {
        finalIncident[key] = [];
      } else if (typeof standardized[key] === "object") {
        finalIncident[key] = {};
      }
    }
  });

  return finalIncident;
};

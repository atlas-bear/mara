/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';
import {
  calculateTimeProximityScore,
  calculateSpatialProximityScore,
  isValidCoordinate, // Import the missing function
} from './spatialUtils.ts';
import {
  calculateVesselNameSimilarity,
  calculateIMOSimilarity,
  calculateIncidentTypeSimilarity,
} from './similarityUtils.ts';

// Define a basic structure for the record object expected (adapt based on actual Supabase data)
// deno-lint-ignore no-explicit-any
type RawDataRecord = Record<string, any>; // Replace 'any' with a more specific type if possible

interface SimilarityScoreResult {
    total: number;
    time?: number;
    spatial?: number;
    vessel?: number;
    vesselName?: number;
    vesselIMO?: number;
    incidentType?: number;
    reason?: string;
    rawDistance?: number;
    rawTimeDifference?: number;
}

/**
 * Calculate composite similarity score between two incident records.
 * Assumes records are objects fetched from Supabase `raw_data` table.
 */
export async function calculateSimilarityScore(record1: RawDataRecord, record2: RawDataRecord): Promise<SimilarityScoreResult> {
  // Use direct property access for Supabase records
  const fields1 = record1;
  const fields2 = record2;

  // Ensure required fields exist
  if (!fields1.date || !fields2.date) {
    return { total: 0, reason: 'Missing date field' };
  }
  if (fields1.latitude === null || fields1.longitude === null || fields2.latitude === null || fields2.longitude === null) {
    return { total: 0, reason: 'Missing coordinates' };
  }

  // Calculate time proximity score
  const timeScore = calculateTimeProximityScore(fields1.date, fields2.date);
  if (timeScore === 0) {
    return { total: 0, reason: 'Time difference too large' };
  }

  // Calculate spatial proximity score
  const spatialScore = calculateSpatialProximityScore(
    fields1.latitude, // Assumes these are numbers
    fields1.longitude,
    fields2.latitude,
    fields2.longitude
  );
  if (spatialScore === 0) {
    return { total: 0, reason: 'Spatial distance too large' };
  }

  // Calculate vessel similarity
  const vesselNameScore = calculateVesselNameSimilarity(fields1.vessel_name, fields2.vessel_name);
  const vesselIMOScore = calculateIMOSimilarity(fields1.vessel_imo, fields2.vessel_imo);

  const bothMissingVesselInfo = (!fields1.vessel_name && !fields2.vessel_name);
  const vesselScore = vesselIMOScore === 1 ? 1 :
                     bothMissingVesselInfo ? 0.7 : // Assign default score if both missing
                     (vesselNameScore > 0 ? vesselNameScore : 0); // Use name score if available, else 0

  // Calculate incident type similarity
  const incidentTypeScore = await calculateIncidentTypeSimilarity(
    fields1.incident_type_name,
    fields2.incident_type_name
  );

  // Calculate total weighted score
  const totalScore =
    (timeScore * 0.4) +
    (spatialScore * 0.4) +
    (vesselScore * 0.1) +
    (incidentTypeScore * 0.1);

  // Log detailed scores for debugging
  log.info('Similarity score components', {
    recordIds: [record1.id, record2.id], // Assuming 'id' is the primary key
    timeScore,
    spatialScore,
    vesselScore,
    incidentTypeScore,
    totalScore: totalScore.toFixed(4),
  });

  return {
    total: totalScore,
    time: timeScore,
    spatial: spatialScore,
    vessel: vesselScore,
    vesselName: vesselNameScore,
    vesselIMO: vesselIMOScore,
    incidentType: incidentTypeScore,
    // Optionally include raw values if needed for debugging/analysis
    // rawDistance: calculateDistance(fields1.latitude, fields1.longitude, fields2.latitude, fields2.longitude),
    // rawTimeDifference: calculateTimeDifference(fields1.date, fields2.date),
  };
}

/**
 * Calculate record completeness score to help determine primary record.
 */
export function calculateCompletenessScore(record: RawDataRecord): number {
  let score = 0;
  const fields = record; // Direct access for Supabase records

  // Basic required fields
  if (fields.title) score += 1;
  if (fields.description && fields.description.length > 100) score += 3;
  else if (fields.description) score += 1;
  if (fields.latitude !== null && fields.longitude !== null) score += 2;
  if (fields.date) score += 1;
  if (fields.region) score += 1;
  if (fields.location) score += 1;

  // Vessel information
  if (fields.vessel_name) score += 1;
  if (fields.vessel_type) score += 1;
  if (fields.vessel_flag) score += 1;
  if (fields.vessel_imo) score += 2;
  if (fields.vessel_status) score += 1; // Assuming vessel_status exists

  // Additional details
  if (fields.incident_type_name) score += 1;
  // if (fields.incident_type_level) score += 1; // Check if this field exists in schema
  if (fields.reference) score += 1;
  if (fields.update_text) score += 2; // Check if update_text exists
  if (fields.raw_json) score += 1; // Check if raw_json exists and maybe its size

  return score;
}

/**
 * Determine source reliability priority. Higher values are more reliable.
 */
export function getSourcePriority(source: string | null | undefined): number {
  if (!source) return 0;
  const priorities: Record<string, number> = {
    RECAAP: 5,
    UKMTO: 4,
    MDAT: 3,
    ICC: 3,
    CWD: 2,
  };
  return priorities[source.toUpperCase()] || 1; // Default to 1 if source not listed
}

/**
 * Determine the primary record in a potential match based on completeness and source priority.
 */
export function determinePrimaryRecord(record1: RawDataRecord, record2: RawDataRecord): { primary: RawDataRecord; secondary: RawDataRecord } {
  const completeness1 = calculateCompletenessScore(record1);
  const completeness2 = calculateCompletenessScore(record2);
  const priority1 = getSourcePriority(record1.source);
  const priority2 = getSourcePriority(record2.source);

  // Weighted score: 70% completeness, 30% priority
  const score1 = (completeness1 * 0.7) + (priority1 * 0.3);
  const score2 = (completeness2 * 0.7) + (priority2 * 0.3);

  log.info('Primary record determination scores', {
    record1: { id: record1.id, source: record1.source, score: score1.toFixed(2) },
    record2: { id: record2.id, source: record2.source, score: score2.toFixed(2) },
  });

  // Choose primary (higher score wins, fallback to record1 if equal)
  if (score1 >= score2) {
    return { primary: record1, secondary: record2 };
  } else {
    return { primary: record2, secondary: record1 };
  }
}

/**
 * Merge complementary data from secondary record into primary record fields.
 * Returns an object containing only the fields that need to be updated on the primary record.
 */
// deno-lint-ignore no-explicit-any
export function mergeComplementaryData(primary: RawDataRecord, secondary: RawDataRecord): Record<string, any> {
  const primaryFields = primary; // Direct access
  const secondaryFields = secondary;
  const fieldsToUpdate: Record<string, any> = {};

  // Helper to decide if secondary field should overwrite primary
  const shouldUpdate = (primaryVal: any, secondaryVal: any): boolean => {
      // Update if primary is null/undefined/empty string and secondary is not
      return (primaryVal === null || primaryVal === undefined || primaryVal === '') &&
             (secondaryVal !== null && secondaryVal !== undefined && secondaryVal !== '');
  };

  // Merge description: Append secondary if different and non-empty
  if (secondaryFields.description && primaryFields.description !== secondaryFields.description) {
      if (!primaryFields.description) {
          fieldsToUpdate.description = secondaryFields.description;
      } else if (!primaryFields.description.includes(secondaryFields.description)) {
          // Append only if secondary isn't already contained within primary
          fieldsToUpdate.description = `${primaryFields.description}\n\n[Additional info from ${secondaryFields.source}]:\n${secondaryFields.description}`;
      }
  } else if (shouldUpdate(primaryFields.description, secondaryFields.description)) {
      fieldsToUpdate.description = secondaryFields.description;
  }

  // Merge update_text: Append secondary if non-empty
  const secondaryUpdate = secondaryFields.update_text?.trim();
  if (secondaryUpdate) {
      const primaryUpdate = primaryFields.update_text?.trim();
      const updatePrefix = `\n\n[Update from ${secondaryFields.source}]:\n${secondaryUpdate}`;
      fieldsToUpdate.update_text = primaryUpdate ? `${primaryUpdate}${updatePrefix}` : updatePrefix.trim();
  }

  // Merge simple fields (prefer secondary only if primary is empty)
  const simpleFields: (keyof RawDataRecord)[] = [
      'title', 'location', 'region', 'incident_type_name',
      'vessel_name', 'vessel_type', 'vessel_flag', 'vessel_imo', 'vessel_status'
      // Add other fields from raw_data schema that should be merged this way
  ];
  for (const field of simpleFields) {
      if (shouldUpdate(primaryFields[field], secondaryFields[field])) {
          fieldsToUpdate[field] = secondaryFields[field];
      }
  }

  // Merge coordinates only if primary is missing/invalid but secondary is valid
  if (!isValidCoordinate(primaryFields.latitude, primaryFields.longitude) && isValidCoordinate(secondaryFields.latitude, secondaryFields.longitude)) {
      fieldsToUpdate.latitude = secondaryFields.latitude;
      fieldsToUpdate.longitude = secondaryFields.longitude;
  }

  // Handle incident linkage (preserve link if either record has one)
  // Assumes 'incident_id' column exists in raw_data linking to cser.incident
  const primaryIncidentId = primaryFields.incident_id;
  const secondaryIncidentId = secondaryFields.incident_id;
  if (!primaryIncidentId && secondaryIncidentId) {
      fieldsToUpdate.incident_id = secondaryIncidentId;
      fieldsToUpdate.has_incident = true; // Assuming 'has_incident' boolean flag exists
      log.info(`Transferring incident link ${secondaryIncidentId} from secondary record ${secondary.id} to primary ${primary.id}`);
  } else if (primaryIncidentId && secondaryIncidentId && primaryIncidentId !== secondaryIncidentId) {
      // Both linked to *different* incidents - log warning, keep primary's link
      log.warn(`Potential duplicate incidents: Primary ${primary.id} linked to ${primaryIncidentId}, Secondary ${secondary.id} linked to ${secondaryIncidentId}. Keeping primary link.`);
      // No update needed for incident_id, primary already has it. Ensure has_incident is true.
      if (!primaryFields.has_incident) fieldsToUpdate.has_incident = true;
  } else if (primaryIncidentId && !primaryFields.has_incident) {
      // Ensure has_incident flag is set if primary has link but flag is false
      fieldsToUpdate.has_incident = true;
  }


  // Add merge metadata (these fields should exist in raw_data table)
  fieldsToUpdate.merge_status = 'merged'; // Mark primary as the merged record
  // Store details about the merge - consider JSONB for flexibility
  fieldsToUpdate.merge_details = {
      mergedAt: new Date().toISOString(),
      mergedSources: [primaryFields.source, secondaryFields.source].filter(Boolean), // Track sources involved
      // Add score details if needed: score: similarityScoreResult // Pass score into this function if needed
  };

  // Add processing notes (append to existing notes if any)
  const mergeNote = `Merged with ${secondaryFields.source} (${secondary.id}) on ${new Date().toISOString()}.`;
  fieldsToUpdate.processing_notes = primaryFields.processing_notes
      ? `${primaryFields.processing_notes}\n${mergeNote}`
      : mergeNote;

  // Update last processed timestamp
  fieldsToUpdate.last_processed = new Date().toISOString();

  // IMPORTANT: This function only returns the fields to *update* on the primary record.
  // The calling function needs to handle updating the primary and marking the secondary.
  return fieldsToUpdate;
}

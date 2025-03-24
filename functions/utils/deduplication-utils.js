/**
 * Utilities for record deduplication, matching, and merging
 */
import { log } from "./logger.js";
import {
  calculateTimeProximityScore,
  calculateSpatialProximityScore,
} from "./spatial-utils.js";
import {
  calculateVesselNameSimilarity,
  calculateIMOSimilarity,
  calculateIncidentTypeSimilarity,
} from "./similarity-utils.js";

/**
 * Calculate composite similarity score between two incident records
 * @param {Object} record1 - First incident record
 * @param {Object} record2 - Second incident record
 * @returns {Promise<Object>} Similarity score object with overall score and component scores
 */
export async function calculateSimilarityScore(record1, record2) {
  // Extract fields from records
  const fields1 = record1.fields;
  const fields2 = record2.fields;

  // Ensure required fields exist
  if (!fields1.date || !fields2.date) {
    return { total: 0, reason: "Missing date field" };
  }

  if (
    !fields1.latitude ||
    !fields1.longitude ||
    !fields2.latitude ||
    !fields2.longitude
  ) {
    return { total: 0, reason: "Missing coordinates" };
  }

  // Calculate time proximity score (1.0 = same time, 0.0 = 48+ hours apart)
  const timeScore = calculateTimeProximityScore(fields1.date, fields2.date);
  if (timeScore === 0) {
    return { total: 0, reason: "Time difference too large" };
  }

  // Calculate spatial proximity score (1.0 = same location, 0.0 = 50+ km apart)
  const spatialScore = calculateSpatialProximityScore(
    parseFloat(fields1.latitude),
    parseFloat(fields1.longitude),
    parseFloat(fields2.latitude),
    parseFloat(fields2.longitude)
  );
  if (spatialScore === 0) {
    return { total: 0, reason: "Spatial distance too large" };
  }

  // Calculate vessel similarity
  const vesselNameScore = calculateVesselNameSimilarity(
    fields1.vessel_name,
    fields2.vessel_name
  );

  const vesselIMOScore = calculateIMOSimilarity(
    fields1.vessel_imo,
    fields2.vessel_imo
  );

  // High IMO score should significantly boost vessel similarity
  const vesselScore = vesselIMOScore === 1 ? 1 : vesselNameScore;

  // Calculate incident type similarity
  const incidentTypeScore = await calculateIncidentTypeSimilarity(
    fields1.incident_type_name,
    fields2.incident_type_name
  );

  // Log detailed similarity scores for debugging
  log.info("Similarity score components", {
    recordIds: [record1.id, record2.id],
    timeScore,
    spatialScore,
    vesselNameScore,
    vesselIMOScore,
    incidentTypeScore,
  });

  // Calculate total weighted score
  // Weights: time 30%, space 30%, vessel 30%, type 10%
  const totalScore =
    timeScore * 0.3 +
    spatialScore * 0.3 +
    vesselScore * 0.3 +
    incidentTypeScore * 0.1;

  return {
    total: totalScore,
    time: timeScore,
    spatial: spatialScore,
    vessel: vesselScore,
    vesselName: vesselNameScore,
    vesselIMO: vesselIMOScore,
    incidentType: incidentTypeScore,
    rawDistance: calculateSpatialProximityScore(
      parseFloat(fields1.latitude),
      parseFloat(fields1.longitude),
      parseFloat(fields2.latitude),
      parseFloat(fields2.longitude),
      Number.MAX_SAFE_INTEGER // Pass max value to get actual distance
    ),
    rawTimeDifference: calculateTimeProximityScore(
      fields1.date,
      fields2.date,
      Number.MAX_SAFE_INTEGER // Pass max value to get actual time difference
    ),
  };
}

/**
 * Calculate record completeness score to determine primary record
 * @param {Object} record - Record to evaluate
 * @returns {number} Completeness score
 */
export function calculateCompletenessScore(record) {
  const fields = record.fields;
  let score = 0;

  // Basic required fields
  if (fields.title) score += 1;
  if (fields.description && fields.description.length > 100) score += 3;
  if (fields.latitude && fields.longitude) score += 2;
  if (fields.date) score += 1;
  if (fields.region) score += 1;
  if (fields.location) score += 1;

  // Vessel information
  if (fields.vessel_name) score += 1;
  if (fields.vessel_type) score += 1;
  if (fields.vessel_flag) score += 1;
  if (fields.vessel_imo) score += 2;
  if (fields.vessel_status) score += 1;

  // Additional details
  if (fields.incident_type_name) score += 1;
  if (fields.incident_type_level) score += 1;
  if (fields.reference) score += 1;
  if (fields.update) score += 2;
  if (fields.raw_json && fields.raw_json.length > 100) score += 1;

  return score;
}

/**
 * Determine source reliability priority
 * Higher values indicate more reliable sources
 * @param {string} source - Source name
 * @returns {number} Priority value
 */
export function getSourcePriority(source) {
  const priorities = {
    RECAAP: 5,
    UKMTO: 4,
    MDAT: 3,
    ICC: 3,
    CWD: 2,
  };

  return priorities[source] || 1;
}

/**
 * Determine the primary record in a potential match
 * @param {Object} record1 - First record
 * @param {Object} record2 - Second record
 * @returns {Object} Object containing primary and secondary record information
 */
export function determinePrimaryRecord(record1, record2) {
  const completeness1 = calculateCompletenessScore(record1);
  const completeness2 = calculateCompletenessScore(record2);

  const priority1 = getSourcePriority(record1.fields.source);
  const priority2 = getSourcePriority(record2.fields.source);

  // Weighted score combining completeness and source priority
  const score1 = completeness1 * 0.7 + priority1 * 0.3;
  const score2 = completeness2 * 0.7 + priority2 * 0.3;

  log.info("Primary record determination", {
    record1: {
      id: record1.id,
      source: record1.fields.source,
      completeness: completeness1,
      priority: priority1,
      score: score1,
    },
    record2: {
      id: record2.id,
      source: record2.fields.source,
      completeness: completeness2,
      priority: priority2,
      score: score2,
    },
  });

  // Choose the record with higher score as primary
  if (score1 >= score2) {
    return {
      primary: record1,
      secondary: record2,
      primaryScore: score1,
      secondaryScore: score2,
      primaryCompleteness: completeness1,
      secondaryCompleteness: completeness2,
    };
  } else {
    return {
      primary: record2,
      secondary: record1,
      primaryScore: score2,
      secondaryScore: score1,
      primaryCompleteness: completeness2,
      secondaryCompleteness: completeness1,
    };
  }
}

/**
 * Merge complementary data from two records
 * @param {Object} primary - Primary record
 * @param {Object} secondary - Secondary record
 * @returns {Object} Merged fields to update on primary record
 */
export function mergeComplementaryData(primary, secondary) {
  const primaryFields = primary.fields;
  const secondaryFields = secondary.fields;
  const mergedFields = {};

  // Helper function to choose best value
  const chooseBest = (field1, field2, preferLonger = false) => {
    if (!field1 && !field2) return null;
    if (!field1) return field2;
    if (!field2) return field1;

    if (preferLonger) {
      return field1.length >= field2.length ? field1 : field2;
    }
    return field1; // Default to primary
  };

  // Merge description - if secondary has additional info, append it
  if (primaryFields.description && secondaryFields.description) {
    // Only include secondary description if it adds new information
    if (
      !primaryFields.description.includes(secondaryFields.description) &&
      !secondaryFields.description.includes(primaryFields.description)
    ) {
      mergedFields.description = `${primaryFields.description}\n\nAdditional information from ${secondaryFields.source}:\n${secondaryFields.description}`;
    }
  } else {
    mergedFields.description = chooseBest(
      primaryFields.description,
      secondaryFields.description,
      true
    );
  }

  // Add update information from secondary source
  if (secondaryFields.update && secondaryFields.update.trim()) {
    if (primaryFields.update && primaryFields.update.trim()) {
      mergedFields.update = `${primaryFields.update}\n\nUpdate from ${secondaryFields.source}:\n${secondaryFields.update}`;
    } else {
      mergedFields.update = `Update from ${secondaryFields.source}:\n${secondaryFields.update}`;
    }
  }

  // Vessel information - prefer filled fields from either record
  if (!primaryFields.vessel_name && secondaryFields.vessel_name) {
    mergedFields.vessel_name = secondaryFields.vessel_name;
  }

  if (!primaryFields.vessel_type && secondaryFields.vessel_type) {
    mergedFields.vessel_type = secondaryFields.vessel_type;
  }

  if (!primaryFields.vessel_flag && secondaryFields.vessel_flag) {
    mergedFields.vessel_flag = secondaryFields.vessel_flag;
  }

  if (!primaryFields.vessel_imo && secondaryFields.vessel_imo) {
    mergedFields.vessel_imo = secondaryFields.vessel_imo;
  }

  if (!primaryFields.vessel_status && secondaryFields.vessel_status) {
    mergedFields.vessel_status = secondaryFields.vessel_status;
  }

  // Location information
  if (!primaryFields.location && secondaryFields.location) {
    mergedFields.location = secondaryFields.location;
  }

  // Create relationship record - we'll handle the related_raw_data relationship field
  // by using the Airtable link field format (array of record IDs)
  if (
    primaryFields.related_raw_data &&
    Array.isArray(primaryFields.related_raw_data)
  ) {
    // Add to existing related records
    mergedFields.related_raw_data = [
      ...primaryFields.related_raw_data,
      secondary.id,
    ];
  } else {
    // Create new related records array
    mergedFields.related_raw_data = [secondary.id];
  }

  // Add merge metadata
  mergedFields.merge_status = "merged";
  mergedFields.merge_score = JSON.stringify({
    primarySource: primaryFields.source,
    secondarySource: secondaryFields.source,
    mergeDate: new Date().toISOString(),
  });

  // Add processing notes
  const mergeNote = `Merged with complementary data from ${secondaryFields.source} (${secondary.id}) at ${new Date().toISOString()}`;

  if (primaryFields.processing_notes) {
    mergedFields.processing_notes = `${primaryFields.processing_notes}\n${mergeNote}`;
  } else {
    mergedFields.processing_notes = mergeNote;
  }

  // Mark the last processed time
  mergedFields.last_processed = new Date().toISOString();

  return mergedFields;
}

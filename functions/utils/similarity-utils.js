/**
 * Utility functions for calculating similarity between different types of data
 */
import { referenceData } from "./reference-data.js";
import { log } from "./logger.js";

/**
 * Calculate similarity score between vessel names
 * @param {string|null} name1 - First vessel name
 * @param {string|null} name2 - Second vessel name
 * @returns {number} Similarity score between 0 and 1
 */
export function calculateVesselNameSimilarity(name1, name2) {
  // If either name is null or undefined, return 0
  if (!name1 || !name2) return 0;

  // Normalize names: convert to uppercase, remove common terms
  const normalize = (name) =>
    name
      .toUpperCase()
      .replace(/M[/]?V\s+|\s+M[/]?V|\bMOTOR\s+VESSEL\b|\bVESSEL\b/gi, "")
      .replace(/M[/]?T\s+|\s+M[/]?T|\bMOTOR\s+TANKER\b|\bTANKER\b/gi, "")
      .trim();

  const normalizedName1 = normalize(name1);
  const normalizedName2 = normalize(name2);

  // If normalized names are equal, return 1
  if (normalizedName1 === normalizedName2) return 1;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedName1, normalizedName2);

  // Calculate similarity as 1 - normalized distance
  const maxLen = Math.max(normalizedName1.length, normalizedName2.length);
  if (maxLen === 0) return 1; // Both strings are empty

  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance
 */
export function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create matrix of size (len1+1) x (len2+1)
  const matrix = Array(len1 + 1)
    .fill()
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between IMO numbers
 * @param {string|null} imo1 - First IMO number
 * @param {string|null} imo2 - Second IMO number
 * @returns {number} Similarity score, either 0 or 1
 */
export function calculateIMOSimilarity(imo1, imo2) {
  // If both IMO numbers are present and equal, return 1
  if (imo1 && imo2 && imo1.toString() === imo2.toString()) return 1;
  return 0;
}

/**
 * Calculate similarity score for incident types using reference data
 * @param {string|null} type1 - First incident type
 * @param {string|null} type2 - Second incident type
 * @returns {Promise<number>} Similarity score between 0 and 1
 */
export async function calculateIncidentTypeSimilarity(type1, type2) {
  if (!type1 || !type2) return 0;

  // Normalize incident types
  const normalizeType = (type) => type.toUpperCase().trim();
  const normalizedType1 = normalizeType(type1);
  const normalizedType2 = normalizeType(type2);

  // If normalized types are equal, return 1
  if (normalizedType1 === normalizedType2) return 1;

  try {
    // Get incident types from reference data
    const incidentTypes = await referenceData.getIncidentTypes();

    // Define similarity groups based on reference data relationships
    // This is a placeholder implementation - in a real system, these relationships
    // might be explicitly defined in the reference data
    const similarityGroups = [
      ["Robbery", "Robbery/Theft", "Theft"],
      ["Boarding", "Attempted Boarding", "Boarded"],
      [
        "Suspicious Approach",
        "Approach",
        "Suspicious Activity",
        "Suspicious Vessel",
      ],
      ["Piracy", "Hijack", "Hijacking", "Kidnapping"],
      [
        "Attack",
        "Armed Attack",
        "Missile Attack",
        "Drone Attack",
        "UAV Attack",
        "USV Attack",
      ],
      ["Threat", "Missile Threat", "Piracy Threat", "Warning"],
    ];

    // Check if they belong to the same group
    for (const group of similarityGroups) {
      const normalizedGroup = group.map(normalizeType);
      if (
        normalizedGroup.includes(normalizedType1) &&
        normalizedGroup.includes(normalizedType2)
      ) {
        return 0.8; // High similarity for types in the same group
      }
    }

    // Calculate word-level similarity for mixed categories
    const words1 = normalizedType1.split(/\s+/);
    const words2 = normalizedType2.split(/\s+/);
    let matchCount = 0;

    for (const word1 of words1) {
      if (words2.includes(word1)) matchCount++;
    }

    // Return a proportional similarity score
    return matchCount / Math.max(words1.length, words2.length);
  } catch (error) {
    log.info("Error calculating incident type similarity", {
      error: error.message,
      type1,
      type2,
    });

    // Fallback to basic string similarity if reference data is unavailable
    const words1 = normalizedType1.split(/\s+/);
    const words2 = normalizedType2.split(/\s+/);
    let matchCount = 0;

    for (const word1 of words1) {
      if (words2.includes(word1)) matchCount++;
    }

    return matchCount / Math.max(words1.length, words2.length);
  }
}

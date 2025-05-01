/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { referenceData } from './referenceData.ts'; // Import ported reference data utility
import { log } from './logger.ts';

/**
 * Calculate Levenshtein distance between two strings.
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

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
 * Calculate similarity score between vessel names (0 to 1).
 * Normalizes names before comparing using Levenshtein distance.
 */
export function calculateVesselNameSimilarity(name1: string | null | undefined, name2: string | null | undefined): number {
  if (!name1 || !name2) return 0;

  const normalize = (name: string): string =>
    name
      .toUpperCase()
      .replace(/M[\/]?V\s+|\s+M[\/]?V|\bMOTOR\s+VESSEL\b|\bVESSEL\b/gi, '')
      .replace(/M[\/]?T\s+|\s+M[\/]?T|\bMOTOR\s+TANKER\b|\bTANKER\b/gi, '')
      .replace(/[^A-Z0-9]/gi, '') // Remove non-alphanumeric for stricter comparison? Optional.
      .trim();

  const normalizedName1 = normalize(name1);
  const normalizedName2 = normalize(name2);

  if (normalizedName1 === normalizedName2) return 1;
  if (normalizedName1.length === 0 || normalizedName2.length === 0) return 0; // Avoid division by zero if one name normalizes to empty

  const distance = levenshteinDistance(normalizedName1, normalizedName2);
  const maxLen = Math.max(normalizedName1.length, normalizedName2.length);

  return Math.max(0, 1 - distance / maxLen); // Ensure score is not negative
}

/**
 * Calculate similarity score between IMO numbers (0 or 1).
 */
export function calculateIMOSimilarity(imo1: string | number | null | undefined, imo2: string | number | null | undefined): number {
  // Convert numbers to strings for comparison, handle null/undefined
  const strImo1 = imo1?.toString() || null;
  const strImo2 = imo2?.toString() || null;

  if (strImo1 && strImo2 && strImo1 === strImo2) return 1;
  return 0;
}

/**
 * Calculate similarity score for incident types using reference data (0 to 1).
 */
export async function calculateIncidentTypeSimilarity(type1: string | null | undefined, type2: string | null | undefined): Promise<number> {
  if (!type1 || !type2) return 0;

  const normalizeType = (type: string): string => type.toUpperCase().trim();
  const normalizedType1 = normalizeType(type1);
  const normalizedType2 = normalizeType(type2);

  if (normalizedType1 === normalizedType2) return 1;

  try {
    // Similarity groups (consider making these configurable or part of reference data)
    const similarityGroups: string[][] = [
      ['ROBBERY', 'ROBBERY/THEFT', 'THEFT'],
      ['BOARDING', 'ATTEMPTED BOARDING', 'BOARDED'],
      ['SUSPICIOUS APPROACH', 'APPROACH', 'SUSPICIOUS ACTIVITY', 'SUSPICIOUS VESSEL'],
      ['PIRACY', 'HIJACK', 'HIJACKING', 'KIDNAPPING'],
      ['ATTACK', 'ARMED ATTACK', 'MISSILE ATTACK', 'DRONE ATTACK', 'UAV ATTACK', 'USV ATTACK', 'EXPLOSION'],
      ['THREAT', 'MISSILE THREAT', 'PIRACY THREAT', 'WARNING'],
      ['DETENTION', 'SEIZURE', 'ARREST'],
    ];

    // Check if types belong to the same predefined group
    for (const group of similarityGroups) {
      const normalizedGroup = group.map(normalizeType); // Ensure group items are normalized
      if (normalizedGroup.includes(normalizedType1) && normalizedGroup.includes(normalizedType2)) {
        return 0.8; // High similarity for types in the same group
      }
    }

    // Fallback: Calculate word-level similarity if not in the same group
    const words1 = normalizedType1.split(/\s+/).filter(w => w.length > 0);
    const words2 = normalizedType2.split(/\s+/).filter(w => w.length > 0);
    if (words1.length === 0 || words2.length === 0) return 0; // Avoid division by zero

    let matchCount = 0;
    for (const word1 of words1) {
      if (words2.includes(word1)) matchCount++;
    }
    return matchCount / Math.max(words1.length, words2.length);

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error('Error calculating incident type similarity', { error: error.message, type1, type2 });
    // Basic fallback without groups if reference data fetch failed (though it shouldn't with current setup)
    const words1 = normalizedType1.split(/\s+/).filter(w => w.length > 0);
    const words2 = normalizedType2.split(/\s+/).filter(w => w.length > 0);
    if (words1.length === 0 || words2.length === 0) return 0;
    let matchCount = 0;
    for (const word1 of words1) {
      if (words2.includes(word1)) matchCount++;
    }
    return matchCount / Math.max(words1.length, words2.length);
  }
}

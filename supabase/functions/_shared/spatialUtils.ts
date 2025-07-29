/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

/**
 * Check if coordinates are valid numbers within standard ranges and not (0,0).
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }
  // Consider (0, 0) invalid as it often indicates missing data
  if (lat === 0 && lon === 0) {
    return false;
  }
  return true;
}

/**
 * Haversine formula to calculate distance between two geographical points.
 * @returns Distance in kilometers, or Infinity if coordinates are invalid.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    log.warn('Invalid coordinates provided to calculateDistance', { lat1, lon1, lat2, lon2 });
    return Infinity; // Return large distance for invalid coordinates
  }

  const toRadians = (degree: number): number => (degree * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Calculate time difference between two date strings or Date objects in hours.
 * @returns Absolute time difference in hours, or Infinity if dates are invalid.
 */
export function calculateTimeDifference(date1: string | Date | null | undefined, date2: string | Date | null | undefined): number {
  if (!date1 || !date2) {
    return Infinity;
  }

  try {
    const time1 = (date1 instanceof Date ? date1 : new Date(date1)).getTime();
    const time2 = (date2 instanceof Date ? date2 : new Date(date2)).getTime();

    if (isNaN(time1) || isNaN(time2)) {
        log.warn('Invalid date format provided to calculateTimeDifference', { date1, date2 });
        return Infinity;
    }

    return Math.abs(time1 - time2) / (1000 * 60 * 60); // Convert milliseconds to hours
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Error parsing dates in calculateTimeDifference', { date1, date2, error: error.message });
    return Infinity; // Return large time difference on parsing error
  }
}

/**
 * Calculate time-based proximity score (0 to 1).
 * Score decreases linearly from 1 (0 hours diff) to 0 (maxHours diff).
 */
export function calculateTimeProximityScore(date1: string | Date | null | undefined, date2: string | Date | null | undefined, maxHours: number = 48): number {
  if (maxHours <= 0) return 0; // Avoid division by zero or negative maxHours
  const timeDifference = calculateTimeDifference(date1, date2);
  if (timeDifference === Infinity) return 0; // Invalid dates result in 0 score
  return Math.max(0, 1 - timeDifference / maxHours);
}

/**
 * Calculate spatial proximity score (0 to 1).
 * Score decreases linearly from 1 (0 km diff) to 0 (maxDistance diff).
 */
export function calculateSpatialProximityScore(lat1: number, lon1: number, lat2: number, lon2: number, maxDistance: number = 50): number {
  if (maxDistance <= 0) return 0; // Avoid division by zero or negative maxDistance
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  if (distance === Infinity) return 0; // Invalid coordinates result in 0 score
  return Math.max(0, 1 - distance / maxDistance);
}

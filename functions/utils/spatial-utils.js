/**
 * Utility functions for spatial and temporal calculations
 */

/**
 * Haversine formula to calculate distance between two geographical points
 * @param {number} lat1 - Latitude of first point in decimal degrees
 * @param {number} lon1 - Longitude of first point in decimal degrees
 * @param {number} lat2 - Latitude of second point in decimal degrees
 * @param {number} lon2 - Longitude of second point in decimal degrees
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Handle invalid inputs
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Number.MAX_SAFE_INTEGER; // Return large distance if coordinates are invalid
  }

  // Convert latitude and longitude from degrees to radians
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Calculate time difference between two dates in hours
 * @param {string} date1 - ISO date string for first date
 * @param {string} date2 - ISO date string for second date
 * @returns {number} Absolute time difference in hours
 */
export function calculateTimeDifference(date1, date2) {
  // Handle invalid inputs
  if (!date1 || !date2) {
    return Number.MAX_SAFE_INTEGER; // Return large time difference if dates are invalid
  }

  try {
    const time1 = new Date(date1).getTime();
    const time2 = new Date(date2).getTime();
    return Math.abs(time1 - time2) / (1000 * 60 * 60); // Convert milliseconds to hours
  } catch (error) {
    return Number.MAX_SAFE_INTEGER; // Return large time difference if dates are invalid
  }
}

/**
 * Check if coordinates are valid
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @returns {boolean} Whether coordinates are valid
 */
export function isValidCoordinate(lat, lon) {
  // Check if coordinates are numbers
  if (typeof lat !== "number" || typeof lon !== "number") {
    return false;
  }

  // Check if coordinates are in valid range
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }

  // Check for zero coordinates (often indicate missing data)
  if (lat === 0 && lon === 0) {
    return false;
  }

  return true;
}

/**
 * Calculate time-based proximity score
 * @param {string} date1 - ISO date string for first date
 * @param {string} date2 - ISO date string for second date
 * @param {number} maxHours - Maximum hours difference for a non-zero score (default: 48)
 * @returns {number} Proximity score between 0 and 1
 */
export function calculateTimeProximityScore(date1, date2, maxHours = 48) {
  const timeDifference = calculateTimeDifference(date1, date2);
  return Math.max(0, 1 - timeDifference / maxHours);
}

/**
 * Calculate spatial proximity score
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {number} maxDistance - Maximum distance in km for a non-zero score (default: 50)
 * @returns {number} Proximity score between 0 and 1
 */
export function calculateSpatialProximityScore(
  lat1,
  lon1,
  lat2,
  lon2,
  maxDistance = 50
) {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return Math.max(0, 1 - distance / maxDistance);
}

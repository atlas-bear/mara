/**
 * Formats decimal coordinates to degrees, minutes, seconds format
 * @param {number} decimal - The decimal coordinate
 * @param {boolean} isLatitude - True if formatting latitude, false for longitude
 * @returns {string} Formatted coordinate string
 */
export function formatCoordinates(decimal, isLatitude) {
  const direction = isLatitude
    ? decimal >= 0
      ? "N"
      : "S"
    : decimal >= 0
    ? "E"
    : "W";

  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Formats a pair of coordinates to a complete location string
 * @param {number} lat - Latitude in decimal format
 * @param {number} lng - Longitude in decimal format
 * @returns {string} Complete formatted coordinate string
 */
export function formatLocation(lat, lng) {
  return `${formatCoordinates(lat, true)}, ${formatCoordinates(lng, false)}`;
}

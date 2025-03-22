/**
 * Converts a string to title case format (first letter of each word capitalized)
 * 
 * @param {string} str - The string to convert to title case
 * @returns {string} The string with the first letter of each word capitalized
 */
export function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()
  );
}

/**
 * Cleans a text string by trimming whitespace and normalizing internal spaces
 * 
 * @param {string} text - The text string to clean
 * @returns {string} The cleaned text with normalized spaces
 */
export function cleanText(text) {
  return text.trim().replace(/\s+/g, " ");
}

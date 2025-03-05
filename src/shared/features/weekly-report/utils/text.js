/**
 * Extract the first sentence from a text string
 * @param {string} text - The text to process
 * @returns {string} - The first sentence or empty string if text is empty
 */
export const getFirstSentence = (text) => {
  if (!text) return '';
  // Match until the first period followed by a space or end of string
  const match = text.match(/^.*?\.(?:\s|$)/);
  return match ? match[0].trim() : text;
};
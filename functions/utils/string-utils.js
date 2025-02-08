export function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.substr(1).toLowerCase()
  );
}

export function cleanText(text) {
  return text.trim().replace(/\s+/g, " ");
}

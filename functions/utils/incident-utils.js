import { toTitleCase } from "./string-utils.js";

export async function determineIncidentType(text, incidentTypes) {
  const lowerText = text.toLowerCase();

  // Common word variations for incident types
  const wordVariations = {
    robbery: ["robber", "robbers", "robbery"],
    attack: ["attack", "attacked", "attacking"],
    boarding: ["board", "boarded", "boarding"],
    attempt: ["attempt", "attempted", "attempting"],
    suspicious: ["suspect", "suspicious", "suspicion"],
    approach: ["approach", "approached", "approaching"],
    theft: ["theft", "thief", "thieves", "steal", "stole", "stolen"],
    piracy: ["piracy", "pirate", "pirates"],
    hijack: ["hijack", "hijacked", "hijacking"],
    unauthorized: ["unauthorized", "unauthorised", "illegal"],
    armed: ["arm", "armed", "arms", "weapon", "weapons"],
  };

  // Try to find matching incident type from reference data
  const matchedType = incidentTypes.find((type) => {
    const typeName = type.name.toLowerCase();

    // Check direct match first
    if (lowerText.includes(typeName)) {
      return true;
    }

    // Check word variations
    for (const [baseWord, variations] of Object.entries(wordVariations)) {
      if (typeName.includes(baseWord)) {
        // If type contains this base word, check for any variations in text
        if (variations.some((variant) => lowerText.includes(variant))) {
          return true;
        }
      }
    }

    return false;
  });

  if (matchedType) {
    return toTitleCase(matchedType.name);
  }

  // Fallback logic if no match found
  if (
    lowerText.includes("armed") ||
    lowerText.includes("weapon") ||
    lowerText.includes("gun")
  ) {
    return "Armed Attack";
  } else if (lowerText.includes("board") && lowerText.includes("attempt")) {
    return "Attempted Boarding";
  } else if (lowerText.includes("board")) {
    return "Boarding";
  }

  return "Suspicious Approach";
}

export function determineSeverity(text) {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("gun") ||
    lowerText.includes("weapon") ||
    lowerText.includes("hostage")
  ) {
    return "high";
  } else if (lowerText.includes("knife") || lowerText.includes("armed")) {
    return "medium";
  }

  return "low";
}

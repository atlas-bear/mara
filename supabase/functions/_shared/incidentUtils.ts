/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

// Import necessary types/functions if they exist in other shared files
import { log } from './logger.ts';
// Import toTitleCase if it's defined in vesselUtils or move to a common stringUtils
// For now, assuming it's exported from vesselUtils (adjust if moved)
// import { toTitleCase } from './vesselUtils.ts'; // This might cause circular dependency if vesselUtils imports this.
// Let's redefine it here for simplicity, or create stringUtils.ts later.

function toTitleCase(str: unknown): string | unknown {
  if (typeof str !== 'string' || !str) return str;
  try {
    return str.replace(
      /\b\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Error in toTitleCase (incidentUtils)', { input: str, error: error.message });
    return str;
  }
}


// Interface for the expected structure of incident type reference data
interface IncidentTypeRef {
    id: string;
    name: string; // Expect lowercase name for matching
}

/**
 * Determines the incident type based on text analysis and reference data.
 * Ported from incident-utils.js.
 *
 * @param text - The incident text to analyze (title or description).
 * @param incidentTypes - Reference data of possible incident types (expecting name property).
 * @returns The determined incident type name (Title Case) or a default.
 */
export function determineIncidentType(text: string | null | undefined, incidentTypes: IncidentTypeRef[]): string {
  if (!text || !Array.isArray(incidentTypes) || incidentTypes.length === 0) {
    return 'Unknown'; // Default if no text or types
  }

  const lowerText = text.toLowerCase();

  // Common word variations for incident types
  const wordVariations: Record<string, string[]> = {
    robbery: ['robber', 'robbers', 'robbery'],
    attack: ['attack', 'attacked', 'attacking'],
    boarding: ['board', 'boarded', 'boarding'],
    attempt: ['attempt', 'attempted', 'attempting'],
    suspicious: ['suspect', 'suspicious', 'suspicion'],
    approach: ['approach', 'approached', 'approaching'],
    theft: ['theft', 'thief', 'thieves', 'steal', 'stole', 'stolen'],
    piracy: ['piracy', 'pirate', 'pirates'],
    hijack: ['hijack', 'hijacked', 'hijacking'],
    unauthorized: ['unauthorized', 'unauthorised', 'illegal'],
    armed: ['arm', 'armed', 'arms', 'weapon', 'weapons'],
    kidnap: ['kidnap', 'kidnapped', 'abducted', 'abduction'], // Added kidnap
    explosion: ['explosion', 'exploded', 'bomb', 'ied'], // Added explosion
    detention: ['detention', 'detained', 'seized', 'seizure'], // Added detention
  };

  // Sort incident types by length (longest first) for better matching
  const sortedTypes = [...incidentTypes]
    .filter(type => typeof type.name === 'string')
    .sort((a, b) => b.name.length - a.name.length);

  // Try to find matching incident type from reference data
  const matchedType = sortedTypes.find((type) => {
    // Assumes type.name is already lowercase from referenceData fetch
    const typeNameLower = type.name; // Already lowercase

    // Check direct match first
    if (lowerText.includes(typeNameLower)) {
      return true;
    }

    // Check word variations
    for (const [baseWord, variations] of Object.entries(wordVariations)) {
      if (typeNameLower.includes(baseWord)) {
        // If type contains this base word, check for any variations in text
        if (variations.some((variant) => lowerText.includes(variant))) {
          return true;
        }
      }
    }
    return false;
  });

  if (matchedType) {
    // Convert the matched name (lowercase) back to Title Case for return
    return toTitleCase(matchedType.name) as string;
  }

  // Fallback logic if no match found based on keywords
  if (lowerText.includes('explosion') || lowerText.includes('bomb')) return 'Explosion';
  if (lowerText.includes('kidnap') || lowerText.includes('abduct')) return 'Kidnapping';
  if (lowerText.includes('hijack')) return 'Hijacking';
  if (lowerText.includes('detain') || lowerText.includes('seize') || lowerText.includes('arrest')) return 'Detention';
  if (lowerText.includes('armed') || lowerText.includes('weapon') || lowerText.includes('gun')) return 'Armed Attack';
  if (lowerText.includes('board') && lowerText.includes('attempt')) return 'Attempted Boarding';
  if (lowerText.includes('board')) return 'Boarding';
  if (lowerText.includes('robbery') || lowerText.includes('robber')) return 'Robbery';
  if (lowerText.includes('theft') || lowerText.includes('steal') || lowerText.includes('stole')) return 'Theft';
  if (lowerText.includes('suspicious') || lowerText.includes('suspect')) return 'Suspicious Activity';
  if (lowerText.includes('approach')) return 'Approach'; // Approach is less severe than Suspicious Activity

  return 'Unknown'; // Final fallback
}


/**
 * Determines the severity level of an incident based on text analysis.
 * Ported from incident-utils.js.
 *
 * @param text - The incident text to analyze.
 * @returns The severity level: "High", "Medium", "Low", or null.
 */
export function determineSeverity(text: string | null | undefined): 'High' | 'Medium' | 'Low' | null {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Prioritize High severity keywords
    if (
        lowerText.includes('shot') || // Fired shots
        lowerText.includes('fire') || // Exchanged fire, set fire to
        lowerText.includes('kill') || // Killed
        lowerText.includes('injur') || // Injured (covers injury, injuries)
        lowerText.includes('hostage') || // Hostages taken
        lowerText.includes('kidnap') || // Kidnapped
        lowerText.includes('abduct') || // Abducted
        lowerText.includes('hijack') || // Hijacked
        lowerText.includes('explosion') || // Explosion
        lowerText.includes('bomb') || // Bomb involved
        (lowerText.includes('gun') && !lowerText.includes('no gun')) // Guns mentioned (unless explicitly negated)
    ) {
        return 'High';
    }

    // Medium severity keywords
    if (
        lowerText.includes('weapon') || // General weapons
        lowerText.includes('armed') || // Perpetrators were armed
        lowerText.includes('knife') || // Knives mentioned (plural: knives)
        lowerText.includes('machete') || // Machetes mentioned
        lowerText.includes('boarded') || // Vessel was boarded
        lowerText.includes('robbery') || // Robbery occurred
        lowerText.includes('assault') || // Assault mentioned
        lowerText.includes('threaten') // Crew threatened
    ) {
        return 'Medium';
    }

    // Low severity keywords (less critical, might overlap with medium but checked last)
     if (
        lowerText.includes('theft') || // Theft occurred
        lowerText.includes('stole') || // Items stolen
        lowerText.includes('attempt') || // Attempted action (boarding, robbery etc.)
        lowerText.includes('approach') || // Vessel approached
        lowerText.includes('suspicious') || // Suspicious activity/vessel
        lowerText.includes('sighting') // Sighting reported
    ) {
        return 'Low';
    }

    // Default if no keywords match
    return null; // Or return 'Low' as a default? Returning null for clarity.
}

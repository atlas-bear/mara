/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

// Ported from string-utils.js and adapted for TypeScript
function toTitleCase(str: unknown): string | unknown {
  if (typeof str !== 'string' || !str) return str;
  try {
    // Use regex that handles words correctly
    return str.replace(
      /\b\w\S*/g, // Match word boundaries and subsequent non-space characters
      (word) => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.warn('Error in toTitleCase', { input: str, error: error.message });
    return str; // Return original on error
  }
}

// Ported from vessel-utils.js
export function determineVesselStatus(text: string | null | undefined): string {
  if (!text) return 'Other'; // Default if no text provided

  const lowerText = text.toLowerCase();

  if (lowerText.includes('underway')) {
    return 'Underway';
  } else if (lowerText.includes('anchor')) {
    return 'Anchored';
  } else if (lowerText.includes('moor')) {
    return 'Moored';
  } else if (lowerText.includes('berth')) {
    return 'Berthed';
  } else if (lowerText.includes('tow')) {
    return 'Under Tow';
  } else if (
    lowerText.includes('not under command') ||
    lowerText.includes('unable to maneuver')
  ) {
    return 'Not Under Command';
  }
  // Add more specific statuses if needed (e.g., Operating from incident_vessel enum)
  if (lowerText.includes('operating')) {
      return 'Operating';
  }
  return 'Other'; // Default status
}

// Ported from vessel-utils.js
// Interface for the expected structure of vessel type reference data
interface VesselTypeRef {
    id: string;
    name: string; // Expect lowercase name for matching
}

interface ExtractedVesselInfo {
    name: string | null;
    type: string | null; // Will be Title Case
    status: string; // Standardized status
    flag: string | null;
    imo: string | null;
}

export function extractVesselInfo(text: string | null | undefined, vesselTypes: VesselTypeRef[]): ExtractedVesselInfo {
  const vesselInfo: ExtractedVesselInfo = {
    name: null, // TODO: Implement name extraction if needed
    type: null,
    status: determineVesselStatus(text),
    flag: null, // TODO: Implement flag extraction if needed
    imo: null,  // TODO: Implement IMO extraction if needed
  };

  if (!text || !Array.isArray(vesselTypes) || vesselTypes.length === 0) {
    return vesselInfo; // Return defaults if no text or types
  }

  const lowerText = text.toLowerCase();

  // Sort vessel types by length (longest first) to ensure we match "bulk carrier" before "carrier"
  // Ensure names are strings before comparing length
  const sortedTypes = [...vesselTypes]
    .filter(type => typeof type.name === 'string')
    .sort((a, b) => b.name.length - a.name.length);

  // Find matching vessel type from reference data
  // Ensure type.name is treated as lowercase for comparison
  const matchedType = sortedTypes.find((type) =>
    lowerText.includes(type.name) // Assumes type.name is already lowercase from referenceData fetch
  );

  if (matchedType) {
    // Convert the matched name (which should be lowercase) back to Title Case
    vesselInfo.type = toTitleCase(matchedType.name) as string | null;
  }

  // TODO: Implement extraction logic for name, flag, IMO if required by parsing sitrep text

  return vesselInfo;
}

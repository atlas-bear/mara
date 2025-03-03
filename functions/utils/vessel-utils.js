import { toTitleCase } from "./string-utils.js";
import axios from "axios";

/**
 * Fetches a vessel by IMO number from Airtable
 * @param {string} imoNumber - The IMO number of the vessel to fetch
 * @returns {Object|null} The vessel data or null if not found
 */
export async function getVesselByIMO(imoNumber) {
  if (!imoNumber) {
    throw new Error("IMO number is required");
  }

  // Fetch vessel from Airtable
  const response = await axios.get(
    `https://api.airtable.com/v0/${process.env.AT_BASE_ID_CSER}/vessel`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AT_API_KEY}`,
        "Content-Type": "application/json",
      },
      params: {
        filterByFormula: `{imo}="${imoNumber}"`,
        maxRecords: 1,
      },
    }
  );

  if (response.data.records && response.data.records.length > 0) {
    return response.data.records[0].fields;
  }

  return null;
}

export function determineVesselStatus(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("underway")) {
    return "Underway";
  } else if (lowerText.includes("anchor")) {
    return "Anchored";
  } else if (lowerText.includes("moor")) {
    return "Moored";
  } else if (lowerText.includes("berth")) {
    return "Berthed";
  } else if (lowerText.includes("tow")) {
    return "Under Tow";
  } else if (
    lowerText.includes("not under command") ||
    lowerText.includes("unable to maneuver")
  ) {
    return "Not Under Command";
  }
  return "Other";
}

export function extractVesselInfo(text, vesselTypes) {
  const vesselInfo = {
    name: null,
    type: null,
    status: determineVesselStatus(text),
    flag: null,
    imo: null,
  };

  const lowerText = text.toLowerCase();

  // Sort vessel types by length (longest first) to ensure we match "bulk carrier" before "carrier"
  const sortedTypes = [...vesselTypes].sort(
    (a, b) => b.name.length - a.name.length
  );

  // Find matching vessel type from reference data
  const matchedType = sortedTypes.find((type) =>
    lowerText.includes(type.name.toLowerCase())
  );

  if (matchedType) {
    vesselInfo.type = toTitleCase(matchedType.name);
  }

  return vesselInfo;
}

export function extractVesselName(text) {
  // TODO: Implement vessel name extraction if needed
  return null;
}

export function extractVesselFlag(text) {
  // TODO: Implement vessel flag extraction if needed
  return null;
}

export function extractVesselIMO(text) {
  // TODO: Implement IMO number extraction if needed
  return null;
}

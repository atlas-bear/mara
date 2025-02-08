import { toTitleCase } from "./string-utils.js";

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
  const matchedType = vesselTypes.find((type) =>
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

/**
 * Shared reference data for prompts
 * 
 * This file contains standardized lists and options used across different prompts
 * to ensure consistency in how we categorize and analyze maritime incidents.
 */

/**
 * Weapon types that can be identified in incidents
 */
export const WEAPONS = [
  "Firearms (unspecified)",
  "Knives",
  "Armed individuals (type unspecified)",
  "Parangs",
  "AK-47s",
  "Machine Guns",
  "Handguns",
  "Improvised weapons",
  "Missiles",
  "UAVs",
  "USVs",
  "Limpet mines",
  "None",
  "Other weapons"
];

/**
 * Types of items that can be stolen during incidents
 */
export const ITEMS_STOLEN = [
  "None",
  "Engine Spare Parts",
  "None reported",
  "Engine spares",
  "Vessel under pirate control",
  "Vessel equipment",
  "Crew valuables",
  "Funds from crew accounts",
  "Ship supplies",
  "Personal belongings",
  "Other items"
];

/**
 * Types of response to incidents
 */
export const RESPONSE_TYPES = [
  "Naval",
  "Coalition Forces",
  "Coast Guard",
  "Security incident reported",
  "Military response and monitoring",
  "Military incident",
  "Evasive maneuvers",
  "Self-defense measures",
  "Other response",
  "No response mentioned"
];

/**
 * Authorities that can be notified about incidents
 */
export const AUTHORITIES = [
  "UKMTO",
  "Coalition Forces",
  "Flag State",
  "VTIS West",
  "Singapore Navy",
  "Police Coast Guard",
  "Singapore VTIS",
  "EUNAVFOR",
  "Puntland Maritime Police Force",
  "Somali Authorities",
  "Chinese Authorities",
  "EU Delegation to Somalia",
  "Russian Naval Command",
  "Russian Military Authorities",
  "Mexican Maritime Authorities", 
  "Local Maritime Authority",
  "Other authorities",
  "None mentioned"
];

/**
 * Maritime regions for reporting and analysis
 */
export const REGIONS = [
  "West Africa",
  "Southeast Asia",
  "Indian Ocean", 
  "Red Sea",
  "Americas",
  "Europe",
  "Mediterranean",
  "Persian Gulf",
  "Gulf of Aden"
];

/**
 * Get reference data by category
 * @param {string} category - Category of reference data
 * @returns {Array} List of options for the category
 */
export const getReferenceData = (category) => {
  switch (category.toLowerCase()) {
    case 'weapons':
      return WEAPONS;
    case 'items_stolen':
      return ITEMS_STOLEN;
    case 'response_types':
      return RESPONSE_TYPES;
    case 'authorities':
      return AUTHORITIES;
    case 'regions':
      return REGIONS;
    default:
      return [];
  }
};
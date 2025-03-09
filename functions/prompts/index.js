import {
  createIncidentAnalysisPrompt,
  promptConfig as incidentAnalysisConfig,
} from "./incident-analysis.js";

export const prompts = {
  incidentAnalysis: {
    createPrompt: createIncidentAnalysisPrompt,
    config: incidentAnalysisConfig,
  },
  // Add other prompt types here as your system grows
};

/**
 * Get prompt and configuration for a specific prompt type
 * @param {string} promptType - The type of prompt to retrieve
 * @returns {Object} - Object containing prompt creation function and config
 */
export const getPrompt = (promptType) => {
  if (!prompts[promptType]) {
    throw new Error(`Prompt type '${promptType}' not found`);
  }
  return prompts[promptType];
};

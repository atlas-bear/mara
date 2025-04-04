/**
 * Centralized prompt registry
 * 
 * This module serves as the central access point for all prompts in the system.
 * It exports a standardized interface for accessing prompt templates and their
 * configurations, ensuring consistency across the application.
 */

import {
  createIncidentAnalysisPrompt,
  promptConfig as incidentAnalysisConfig,
} from "./incident-analysis.js";

import {
  createWeeklyReportPrompt,
  promptConfig as weeklyReportConfig,
} from "./weekly-report-analysis.js";

import {
  createDescriptionEnhancementPrompt,
  promptConfig as descriptionEnhancementConfig,
} from "./description-enhancement.js";

/**
 * Registered prompts with their creation functions and configurations
 */
export const prompts = {
  incidentAnalysis: {
    createPrompt: createIncidentAnalysisPrompt,
    config: incidentAnalysisConfig,
  },
  weeklyReport: {
    createPrompt: createWeeklyReportPrompt,
    config: weeklyReportConfig,
  },
  descriptionEnhancement: {
    createPrompt: createDescriptionEnhancementPrompt,
    config: descriptionEnhancementConfig,
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
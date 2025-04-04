/**
 * Centralized configuration for LLM prompts
 * 
 * This file contains shared configurations for all prompt types,
 * including model versions, token limits, and temperature settings.
 */

/**
 * Available Claude model versions 
 */
export const MODELS = {
  // Most capable model for complex reasoning and analysis
  SONNET: "claude-3-5-sonnet-20240620",
  
  // Fast model for simpler tasks
  HAIKU: "claude-3-haiku-20240307",
  
  // Balanced model for general use
  OPUS: "claude-3-opus-20240229",
  
  // Legacy versions for backward compatibility
  LEGACY_SONNET: "claude-3-sonnet-20240229"
};

/**
 * Standard configurations for different prompt types
 */
export const CONFIGS = {
  // For incident analysis and enhancement
  INCIDENT_ANALYSIS: {
    model: MODELS.SONNET, // Using most capable model for analysis
    max_tokens: 1500,
    temperature: 0.2, // Lower temperature for factual responses
  },
  
  // For weekly reports and forecasts
  WEEKLY_REPORT: {
    model: MODELS.SONNET, // Using most capable model for analysis
    max_tokens: 2000, // Increased for more detailed reports
    temperature: 0.2,
  },
  
  // For simple text enhancement and standardization
  TEXT_ENHANCEMENT: {
    model: MODELS.HAIKU, // Faster model for simpler tasks
    max_tokens: 1000,
    temperature: 0.1, // Very low temperature for consistent outputs
  }
};

/**
 * Get the appropriate configuration based on prompt type
 * @param {string} promptType - Type of prompt (e.g., 'incidentAnalysis')
 * @returns {Object} Configuration object for the prompt type
 */
export const getConfig = (promptType) => {
  switch (promptType) {
    case 'incidentAnalysis':
      return CONFIGS.INCIDENT_ANALYSIS;
    case 'weeklyReport':
      return CONFIGS.WEEKLY_REPORT;
    case 'textEnhancement':
      return CONFIGS.TEXT_ENHANCEMENT;
    default:
      return CONFIGS.INCIDENT_ANALYSIS; // Default to incident analysis config
  }
};
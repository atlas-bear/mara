/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

/**
 * Centralized configuration for LLM prompts in Supabase Edge Functions.
 */

// Define available Claude model versions
export const MODELS = {
  SONNET: "claude-3-5-sonnet-20240620",
  HAIKU: "claude-3-haiku-20240307",
  OPUS: "claude-3-opus-20240229",
  LEGACY_SONNET: "claude-3-sonnet-20240229"
} as const; // Use 'as const' for stricter type checking on model names

// Define the structure for prompt configurations
interface PromptConfig {
    model: typeof MODELS[keyof typeof MODELS]; // Ensure model is one of the defined keys
    max_tokens: number;
    temperature: number;
    // Add other potential config options like top_p, top_k, system prompt etc.
}

// Define standard configurations for different prompt types
export const CONFIGS: Record<string, PromptConfig> = {
  // For incident analysis and enhancement (used by descriptionEnhancement)
  INCIDENT_ANALYSIS: {
    model: MODELS.SONNET,
    max_tokens: 1500,
    temperature: 0.2,
  },
  // For weekly reports and forecasts
  WEEKLY_REPORT: {
    model: MODELS.SONNET,
    max_tokens: 2000,
    temperature: 0.2,
  },
  // For simple text enhancement and standardization
  TEXT_ENHANCEMENT: {
    model: MODELS.HAIKU,
    max_tokens: 1000,
    temperature: 0.1,
  }
};

/**
 * Get the appropriate configuration based on prompt type name.
 * @param promptType - Type of prompt (e.g., 'incidentAnalysis').
 * @returns Configuration object for the prompt type. Defaults to INCIDENT_ANALYSIS.
 */
export const getConfig = (promptType: string): PromptConfig => {
  switch (promptType) {
    case 'incidentAnalysis':
    case 'descriptionEnhancement': // descriptionEnhancement uses INCIDENT_ANALYSIS config
      return CONFIGS.INCIDENT_ANALYSIS;
    case 'weeklyReport':
      return CONFIGS.WEEKLY_REPORT;
    case 'textEnhancement':
      return CONFIGS.TEXT_ENHANCEMENT;
    default:
      // Log a warning if an unknown type is requested, return default
      console.warn(`Unknown prompt type '${promptType}', defaulting to INCIDENT_ANALYSIS config.`);
      return CONFIGS.INCIDENT_ANALYSIS;
  }
};

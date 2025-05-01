/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

/**
 * Centralized prompt registry for Supabase Edge Functions.
 */

// Import prompt modules (assuming they will be ported to .ts files)
// Removed incident-analysis import as it's redundant with description-enhancement

import {
  createWeeklyReportPrompt,
  promptConfig as weeklyReportConfig,
} from './weekly-report-analysis.ts'; // Assuming .ts extension

import {
  createDescriptionEnhancementPrompt,
  promptConfig as descriptionEnhancementConfig,
} from './description-enhancement.ts'; // Assuming .ts extension

// Define types for configuration and prompt creation functions
// Use a generic function type that accepts any arguments but returns string or Promise<string>
// deno-lint-ignore no-explicit-any
type CreatePromptFunction = (...args: any[]) => string | Promise<string>;

interface PromptConfig {
    model: string;
    max_tokens: number;
    temperature: number;
    // Add other config options if needed
}

interface PromptDefinition {
    createPrompt: CreatePromptFunction;
    config: PromptConfig;
}

// Type for the prompts registry
type PromptRegistry = Record<string, PromptDefinition>;

/**
 * Registered prompts with their creation functions and configurations.
 */
export const prompts: PromptRegistry = {
  // Removed incidentAnalysis as descriptionEnhancement covers it
  weeklyReport: {
    createPrompt: createWeeklyReportPrompt,
    config: weeklyReportConfig,
  },
  descriptionEnhancement: {
    createPrompt: createDescriptionEnhancementPrompt,
    config: descriptionEnhancementConfig,
  },
  // Add other prompt types here as the system grows
};

/**
 * Get prompt definition (creation function and config) for a specific prompt type.
 * @param promptType - The type of prompt to retrieve (e.g., 'incidentAnalysis').
 * @returns The PromptDefinition object.
 * @throws Error if the prompt type is not found.
 */
export const getPrompt = (promptType: string): PromptDefinition => {
  const promptDefinition = prompts[promptType];
  if (!promptDefinition) {
    throw new Error(`Prompt type '${promptType}' not found in registry.`);
  }
  return promptDefinition;
};

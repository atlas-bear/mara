// utils/prompt-tester.js
import { getPrompt } from "../prompts/index.js";
import { callClaudeWithPrompt } from "./llm-service.js";
import { log } from "./logger.js";

/**
 * Test a prompt with sample data
 * @param {string} promptType - The type of prompt to test
 * @param {Object} sampleData - Sample data to use for testing
 * @returns {Object} - The result of processing the response
 */
export const testPrompt = async (promptType, sampleData) => {
  try {
    log.info(`Testing ${promptType} prompt`);

    // Generate the prompt
    const { createPrompt, config } = getPrompt(promptType);
    const promptContent = createPrompt(
      sampleData.incidentData,
      sampleData.recordFields
    );

    // Log the generated prompt for review
    log.info("Generated prompt:", { prompt: promptContent });

    // Call Claude and process the response
    const result = await callClaudeWithPrompt(promptType, sampleData);

    // Log the result
    log.info("Processed result:", { result });

    return {
      prompt: promptContent,
      result,
    };
  } catch (error) {
    log.error(`Error testing ${promptType} prompt`, error);
    throw error;
  }
};

// Example usage:
// import { testPrompt } from './utils/prompt-tester.js';
// const result = await testPrompt('incidentAnalysis', {
//   incidentData: {...},
//   recordFields: {...}
// });

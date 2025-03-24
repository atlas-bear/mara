import axios from "axios";
import { log } from "./logger.js";
import { getPrompt } from "../prompts/index.js";
import { 
  processIncidentAnalysisResponse,
  processWeeklyReportResponse
} from "./llm-processors.js";

/**
 * Call Claude API with a specific prompt type
 * @param {string} promptType - Type of prompt to use
 * @param {Object} data - Data to populate the prompt
 * @returns {Object} - Processed response from Claude
 */
export const callClaudeWithPrompt = async (promptType, data) => {
  try {
    // Get the prompt and configuration
    const { createPrompt, config } = getPrompt(promptType);

    // Create the prompt with the provided data (different prompt types may have different parameters)
    const promptContent = promptType === "incidentAnalysis" 
      ? createPrompt(data.incidentData, data.recordFields)
      : createPrompt(...Object.values(data));

    log.info(`Calling Claude API with ${promptType} prompt`);

    // Call Claude API
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: config.model,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        messages: [{ role: "user", content: promptContent }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    // Get response text
    const responseText = response.data.content[0].text;

    // Process the response based on prompt type
    if (promptType === "incidentAnalysis") {
      return processIncidentAnalysisResponse(responseText);
    } else if (promptType === "weeklyReport") {
      return processWeeklyReportResponse(responseText);
    }

    // Default fallback (shouldn't reach here if all prompt types are handled)
    return { raw: responseText };
  } catch (error) {
    log.error(`Error in LLM service for prompt type ${promptType}`, error);
    throw error;
  }
};

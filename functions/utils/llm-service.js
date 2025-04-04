import axios from "axios";
import { log } from "./logger.js";
import { getPrompt } from "../prompts/index.js";
import { 
  processIncidentAnalysisResponse,
  processWeeklyReportResponse,
  processDescriptionEnhancementResponse
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
    let promptContent;
    
    // Determine how to call the prompt creation function based on the prompt type
    switch (promptType) {
      case "incidentAnalysis":
        promptContent = createPrompt(data.incidentData, data.recordFields);
        break;
      case "descriptionEnhancement":
        promptContent = createPrompt(data.recordFields || data);
        break;
      case "weeklyReport":
        promptContent = createPrompt(...Object.values(data));
        break;
      default:
        // Generic fallback method for other prompt types
        promptContent = createPrompt(...Object.values(data));
    }

    log.info(`Calling Claude API with ${promptType} prompt using model: ${config.model}`);

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
    switch (promptType) {
      case "incidentAnalysis":
        return processIncidentAnalysisResponse(responseText);
      case "weeklyReport":
        return processWeeklyReportResponse(responseText);
      case "descriptionEnhancement":
        return processDescriptionEnhancementResponse(responseText);
      default:
        // Default fallback (shouldn't reach here if all prompt types are handled)
        log.warn(`No specific processor for prompt type: ${promptType}, returning raw response`);
        return { raw: responseText };
    }
  } catch (error) {
    log.error(`Error in LLM service for prompt type ${promptType}`, error);
    throw error;
  }
};
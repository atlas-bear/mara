/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';
import { fetchWithRetry } from './fetch.ts';
import { getPrompt } from './prompts/index.ts'; // Use the ported prompt registry
import {
  processDescriptionEnhancementResponse,
  processWeeklyReportResponse
} from './llmProcessors.ts'; // Use the ported processors

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Calls the Claude API with a specified prompt type and data.
 * Handles prompt creation, API call, and response processing.
 *
 * @param promptType - The key for the prompt definition in the registry (e.g., 'descriptionEnhancement').
 * @param data - The data required by the specific prompt's createPrompt function.
 * @returns The processed response object from the corresponding processor.
 * @throws Error if API key is missing or API call fails after retries.
 */
// deno-lint-ignore no-explicit-any
export async function callClaudeWithPrompt(promptType: string, data: any): Promise<any> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    log.error('Missing environment variable: ANTHROPIC_API_KEY');
    throw new Error('Anthropic API key is not configured.');
  }

  try {
    // 1. Get the prompt definition (create function and config)
    const { createPrompt, config } = getPrompt(promptType);

    // 2. Create the prompt content
    // We need to handle different function signatures based on promptType
    let promptContent: string | Promise<string>;
    switch (promptType) {
        // Add cases for specific prompt types if their createPrompt functions
        // have unique signatures that don't fit the generic spread (...) approach.
        // For now, assume createPrompt takes data as a single object or spread arguments.
        case 'descriptionEnhancement':
             // This prompt expects a single object `recordFields`
             promptContent = await createPrompt(data.recordFields || data); // Pass data directly or nested fields
             break;
        case 'weeklyReport':
             // This prompt expects specific arguments: incidents, regionalData, startDate, endDate
             promptContent = createPrompt(data.incidents, data.regionalData, data.startDate, data.endDate);
             break;
        // Add other cases as needed
        default:
             // Fallback: attempt to spread data if it's an array, otherwise pass as single arg
             promptContent = Array.isArray(data) ? await createPrompt(...data) : await createPrompt(data);
    }

    // Ensure promptContent is resolved if it was async
    const finalPromptContent = await Promise.resolve(promptContent);

    log.info(`Calling Claude API for prompt type: ${promptType}`, { model: config.model, max_tokens: config.max_tokens });

    // 3. Call Claude API using fetchWithRetry
    const response = await fetchWithRetry(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        messages: [{ role: 'user', content: finalPromptContent }],
        // Add system prompt here if needed: system: "System prompt text..."
      }),
      // Adjust retry/timeout if needed for potentially long LLM calls
      maxRetries: 2,
      timeoutMs: 60000, // 60 second timeout for LLM calls
    });

    const responseData = await response.json();

    // Basic check for Claude API error structure
    if (responseData.type === 'error') {
        log.error('Claude API returned an error', { error: responseData.error });
        throw new Error(`Claude API Error: ${responseData.error?.type} - ${responseData.error?.message}`);
    }

    // Extract response text
    const responseText = responseData.content?.[0]?.text;
    if (typeof responseText !== 'string') {
      log.error('Invalid response structure from Claude API', { responseData });
      throw new Error('Could not extract text content from Claude response.');
    }

    log.info(`Received response from Claude for ${promptType}`, { responseLength: responseText.length });

    // 4. Process the response based on prompt type
    switch (promptType) {
      // case 'incidentAnalysis': // Removed as using descriptionEnhancement
      //   return processIncidentAnalysisResponse(responseText);
      case 'weeklyReport':
        return processWeeklyReportResponse(responseText);
      case 'descriptionEnhancement':
        return processDescriptionEnhancementResponse(responseText);
      // Add other cases as needed
      default:
        log.warn(`No specific processor for prompt type: ${promptType}. Returning raw text.`);
        // It might be safer to return the parsed JSON if available, or just text
        return { raw: responseText };
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error(`Error in callClaudeWithPrompt for ${promptType}`, { error: error.message, stack: error.stack });
    // Re-throw the error so the calling function knows it failed
    throw error;
  }
}

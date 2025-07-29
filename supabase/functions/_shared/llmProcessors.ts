/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

// Define interfaces for the expected output structures

interface DescriptionEnhancementOutput {
    title: string | null;
    location: string | null;
    description: string | null;
    analysis: string | null;
    recommendations: string | null; // Formatted as bullet points
    weapons_used: string[];
    number_of_attackers: number | null;
    items_stolen: string[];
    response_type: string[];
    authorities_notified: string[];
}

interface KeyDevelopment {
    region: string;
    level: 'red' | 'orange' | 'yellow' | 'blue' | string; // Allow string for flexibility
    content: string;
}

interface Forecast {
    region: string;
    trend: 'up' | 'down' | 'stable' | string; // Allow string for flexibility
    content: string;
}

interface WeeklyReportOutput {
    keyDevelopments: KeyDevelopment[];
    forecast: Forecast[];
}

/**
 * Safely parses JSON from LLM response text, handling potential surrounding text.
 * @param responseText Raw text response from LLM.
 * @returns Parsed JSON object or null if parsing fails.
 */
// deno-lint-ignore no-explicit-any
function safeParseJson(responseText: string, promptType: string): any | null {
    try {
        // Try parsing directly first
        try { return JSON.parse(responseText); } catch (_) { /* Ignore direct parse error */ }

        // If direct parse fails, try extracting JSON block
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
            try { return JSON.parse(jsonMatch[0]); } catch (err) {
                 const e = err instanceof Error ? err : new Error(String(err));
                 log.error(`Failed to parse extracted JSON for ${promptType}`, { error: e.message, extracted: jsonMatch[0].substring(0, 200) });
                 return null;
            }
        }
        log.error(`Could not extract valid JSON from ${promptType} response`, { responseStart: responseText.substring(0, 200) });
        return null;
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Unexpected error during JSON parsing for ${promptType}`, { error: error.message });
        return null;
    }
}

/**
 * Process Claude response for description enhancement.
 * @param responseText - Raw text response from Claude.
 * @returns Structured data with enhanced description and metadata.
 */
export function processDescriptionEnhancementResponse(responseText: string): DescriptionEnhancementOutput {
  const defaultOutput: DescriptionEnhancementOutput = {
    title: null, location: null, description: null, analysis: "Error processing LLM response.",
    recommendations: null, weapons_used: [], number_of_attackers: null, items_stolen: [],
    response_type: [], authorities_notified: [],
  };

  const parsedData = safeParseJson(responseText, 'descriptionEnhancement');
  if (!parsedData) return defaultOutput;

  try {
    // Format recommendations as bullet points
    const formattedRecommendations = Array.isArray(parsedData.recommendations)
      ? parsedData.recommendations.map((rec: unknown) => `• ${String(rec)}`).join('\n')
      : (typeof parsedData.recommendations === 'string' ? parsedData.recommendations : null);

    // Helper to ensure field is an array of strings
    const processArrayField = (field: unknown): string[] => {
      if (!Array.isArray(field)) return [];
      return field.map(item => String(item)).filter(Boolean); // Convert items to string and filter empty
    };

    return {
      title: typeof parsedData.title === 'string' ? parsedData.title : null,
      location: typeof parsedData.location === 'string' ? parsedData.location : null,
      description: typeof parsedData.description === 'string' ? parsedData.description : null,
      analysis: typeof parsedData.analysis === 'string' ? parsedData.analysis : null,
      recommendations: formattedRecommendations,
      weapons_used: processArrayField(parsedData.weapons_used),
      number_of_attackers: typeof parsedData.number_of_attackers === 'number' ? parsedData.number_of_attackers : null,
      items_stolen: processArrayField(parsedData.items_stolen),
      response_type: processArrayField(parsedData.response_type),
      authorities_notified: processArrayField(parsedData.authorities_notified),
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    log.error('Error processing structured data from description enhancement response', { error: error.message, parsedData });
    return defaultOutput; // Return default on processing error
  }
}

/**
 * Process Claude response for weekly report analysis.
 * @param responseText - Raw text response from Claude.
 * @returns Structured weekly report data.
 */
export function processWeeklyReportResponse(responseText: string): WeeklyReportOutput {
    const defaultOutput: WeeklyReportOutput = {
        keyDevelopments: [{ region: "Error", level: "red", content: "Error processing LLM response." }],
        forecast: [{ region: "Error", trend: "stable", content: "Error processing LLM response." }]
    };

    const parsedData = safeParseJson(responseText, 'weeklyReport');
    if (!parsedData) return defaultOutput;

    try {
        // Validate and map keyDevelopments
        const keyDevelopments: KeyDevelopment[] = [];
        if (Array.isArray(parsedData.keyDevelopments)) {
            parsedData.keyDevelopments.forEach((dev: any) => {
                if (dev && typeof dev === 'object') {
                    keyDevelopments.push({
                        region: typeof dev.region === 'string' ? dev.region : "Unknown",
                        level: typeof dev.level === 'string' ? dev.level : "blue",
                        content: typeof dev.content === 'string' ? dev.content : "No content"
                    });
                }
            });
        } else {
             log.warn('Invalid keyDevelopments format in weekly report response', { data: parsedData.keyDevelopments });
        }

        // Validate and map forecast
        const forecast: Forecast[] = [];
        if (Array.isArray(parsedData.forecast)) {
             parsedData.forecast.forEach((f: any) => {
                if (f && typeof f === 'object') {
                    forecast.push({
                        region: typeof f.region === 'string' ? f.region : "Unknown",
                        trend: typeof f.trend === 'string' ? f.trend : "stable",
                        content: typeof f.content === 'string' ? f.content : "No content"
                    });
                }
            });
        } else {
             log.warn('Invalid forecast format in weekly report response', { data: parsedData.forecast });
        }

        // Return default if parsing resulted in empty arrays (indicates structure issue)
        if (keyDevelopments.length === 0 && forecast.length === 0) {
            log.error('Parsed weekly report data resulted in empty arrays.', { parsedData });
            return defaultOutput;
        }

        return { keyDevelopments, forecast };

    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error('Error processing structured data from weekly report response', { error: error.message, parsedData });
        return defaultOutput; // Return default on processing error
    }
}

import { log } from "./logger.js";

/**
 * Process Claude response for incident analysis
 * @param {string} responseText - Raw text response from Claude
 * @returns {Object} - Structured data extracted from Claude's response
 */
export const processIncidentAnalysisResponse = (responseText) => {
  try {
    // Extract JSON from response (in case there's any extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Claude response");
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // Process "Other" options and join recommendations into a proper format for Airtable
    const processField = (field) => {
      if (!Array.isArray(parsedData[field])) {
        return [];
      }

      return parsedData[field].map((item) => {
        if (
          typeof item === "string" &&
          item.toLowerCase().startsWith("other")
        ) {
          return item;
        }
        return item;
      });
    };

    // Join recommendations into a formatted string with bullet points
    const formattedRecommendations = Array.isArray(parsedData.recommendations)
      ? parsedData.recommendations.map((rec) => `• ${rec}`).join("\n")
      : parsedData.recommendations;

    return {
      analysis: parsedData.analysis || null,
      recommendations: formattedRecommendations,
      weapons_used: processField("weapons_used"),
      number_of_attackers:
        typeof parsedData.number_of_attackers === "number"
          ? parsedData.number_of_attackers
          : null,
      items_stolen: processField("items_stolen"),
      response_type: processField("response_type"),
      authorities_notified: processField("authorities_notified"),
    };
  } catch (error) {
    log.error("Error parsing Claude response", error, { responseText });
    return {
      analysis: "Error processing LLM response. Manual review required.",
      recommendations: null,
      weapons_used: [],
      number_of_attackers: null,
      items_stolen: [],
      response_type: [],
      authorities_notified: [],
    };
  }
};

/**
 * Process Claude response for weekly report analysis
 * @param {string} responseText - Raw text response from Claude
 * @returns {Object} - Structured weekly report data
 */
export const processWeeklyReportResponse = (responseText) => {
  try {
    // Extract JSON from response (in case there's any extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Claude response");
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    
    // Validate keyDevelopments
    if (!Array.isArray(parsedData.keyDevelopments)) {
      throw new Error("Invalid keyDevelopments format in Claude response");
    }
    
    // Validate forecast
    if (!Array.isArray(parsedData.forecast)) {
      throw new Error("Invalid forecast format in Claude response");
    }
    
    // Map key developments to expected format
    const keyDevelopments = parsedData.keyDevelopments.map(dev => ({
      region: dev.region || "Unknown",
      level: dev.level || "blue",
      content: dev.content || "No content provided"
    }));
    
    // Map forecast to expected format
    const forecast = parsedData.forecast.map(f => ({
      region: f.region || "Unknown",
      trend: f.trend || "stable",
      content: f.content || "No content provided"
    }));
    
    return {
      keyDevelopments,
      forecast
    };
  } catch (error) {
    log.error("Error parsing weekly report response", error, { responseText });
    return {
      keyDevelopments: [
        { region: "Error", level: "red", content: "Error processing LLM response. Manual review required." }
      ],
      forecast: [
        { region: "Error", level: "red", content: "Error processing LLM response. Manual review required." }
      ]
    };
  }
};

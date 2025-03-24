/**
 * Client-safe API utilities for the weekly report
 * 
 * These utilities only access the API through fetch calls and never
 * include server-side environment variables or code
 */

/**
 * Fetches AI-generated content for the weekly report from the serverless function
 * @param {Date} start - Start date of the reporting period
 * @param {Date} end - End date of the reporting period
 * @returns {Object} Object containing keyDevelopments and forecast arrays
 */
export async function fetchWeeklyReportContent(start, end) {
  try {
    // Validate inputs
    if (!(start instanceof Date) || !(end instanceof Date)) {
      console.error("Invalid date parameters:", { start, end });
      return { keyDevelopments: [], forecast: [] };
    }

    // Use environment-provided API URL or default to same-origin
    const API_BASE_URL = import.meta.env?.VITE_MARA_API_URL || '';
    
    // Make the API request to the serverless function
    const response = await fetch(
      `${API_BASE_URL}/.netlify/functions/get-weekly-report-content?start=${start.toISOString()}&end=${end.toISOString()}`
    );
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching weekly report content:", error);
    // Return empty default data on error
    return { 
      keyDevelopments: [], 
      forecast: [] 
    };
  }
}
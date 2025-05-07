import { createClient } from "@supabase/supabase-js";

/** Supabase client initialization */
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches weekly incidents from Supabase Edge Function
 * @param {Date} start - Start date of the reporting period
 * @param {Date} end - End date of the reporting period
 * @returns {Promise<Object>} Object containing incidents array and latestIncidents
 */
export async function fetchWeeklyIncidents(start, end) {
  try {
    console.log(
      "Checking received params in fetchWeeklyIncidents:",
      start,
      end
    );

    // Ensure start and end are Date objects
    if (!(start instanceof Date) || isNaN(start)) {
      throw new Error(`Invalid start date: ${start}`);
    }
    if (!(end instanceof Date) || isNaN(end)) {
      throw new Error(`Invalid end date: ${end}`);
    }

    console.log("Fetching weekly incidents with dates:", { start, end });

    const { data, error } = await supabase.functions.invoke(
      "generate-weekly-report",
      {
        body: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      }
    );

    if (error) {
      console.error("Supabase function error:", error);
      throw error;
    }

    console.log("Raw API response:", data);

    if (!data || !data.incidents) {
      throw new Error("No incidents data in response");
    }

    return data;
  } catch (error) {
    console.error("Error in fetchWeeklyIncidents:", error);
    throw error;
  }
}

/**
 * Fetches weekly report content including AI-generated analysis
 * @param {Date} start - Start date of the reporting period
 * @param {Date} end - End date of the reporting period
 * @returns {Promise<Object>} Object containing keyDevelopments and forecast arrays
 */
export async function fetchWeeklyReportContent(start, end) {
  try {
    if (!(start instanceof Date) || !(end instanceof Date)) {
      throw new Error("Invalid date parameters");
    }

    const { data, error } = await supabase.functions.invoke(
      "generate-weekly-report",
      {
        body: {
          start: start.toISOString(),
          end: end.toISOString(),
          includeAnalysis: true,
        },
      }
    );

    if (error) {
      console.error("Error fetching report content:", error);
      throw error;
    }

    return {
      keyDevelopments: data.keyDevelopments || [],
      forecast: data.forecast || [],
    };
  } catch (error) {
    console.error("Error in fetchWeeklyReportContent:", error);
    return { keyDevelopments: [], forecast: [] };
  }
}

/**
 * Exports the weekly report as PDF
 * @param {string} yearWeek - Year and week number (e.g., "2025-12")
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportWeeklyReport(yearWeek) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-weekly-report",
      {
        body: { yearWeek, format: "pdf" },
      }
    );

    if (error) {
      throw error;
    }

    // Convert base64 to blob
    const pdfBlob = await fetch(`data:application/pdf;base64,${data.pdf}`).then(
      (res) => res.blob()
    );
    return pdfBlob;
  } catch (error) {
    console.error("Error exporting report:", error);
    throw error;
  }
}

import { createClient } from "@supabase/supabase-js";

/** Configuration for API backend selection */
const USE_SUPABASE = import.meta.env?.VITE_USE_SUPABASE === "true";
const API_BASE_URL = import.meta.env?.VITE_MARA_API_URL || "";
const SUPABASE_ONLY = import.meta.env?.VITE_SUPABASE_ONLY === "true";

/** Supabase client initialization (only if using Supabase) */
let supabase = null;
if (USE_SUPABASE) {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.error("Missing Supabase configuration");
  }
}

/**
 * Fetches weekly incidents using the configured backend
 * @param {Date} start - Start date of the reporting period
 * @param {Date} end - End date of the reporting period
 * @returns {Promise<Object>} Object containing incidents array and latestIncidents
 */
export async function fetchWeeklyIncidents(start, end) {
  try {
    console.log(
      "Fetching weekly incidents with backend:",
      USE_SUPABASE ? "Supabase" : "Netlify"
    );

    if (!(start instanceof Date) || isNaN(start)) {
      throw new Error(`Invalid start date: ${start}`);
    }
    if (!(end instanceof Date) || isNaN(end)) {
      throw new Error(`Invalid end date: ${end}`);
    }

    if (USE_SUPABASE && supabase) {
      // Use new Supabase Edge Function
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

      if (!data || !data.incidents) {
        throw new Error("No incidents data in response");
      }

      return data;
    } else {
      // Use legacy Netlify function
      const response = await fetch(
        `${API_BASE_URL}/.netlify/functions/get-weekly-incidents?start=${start.toISOString()}&end=${end.toISOString()}`
      );

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    }
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
      console.error("Invalid date parameters:", { start, end });
      return { keyDevelopments: [], forecast: [] };
    }

    if (USE_SUPABASE && supabase) {
      // Use new Supabase Edge Function
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
    } else {
      // Use legacy Netlify function
      const response = await fetch(
        `${API_BASE_URL}/.netlify/functions/get-weekly-report-content?start=${start.toISOString()}&end=${end.toISOString()}`
      );

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error("Error in fetchWeeklyReportContent:", error);
    return { keyDevelopments: [], forecast: [] };
  }
}

/**
 * Gets user's subscription preferences for email notifications
 * @returns {Promise<Object>} Object containing subscription preferences
 */
export async function getSubscriptionPreferences() {
  try {
    if (USE_SUPABASE && supabase) {
      // Use new Supabase system
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      const { data: preferences, error } = await supabase
        .from("user_email_preferences")
        .select("category_id, frequency, enabled")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching preferences:", error);
        throw error;
      }

      const prefs = {
        weekly_report_email: false,
        flash_report_email: false,
        platform_updates_email: false,
        marketing_email: false,
      };

      preferences?.forEach((pref) => {
        switch (pref.category_id) {
          case "weekly-report":
            prefs.weekly_report_email =
              pref.enabled && pref.frequency !== "never";
            break;
          case "flash-report":
            prefs.flash_report_email =
              pref.enabled && pref.frequency !== "never";
            break;
          case "platform-updates":
            prefs.platform_updates_email =
              pref.enabled && pref.frequency !== "never";
            break;
          case "marketing":
            prefs.marketing_email = pref.enabled && pref.frequency !== "never";
            break;
        }
      });

      return prefs;
    } else {
      // Legacy system - return default preferences or call legacy API
      console.warn("Subscription preferences not available in legacy mode");
      return {
        weekly_report_email: false,
        flash_report_email: false,
        platform_updates_email: false,
        marketing_email: false,
      };
    }
  } catch (error) {
    console.error("Error in getSubscriptionPreferences:", error);
    throw error;
  }
}

/**
 * Updates user's subscription preferences
 * @param {Object} preferences - Object containing preference updates
 * @returns {Promise<Object>} Updated preferences object
 */
export async function updateSubscriptionPreferences(preferences) {
  try {
    if (USE_SUPABASE && supabase) {
      // Use new Supabase system
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      const categoryMap = {
        weekly_report_email: "weekly-report",
        flash_report_email: "flash-report",
        platform_updates_email: "platform-updates",
        marketing_email: "marketing",
      };

      for (const [prefKey, enabled] of Object.entries(preferences)) {
        const categoryId = categoryMap[prefKey];
        if (!categoryId) continue;

        const frequency = enabled ? "immediate" : "never";

        const { error } = await supabase.from("user_email_preferences").upsert(
          {
            user_id: user.id,
            category_id: categoryId,
            frequency: frequency,
            format: "both",
            enabled: enabled,
          },
          {
            onConflict: "user_id,category_id",
          }
        );

        if (error) {
          console.error(`Error updating ${prefKey}:`, error);
          throw error;
        }
      }

      return await getSubscriptionPreferences();
    } else {
      // Legacy system - log warning and return unchanged preferences
      console.warn(
        "Subscription preferences update not available in legacy mode"
      );
      return await getSubscriptionPreferences();
    }
  } catch (error) {
    console.error("Error in updateSubscriptionPreferences:", error);
    throw error;
  }
}

/**
 * Exports the weekly report as PDF
 * @param {string} yearWeek - Year and week number (e.g., "2025-12")
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportWeeklyReport(yearWeek) {
  try {
    if (USE_SUPABASE && supabase) {
      // Use new Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        "generate-weekly-report",
        {
          body: { yearWeek, format: "pdf" },
        }
      );

      if (error) {
        throw error;
      }

      const pdfBlob = await fetch(
        `data:application/pdf;base64,${data.pdf}`
      ).then((res) => res.blob());
      return pdfBlob;
    } else {
      // Legacy system - use existing PDF generation
      const response = await fetch(
        `${API_BASE_URL}/.netlify/functions/generate-weekly-pdf?yearWeek=${yearWeek}`
      );

      if (!response.ok) {
        throw new Error(`PDF generation failed with status ${response.status}`);
      }

      return await response.blob();
    }
  } catch (error) {
    console.error("Error exporting report:", error);
    throw error;
  }
}

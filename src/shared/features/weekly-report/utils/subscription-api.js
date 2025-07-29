import { createClient } from "@supabase/supabase-js";

/** Supabase client initialization */
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Gets user's subscription preferences for email notifications
 * @returns {Promise<Object>} Object containing subscription preferences
 */
export async function getSubscriptionPreferences() {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Get user's email preferences
    const { data: preferences, error } = await supabase
      .from("user_email_preferences")
      .select("category_id, frequency, enabled")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching preferences:", error);
      throw error;
    }

    // Convert to expected format
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
          prefs.flash_report_email = pref.enabled && pref.frequency !== "never";
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
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Map preference keys to category IDs
    const categoryMap = {
      weekly_report_email: "weekly-report",
      flash_report_email: "flash-report",
      platform_updates_email: "platform-updates",
      marketing_email: "marketing",
    };

    // Update each preference
    for (const [prefKey, enabled] of Object.entries(preferences)) {
      const categoryId = categoryMap[prefKey];
      if (!categoryId) continue;

      const frequency = enabled ? "immediate" : "never";

      // Upsert the preference
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

    // Return updated preferences
    return await getSubscriptionPreferences();
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

import { createClient } from "@supabase/supabase-js";

/** Configuration for API backend selection */
const USE_SUPABASE = import.meta.env?.VITE_USE_SUPABASE === "true";
const API_BASE_URL = import.meta.env?.VITE_MARA_API_URL || "";

/** Supabase client initialization (only if using Supabase) */
let supabase = null;
if (USE_SUPABASE) {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.error("Missing Supabase configuration for user preferences");
  }
}

/**
 * Gets comprehensive user preferences including email settings and UI preferences
 * @returns {Promise<Object>} Complete user preferences object
 */
export async function getUserPreferences() {
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

      // Fetch email preferences
      const { data: emailPrefs, error: emailError } = await supabase
        .from("user_email_preferences")
        .select("category_id, frequency, enabled, format")
        .eq("user_id", user.id);

      if (emailError) {
        console.error("Error fetching email preferences:", emailError);
        throw emailError;
      }

      // Fetch user profile information
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Don't throw error if profile doesn't exist - it's optional
      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error fetching user profile:", profileError);
      }

      // Structure the preferences
      const preferences = {
        user: {
          id: user.id,
          email: user.email,
          name: profile?.full_name || user.user_metadata?.full_name || "",
          avatar_url:
            profile?.avatar_url || user.user_metadata?.avatar_url || "",
          created_at: user.created_at,
        },
        email: {
          weekly_report: {
            enabled: false,
            frequency: "never",
            format: "both",
          },
          flash_report: {
            enabled: false,
            frequency: "never",
            format: "both",
          },
          platform_updates: {
            enabled: false,
            frequency: "never",
            format: "both",
          },
          marketing: {
            enabled: false,
            frequency: "never",
            format: "both",
          },
        },
        ui: {
          theme: profile?.theme || "light",
          timezone:
            profile?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: profile?.language || "en",
          date_format: profile?.date_format || "MM/DD/YYYY",
          notifications: profile?.notifications_enabled || true,
        },
      };

      // Map email preferences
      emailPrefs?.forEach((pref) => {
        switch (pref.category_id) {
          case "weekly-report":
            preferences.email.weekly_report = {
              enabled: pref.enabled,
              frequency: pref.frequency,
              format: pref.format,
            };
            break;
          case "flash-report":
            preferences.email.flash_report = {
              enabled: pref.enabled,
              frequency: pref.frequency,
              format: pref.format,
            };
            break;
          case "platform-updates":
            preferences.email.platform_updates = {
              enabled: pref.enabled,
              frequency: pref.frequency,
              format: pref.format,
            };
            break;
          case "marketing":
            preferences.email.marketing = {
              enabled: pref.enabled,
              frequency: pref.frequency,
              format: pref.format,
            };
            break;
        }
      });

      return preferences;
    } else {
      // Legacy system - return basic preferences
      console.warn("Full user preferences not available in legacy mode");
      return {
        user: {
          id: "legacy-user",
          email: "user@example.com",
          name: "Legacy User",
          avatar_url: "",
          created_at: new Date().toISOString(),
        },
        email: {
          weekly_report: { enabled: false, frequency: "never", format: "both" },
          flash_report: { enabled: false, frequency: "never", format: "both" },
          platform_updates: {
            enabled: false,
            frequency: "never",
            format: "both",
          },
          marketing: { enabled: false, frequency: "never", format: "both" },
        },
        ui: {
          theme: "light",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: "en",
          date_format: "MM/DD/YYYY",
          notifications: true,
        },
      };
    }
  } catch (error) {
    console.error("Error in getUserPreferences:", error);
    throw error;
  }
}

/**
 * Updates user email preferences
 * @param {Object} emailPreferences - Email preference updates
 * @returns {Promise<Object>} Updated preferences
 */
export async function updateEmailPreferences(emailPreferences) {
  try {
    if (USE_SUPABASE && supabase) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      const categoryMap = {
        weekly_report: "weekly-report",
        flash_report: "flash-report",
        platform_updates: "platform-updates",
        marketing: "marketing",
      };

      for (const [category, settings] of Object.entries(emailPreferences)) {
        const categoryId = categoryMap[category];
        if (!categoryId) continue;

        const { error } = await supabase.from("user_email_preferences").upsert(
          {
            user_id: user.id,
            category_id: categoryId,
            frequency: settings.frequency || "never",
            format: settings.format || "both",
            enabled: settings.enabled || false,
          },
          {
            onConflict: "user_id,category_id",
          }
        );

        if (error) {
          console.error(`Error updating ${category}:`, error);
          throw error;
        }
      }

      return await getUserPreferences();
    } else {
      console.warn("Email preferences update not available in legacy mode");
      return await getUserPreferences();
    }
  } catch (error) {
    console.error("Error in updateEmailPreferences:", error);
    throw error;
  }
}

/**
 * Updates user profile and UI preferences
 * @param {Object} profileUpdates - Profile and UI preference updates
 * @returns {Promise<Object>} Updated preferences
 */
export async function updateUserProfile(profileUpdates) {
  try {
    if (USE_SUPABASE && supabase) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      // Update user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            ...profileUpdates,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (profileError) {
        console.error("Error updating user profile:", profileError);
        throw profileError;
      }

      return await getUserPreferences();
    } else {
      console.warn("User profile update not available in legacy mode");
      return await getUserPreferences();
    }
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    throw error;
  }
}

/**
 * Gets user's email delivery statistics
 * @param {Object} options - Query options (date range, etc.)
 * @returns {Promise<Object>} Email statistics
 */
export async function getEmailStatistics(options = {}) {
  try {
    if (USE_SUPABASE && supabase) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      const { startDate, endDate, limit = 50 } = options;

      let query = supabase
        .from("email_delivery_log")
        .select("*")
        .eq("recipient_email", user.email)
        .order("sent_at", { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte("sent_at", startDate);
      }
      if (endDate) {
        query = query.lte("sent_at", endDate);
      }

      const { data: deliveryLog, error } = await query;

      if (error) {
        console.error("Error fetching email statistics:", error);
        throw error;
      }

      // Calculate statistics
      const stats = {
        total_sent: deliveryLog?.length || 0,
        by_category: {},
        by_status: {},
        recent_emails: deliveryLog?.slice(0, 10) || [],
      };

      deliveryLog?.forEach((email) => {
        // Count by category
        const category = email.category || "unknown";
        stats.by_category[category] = (stats.by_category[category] || 0) + 1;

        // Count by status
        const status = email.delivery_status || "unknown";
        stats.by_status[status] = (stats.by_status[status] || 0) + 1;
      });

      return stats;
    } else {
      console.warn("Email statistics not available in legacy mode");
      return {
        total_sent: 0,
        by_category: {},
        by_status: {},
        recent_emails: [],
      };
    }
  } catch (error) {
    console.error("Error in getEmailStatistics:", error);
    throw error;
  }
}

/**
 * Sends a test email to verify preferences
 * @param {string} category - Email category to test
 * @returns {Promise<Object>} Test result
 */
export async function sendTestEmail(category) {
  try {
    if (USE_SUPABASE && supabase) {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "test",
          category: category,
          test: true,
        },
      });

      if (error) {
        throw error;
      }

      return { success: true, message: "Test email sent successfully" };
    } else {
      console.warn("Test email not available in legacy mode");
      return {
        success: false,
        message: "Test email not available in legacy mode",
      };
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    throw error;
  }
}

import { useState, useEffect } from "react";
import {
  getUserPreferences,
  updateEmailPreferences,
  updateUserProfile,
  getEmailStatistics,
  sendTestEmail,
} from "../utils/hybrid-api";

/**
 * Hook for managing user preferences with comprehensive functionality
 * @param {Object} options - Hook options
 * @returns {Object} Preferences state and management functions
 */
export default function useUserPreferences(options = {}) {
  const [preferences, setPreferences] = useState(null);
  const [emailStats, setEmailStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { includeStats = false, autoRefresh = false } = options;

  // Load initial preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && preferences) {
      const interval = setInterval(() => {
        loadPreferences(true); // Silent refresh
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, preferences]);

  /**
   * Load user preferences from the API
   * @param {boolean} silent - Whether to show loading state
   */
  const loadPreferences = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const prefs = await getUserPreferences();
      setPreferences(prefs);
      setLastUpdated(new Date());

      // Load email statistics if requested
      if (includeStats) {
        try {
          const stats = await getEmailStatistics({
            limit: 50,
            startDate: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // Last 30 days
          });
          setEmailStats(stats);
        } catch (statsError) {
          console.warn("Could not load email statistics:", statsError);
          // Don't fail the whole operation if stats fail
        }
      }

      if (!silent) {
        setLoading(false);
      }
    } catch (err) {
      console.error("Error loading preferences:", err);
      setError(err.message);
      if (!silent) {
        setLoading(false);
      }
    }
  };

  /**
   * Update email preferences
   * @param {Object} emailPrefs - Email preference updates
   */
  const updateEmail = async (emailPrefs) => {
    try {
      setSaving(true);
      setError(null);

      const updatedPrefs = await updateEmailPreferences(emailPrefs);
      setPreferences(updatedPrefs);
      setLastUpdated(new Date());

      // Refresh stats if they're being tracked
      if (includeStats) {
        const stats = await getEmailStatistics({
          limit: 50,
          startDate: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
        setEmailStats(stats);
      }

      setSaving(false);
      return updatedPrefs;
    } catch (err) {
      console.error("Error updating email preferences:", err);
      setError(err.message);
      setSaving(false);
      throw err;
    }
  };

  /**
   * Update user profile and UI preferences
   * @param {Object} profileUpdates - Profile updates
   */
  const updateProfile = async (profileUpdates) => {
    try {
      setSaving(true);
      setError(null);

      const updatedPrefs = await updateUserProfile(profileUpdates);
      setPreferences(updatedPrefs);
      setLastUpdated(new Date());

      setSaving(false);
      return updatedPrefs;
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message);
      setSaving(false);
      throw err;
    }
  };

  /**
   * Send a test email for a specific category
   * @param {string} category - Email category to test
   */
  const testEmail = async (category) => {
    try {
      setError(null);
      const result = await sendTestEmail(category);

      // Refresh stats after sending test email
      if (includeStats) {
        setTimeout(async () => {
          try {
            const stats = await getEmailStatistics({
              limit: 50,
              startDate: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
            });
            setEmailStats(stats);
          } catch (statsError) {
            console.warn(
              "Could not refresh stats after test email:",
              statsError
            );
          }
        }, 2000); // Wait 2 seconds for email to be processed
      }

      return result;
    } catch (err) {
      console.error("Error sending test email:", err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Toggle a specific email preference
   * @param {string} category - Email category
   * @param {boolean} enabled - Whether to enable or disable
   */
  const toggleEmailPreference = async (category, enabled) => {
    if (!preferences) return;

    const currentPref = preferences.email[category];
    if (!currentPref) return;

    const updates = {
      [category]: {
        ...currentPref,
        enabled,
        frequency: enabled
          ? currentPref.frequency === "never"
            ? "immediate"
            : currentPref.frequency
          : "never",
      },
    };

    return await updateEmail(updates);
  };

  /**
   * Update email frequency for a category
   * @param {string} category - Email category
   * @param {string} frequency - New frequency setting
   */
  const updateEmailFrequency = async (category, frequency) => {
    if (!preferences) return;

    const currentPref = preferences.email[category];
    if (!currentPref) return;

    const updates = {
      [category]: {
        ...currentPref,
        frequency,
        enabled: frequency !== "never",
      },
    };

    return await updateEmail(updates);
  };

  /**
   * Update email format for a category
   * @param {string} category - Email category
   * @param {string} format - New format setting
   */
  const updateEmailFormat = async (category, format) => {
    if (!preferences) return;

    const currentPref = preferences.email[category];
    if (!currentPref) return;

    const updates = {
      [category]: {
        ...currentPref,
        format,
      },
    };

    return await updateEmail(updates);
  };

  /**
   * Refresh all data
   */
  const refresh = () => {
    loadPreferences();
  };

  /**
   * Reset error state
   */
  const clearError = () => {
    setError(null);
  };

  return {
    // State
    preferences,
    emailStats,
    loading,
    saving,
    error,
    lastUpdated,

    // Actions
    updateEmail,
    updateProfile,
    testEmail,
    toggleEmailPreference,
    updateEmailFrequency,
    updateEmailFormat,
    refresh,
    clearError,

    // Computed values
    isAuthenticated:
      preferences?.user?.id && preferences.user.id !== "legacy-user",
    hasEmailPreferences:
      preferences?.email && Object.keys(preferences.email).length > 0,
    totalEmailsSent: emailStats?.total_sent || 0,
  };
}

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
    console.error("Missing Supabase configuration for incidents API");
  }
}

/**
 * Fetches a single incident by ID using the configured backend
 * @param {string} incidentId - The incident ID to fetch
 * @returns {Promise<Object>} The incident data
 */
export async function fetchIncident(incidentId) {
  try {
    console.log(
      "Fetching incident with backend:",
      USE_SUPABASE ? "Supabase" : "Netlify",
      "ID:",
      incidentId
    );

    if (!incidentId) {
      throw new Error("Incident ID is required");
    }

    if (USE_SUPABASE && supabase) {
      // Use new Supabase system - query the incidents table directly
      const { data, error } = await supabase
        .from("incidents")
        .select(
          `
          *,
          incident_environment (
            sea_state,
            weather_conditions,
            visibility,
            temperature,
            wind_speed,
            wind_direction
          )
        `
        )
        .eq("id", incidentId)
        .single();

      if (error) {
        console.error("Supabase query error:", error);
        throw new Error(`Failed to fetch incident: ${error.message}`);
      }

      if (!data) {
        throw new Error("Incident not found");
      }

      return data;
    } else {
      // Use legacy Netlify function
      const response = await fetch(
        `${API_BASE_URL}/.netlify/functions/get-incident?id=${incidentId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error("Error in fetchIncident:", error);
    throw error;
  }
}

/**
 * Fetches related incidents for a given incident (similar incidents, nearby incidents, etc.)
 * @param {string} incidentId - The incident ID to find related incidents for
 * @param {Object} options - Options for finding related incidents
 * @returns {Promise<Array>} Array of related incidents
 */
export async function fetchRelatedIncidents(incidentId, options = {}) {
  try {
    const { limit = 5, radius = 50 } = options;

    if (USE_SUPABASE && supabase) {
      // Use Supabase to find related incidents
      // This would require a more complex query with spatial functions
      // For now, return empty array - can be implemented later
      console.log("Related incidents not yet implemented for Supabase mode");
      return [];
    } else {
      // Use legacy system if available
      const response = await fetch(
        `${API_BASE_URL}/.netlify/functions/get-related-incidents?id=${incidentId}&limit=${limit}&radius=${radius}`
      );

      if (!response.ok) {
        // If endpoint doesn't exist, return empty array
        if (response.status === 404) {
          return [];
        }
        throw new Error(
          `Failed to fetch related incidents: ${response.status}`
        );
      }

      const data = await response.json();
      return data.incidents || [];
    }
  } catch (error) {
    console.error("Error fetching related incidents:", error);
    // Return empty array on error to avoid breaking the UI
    return [];
  }
}

/**
 * Fetches incident history/timeline for a given incident
 * @param {string} incidentId - The incident ID to fetch history for
 * @returns {Promise<Array>} Array of incident history entries
 */
export async function fetchIncidentHistory(incidentId) {
  try {
    if (USE_SUPABASE && supabase) {
      // Query incident history from Supabase
      const { data, error } = await supabase
        .from("incident_history")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching incident history:", error);
        return [];
      }

      return data || [];
    } else {
      // Use legacy system if available
      const response = await fetch(
        `${API_BASE_URL}/.netlify/functions/get-incident-history?id=${incidentId}`
      );

      if (!response.ok) {
        // If endpoint doesn't exist, return empty array
        if (response.status === 404) {
          return [];
        }
        throw new Error(`Failed to fetch incident history: ${response.status}`);
      }

      const data = await response.json();
      return data.history || [];
    }
  } catch (error) {
    console.error("Error fetching incident history:", error);
    return [];
  }
}

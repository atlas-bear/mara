import { useState, useEffect } from "react";
import {
  fetchIncident,
  fetchRelatedIncidents,
  fetchIncidentHistory,
} from "../utils/hybrid-api";

/**
 * Hook to fetch a single incident by ID with related data
 * Uses the hybrid API system to support both legacy and Supabase backends
 */
export default function useIncident(incidentId, options = {}) {
  const [incident, setIncident] = useState(null);
  const [relatedIncidents, setRelatedIncidents] = useState([]);
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    includeRelated = false,
    includeHistory = false,
    relatedLimit = 5,
    relatedRadius = 50,
  } = options;

  useEffect(() => {
    if (!incidentId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch main incident data
        const incidentData = await fetchIncident(incidentId);

        if (!mounted) return;
        setIncident(incidentData);

        // Fetch additional data if requested
        const additionalPromises = [];

        if (includeRelated) {
          additionalPromises.push(
            fetchRelatedIncidents(incidentId, {
              limit: relatedLimit,
              radius: relatedRadius,
            })
          );
        }

        if (includeHistory) {
          additionalPromises.push(fetchIncidentHistory(incidentId));
        }

        if (additionalPromises.length > 0) {
          const results = await Promise.all(additionalPromises);

          if (!mounted) return;

          let resultIndex = 0;
          if (includeRelated) {
            setRelatedIncidents(results[resultIndex] || []);
            resultIndex++;
          }
          if (includeHistory) {
            setIncidentHistory(results[resultIndex] || []);
          }
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching incident data:", err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [incidentId, includeRelated, includeHistory, relatedLimit, relatedRadius]);

  return {
    incident,
    relatedIncidents,
    incidentHistory,
    loading,
    error,
  };
}

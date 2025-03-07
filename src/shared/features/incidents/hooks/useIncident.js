import { useState, useEffect } from 'react';

/**
 * Hook to fetch a single incident by ID
 * This follows the same pattern as the weekly report but for a single incident
 */
export default function useIncident(incidentId) {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!incidentId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchIncident = async () => {
      try {
        setLoading(true);
        console.log(`Fetching incident data for ID: ${incidentId}`);

        const url = `/.netlify/functions/get-incident?id=${incidentId}`;
        const response = await fetch(url);

        console.log("API Response status:", response.status);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        console.log("API Response data:", data);

        if (mounted) {
          setIncident(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching incident:", err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchIncident();
    return () => { mounted = false; };
  }, [incidentId]);

  return { incident, loading, error };
}
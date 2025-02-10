export async function fetchWeeklyIncidents(start, end) {
  try {
    console.log("Fetching weekly incidents with dates:", { start, end });

    const response = await fetch(
      `/.netlify/functions/get-weekly-incidents?start=${start.toISOString()}&end=${end.toISOString()}`
    );

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
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

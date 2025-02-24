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

    const url = `/.netlify/functions/get-weekly-incidents?start=${start.toISOString()}&end=${end.toISOString()}`;
    console.log("Final API URL:", url);

    const response = await fetch(url);

    console.log("Response status:", response.status);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      throw new Error("Expected JSON but got something else");
    }

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

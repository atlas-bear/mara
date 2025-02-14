import { mockHistoricalTrends } from "./mock-data";

// This function will eventually fetch real historical data from Airtable
export async function fetchHistoricalTrends(region, weeks = 8) {
  try {
    // For now, return mock data
    if (mockHistoricalTrends[region]) {
      return mockHistoricalTrends[region];
    }

    // When implementing real API:
    /*
    const response = await fetch(`/.netlify/functions/get-historical-trends?region=${region}&weeks=${weeks}`);
    if (!response.ok) throw new Error('Failed to fetch historical trends');
    const data = await response.json();
    return data;
    */

    return [];
  } catch (error) {
    console.error("Error fetching historical trends:", error);
    return [];
  }
}

// Fetch trends for all regions
export async function fetchAllHistoricalTrends(weeks = 8) {
  try {
    // For now, return all mock data
    return mockHistoricalTrends;

    // When implementing real API:
    /*
    const response = await fetch(`/.netlify/functions/get-historical-trends?weeks=${weeks}`);
    if (!response.ok) throw new Error('Failed to fetch historical trends');
    const data = await response.json();
    return data;
    */
  } catch (error) {
    console.error("Error fetching all historical trends:", error);
    return {};
  }
}

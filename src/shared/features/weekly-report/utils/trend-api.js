import { mockHistoricalTrends } from "./mock-data";
import { historicalTrends } from "./report-data";

export async function fetchHistoricalTrends(region, months = 6) {
  try {
    // First try to use real data
    if (historicalTrends[region]) {
      return historicalTrends[region];
    }
    
    // Fall back to mock data if needed
    if (mockHistoricalTrends[region]) {
      return mockHistoricalTrends[region];
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching historical trends:", error);
    return [];
  }
}

export async function fetchAllHistoricalTrends(months = 6) {
  try {
    return historicalTrends || mockHistoricalTrends;
  } catch (error) {
    console.error("Error fetching all historical trends:", error);
    return {};
  }
}

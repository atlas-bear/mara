import { mockHistoricalTrends } from "./mock-data";

export async function fetchHistoricalTrends(region, months = 6) {
  try {
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
    return mockHistoricalTrends;
  } catch (error) {
    console.error("Error fetching all historical trends:", error);
    return {};
  }
}

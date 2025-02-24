import { mockHistoricalTrends } from "./mock-data";

export async function fetchHistoricalTrends(region, weeks = 8) {
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

export async function fetchAllHistoricalTrends(weeks = 8) {
  try {
    return mockHistoricalTrends;
  } catch (error) {
    console.error("Error fetching all historical trends:", error);
    return {};
  }
}

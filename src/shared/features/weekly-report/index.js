// Component exports
export { default as ExecutiveBrief } from "./components/ExecutiveBrief";
export { default as RegionalBrief } from "./components/RegionalBrief";
export { default as IncidentDetails } from "./components/IncidentDetails";

// Utils exports
export { fetchWeeklyIncidents } from "./utils/api";
export { fetchWeeklyReportContent } from "./utils/client-api";
export {
  getCurrentReportingWeek,
  getReportingWeek,
  formatDateRange,
  getWeekNumber,
  getYearWeek,
} from "./utils/dates";
export {
  fetchHistoricalTrends,
  fetchAllHistoricalTrends,
} from "./utils/trend-api";
export { formatCoordinates, formatLocation } from "./utils/coordinates";
export { getFirstSentence } from "./utils/text";

// Data exports
export { mockHistoricalTrends } from "./utils/mock-data";
export { historicalTrends, regionalMonthlyData, regionalStats, refreshReportData } from "./utils/report-data";

// Map manager exports
export { 
  MapManagerProvider, 
  useMapManager, 
  SharedMap,
  MAP_IDS
} from "./utils/map-manager";

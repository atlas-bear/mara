// Export incident-related features
export { default as useIncident } from "./hooks/useIncident";

// Export hybrid API functions
export {
  fetchIncident,
  fetchRelatedIncidents,
  fetchIncidentHistory,
} from "./utils/hybrid-api";

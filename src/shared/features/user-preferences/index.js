// Export user preferences features
export { default as useUserPreferences } from "./hooks/useUserPreferences";

// Export hybrid API functions
export {
  getUserPreferences,
  updateEmailPreferences,
  updateUserProfile,
  getEmailStatistics,
  sendTestEmail,
} from "./utils/hybrid-api";

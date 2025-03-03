import { sendFlashReport as sendGridFlashReport } from "../services/sendgrid.jsx";

export const useNotifications = () => {
  const sendFlashReport = async (incident, recipients) => {
    try {
      if (!incident) {
        throw new Error("Incident data is required");
      }

      if (!recipients || recipients.length === 0) {
        throw new Error("At least one recipient is required");
      }

      // Convert subscribers to email addresses if they're objects
      const emailRecipients = recipients.map((recipient) => {
        if (typeof recipient === "string") {
          // Check if it's an email or a subscriber ID
          return recipient.includes("@")
            ? recipient
            : `${recipient}@example.com`;
        }
        // If it's an object with an email property
        return recipient.email || `${recipient.id}@example.com`;
      });

      // Use the SendGrid service function
      const results = await sendGridFlashReport(incident, emailRecipients);
      return results;
    } catch (error) {
      console.error("Error sending flash report:", error);
      throw error;
    }
  };

  return { sendFlashReport };
};

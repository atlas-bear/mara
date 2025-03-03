export const useNotifications = () => {
  const sendFlashReport = async (incident, recipients) => {
    try {
      if (!incident) {
        throw new Error('Incident data is required');
      }
      
      if (!recipients || recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }
      
      // Format recipients for the serverless function
      const formattedRecipients = recipients.map(recipient => {
        if (typeof recipient === 'string') {
          // If it's just a string email
          return {
            email: recipient.includes('@') ? recipient : `${recipient}@example.com`
          };
        } else {
          // If it's an object with more details
          return {
            email: recipient.email || `${recipient.id}@example.com`,
            firstName: recipient.firstName || '',
            lastName: recipient.lastName || '',
            isClient: recipient.isClient || false
          };
        }
      });
      
      // Call the Netlify function
      const response = await fetch('/.netlify/functions/send-flash-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incidentId: incident.id,
          recipients: formattedRecipients,
          // Pass custom branding if needed
          customBranding: null
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send flash report');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending flash report:', error);
      throw error;
    }
  };

  return { sendFlashReport };
};

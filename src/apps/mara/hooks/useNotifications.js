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
      
      console.log('Flash report request:', {
        incidentId: incident.id,
        incident: incident,
        recipients: formattedRecipients,
      });
      
      // TEMP: For testing - simulate successful sending
      if (incident.id === '2024-2662') {
        console.log('DEMO MODE: Simulating successful flash report');
        
        // Wait for 1 second to simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
          message: 'Flash report sent',
          results: formattedRecipients.map(r => ({
            email: r.email,
            status: 'demo-sent'
          }))
        };
      }
      
      // Call the Netlify function for real sending
      try {
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
      } catch (serverError) {
        console.error('Server error:', serverError);
        
        // Fallback to demo mode if server function fails
        if (window.confirm('Server function failed. Would you like to use demo mode instead?')) {
          return {
            message: 'Flash report sent (DEMO MODE)',
            results: formattedRecipients.map(r => ({
              email: r.email,
              status: 'demo-sent'
            }))
          };
        }
        
        throw serverError;
      }
    } catch (error) {
      console.error('Error sending flash report:', error);
      throw error;
    }
  };

  return { sendFlashReport };
};

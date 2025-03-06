export const useNotifications = () => {
  // Generate a demo public URL for testing
  const generateDemoPublicUrl = (incidentId, recipient) => {
    const baseUrl = window.location.origin;
    const randomToken = Math.random().toString(36).substring(2, 15);
    const brandParam = recipient.isClient ? '?brand=client' : '';
    return `${baseUrl}/public/flash-report/${incidentId}/${randomToken}${brandParam}`;
  };

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
      
      // NOTE: We now use the server's testMode instead of client-side mock data
      // This ensures consistent token generation between preview and actual emails
      /*
      if (incident.id === '2025-0010') {
        console.log('DEMO MODE: Simulating successful flash report');
        
        // Wait for 1 second to simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate demo public URLs for testing
        const results = formattedRecipients.map(r => ({
          email: r.email,
          status: 'demo-sent',
          publicUrl: generateDemoPublicUrl(incident.id, r)
        }));
        
        // Log the public URLs for demo purposes
        console.log('Demo public URLs:');
        results.forEach(r => {
          console.log(`- ${r.email}: ${r.publicUrl}`);
        });
        
        console.log('\n✨ Copy any of these URLs to test the public Flash Report view');
        console.log('Note: In production, these URLs would be included in the emails sent');
        
        return {
          message: 'Flash report sent',
          results
        };
      }
      */
      
      // Call the Netlify function for real sending
      try {
        console.log('🚀 Calling Netlify function: send-flash-report');
        console.log('Payload:', {
          incidentId: incident.id,
          recipients: formattedRecipients,
        });
        
        const response = await fetch('/.netlify/functions/send-flash-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            incidentId: incident.id,
            recipients: formattedRecipients,
            // Enable test mode for all requests during development
            testMode: true,
            // Pass custom branding if needed
            customBranding: null
          }),
        });
        
        console.log('📬 Netlify function response status:', response.status);
        
        // Get response text first, before any other processing
        let responseText;
        try {
          responseText = await response.text();
          console.log('📄 Netlify function raw response:', responseText);
        } catch (e) {
          console.error('Error getting response text:', e);
          throw new Error('Could not read response from server');
        }
        
        // Check if response is OK
        if (!response.ok) {
          try {
            const errorData = JSON.parse(responseText);
            throw new Error(errorData.error || 'Failed to send flash report');
          } catch (e) {
            throw new Error(`Server error (${response.status}): ${responseText || 'No error details'}`);
          }
        }
        // Now parse as JSON
        let result;
        try {
          result = responseText ? JSON.parse(responseText) : {};
          console.log('📊 Netlify function parsed response:', result);
        } catch (e) {
          console.error('Error parsing JSON response:', e);
          throw new Error('Invalid response from server: ' + responseText);
        }
        
        // Log public URLs if available
        if (result.results && result.results.some(r => r.publicUrl)) {
          console.log('Public URLs:');
          result.results.forEach(r => {
            if (r.publicUrl) {
              console.log(`- ${r.email}: ${r.publicUrl}`);
            }
          });
          
          console.log('\n✨ Copy any of these URLs to test the public Flash Report view');
          console.log('Note: In production, these URLs would be included in the emails sent');
        }
        
        return result;
      } catch (serverError) {
        console.error('Server error:', serverError);
        
        // Fallback to demo mode if server function fails
        if (window.confirm('Server function failed. Would you like to use demo mode instead?')) {
          // Generate demo public URLs for testing
          const results = formattedRecipients.map(r => ({
            email: r.email,
            status: 'demo-sent',
            publicUrl: generateDemoPublicUrl(incident.id, r)
          }));
          
          // Log the public URLs for demo purposes
          console.log('Demo public URLs:');
          results.forEach(r => {
            console.log(`- ${r.email}: ${r.publicUrl}`);
          });
          
          return {
            message: 'Flash report sent (DEMO MODE)',
            results
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

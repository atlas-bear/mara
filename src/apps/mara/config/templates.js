// Email template configurations
export const emailTemplate = {
  flashReport: {
    subject: "🚨 MARITIME ALERT: {vesselName} Incident",
    preheader: "Flash report for maritime incident {incidentId}",
  }
};

// SendGrid configuration
export const sendgridConfig = {
  flashReport: {
    category: 'flash-report',
    tags: ['maritime', 'incident', 'alert'],
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true }
    }
  }
};

// Configuration for personalization and dynamic content
export const dynamicFields = {
  vessel: ['vesselName', 'vesselType', 'vesselIMO', 'vesselFlag'],
  incident: ['id', 'type', 'date', 'location', 'description', 'coordinates'],
  crew: ['crewStatus'],
  response: ['responseActions', 'authorities_notified'],
  analysis: ['analysis', 'recommendations']
};

// Instructions for testing SendGrid templates
export const sendgridInstructions = `
To test the Flash Report email template with SendGrid:

1. Environment Variables Setup:
   - Set VITE_SENDGRID_API_KEY with your SendGrid API key
   - Set VITE_SENDGRID_FROM_EMAIL with your verified sender email

2. Testing Steps:
   - Use the Flash Report preview page to test email sending
   - Toggle between different branding to verify dynamic customization
   - Check that recipient domains properly trigger correct branding

3. SendGrid Dashboard:
   - Monitor delivery, opens, and clicks in the SendGrid dashboard
   - Check that categories and tags are properly applied
   - Verify that branding is correct for each recipient

4. Dynamic Field Testing:
   - Test with different incident data to verify all fields render correctly
   - Verify that conditional content (like stolen items) appears appropriately
   - Test with missing data to verify fallback handling
`;
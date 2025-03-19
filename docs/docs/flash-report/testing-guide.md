# Flash Report Testing Guide

This guide explains how to test the Flash Report functionality in different environments.

## Quick Testing with Test Function

The simplest way to test the Flash Report system is to use the dedicated test function:

```javascript
// Example using fetch API
async function testFlashReport(recipientEmail) {
  try {
    const response = await fetch('/.netlify/functions/test-flash-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientEmail,
        useDemoIncident: true
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to test flash report');
    }
    
    return result;
  } catch (error) {
    console.error('Error testing flash report:', error);
    throw error;
  }
}

// Usage
testFlashReport('your-email@example.com')
  .then(result => console.log('Test completed:', result))
  .catch(error => console.error('Test failed:', error));
```

## Using the Demo Mode

The Flash Report system includes a client-side demo mode that allows testing without accessing real incident data:

1. Enable demo mode in your application
2. Select recipients for the test flash report
3. Click "Send Flash Report" to trigger a test email with sample incident data

The system will automatically use the demo incident (ID: 2024-2662) when in demo mode.

## Testing in Development Environment

When testing in a development environment without SendGrid API keys:

1. The system will detect missing API keys and operate in a "test mode"
2. Instead of sending actual emails, it will return a success response with the email content that would have been sent
3. You can examine this response to verify the email content and recipient list

Example development mode response:

```json
{
  "message": "TESTING MODE: Email would be sent (no SendGrid API key provided)",
  "incident": {
    "id": "2024-2662",
    "type": "Robbery",
    "date": "2024-10-17T18:08:00.000Z",
    "location": "Singapore Strait",
    "coordinates": {
      "latitude": 1.13,
      "longitude": 103.5
    },
    "vesselName": "ASPASIA LUCK",
    "vesselType": "Bulk Carrier",
    "vesselFlag": "Liberia",
    "vesselIMO": "9223485",
    "status": "Underway",
    "destination": "PEBGB",
    "crewStatus": "All Safe",
    "description": "Test incident description for flash report from serverless function.",
    "responseActions": ["Action 1", "Action 2"],
    "authorities_notified": ["Local Maritime Authority"],
    "items_stolen": ["Ship supplies"],
    "analysis": "This is a sample analysis for testing the flash report email functionality.",
    "recommendations": "Use caution when transiting this area.",
    "mapImageUrl": "https://placehold.co/600x400?text=Map+Location"
  },
  "recipients": ["test@example.com"],
  "mapImageUrl": "https://placehold.co/600x400?text=Map+Location"
}
```

## Testing with Real Incidents

To test with real incident data:

1. Get a valid incident ID from your Airtable instance
2. Call the test-flash-report function with the specific incident ID:

```javascript
testFlashReport('your-email@example.com', '2024-1234', false)
  .then(result => console.log('Test with real incident completed:', result))
  .catch(error => console.error('Test failed:', error));
```

## Email Appearance Testing

To test the visual appearance of flash report emails across different email clients:

1. Use the test function to send test reports to email testing services like Litmus or Email on Acid
2. Test with both the default branding and custom branding options
3. Verify that maps and images render correctly
4. Check responsive design on mobile devices

## Troubleshooting

If you encounter issues when testing the Flash Report functionality:

1. **Missing incident data**: Verify that the incident ID exists in Airtable or use the demo incident ID (`2024-2662`)
2. **Email not received**: Check spam folders and verify SendGrid API key configuration
3. **Missing maps**: Ensure the Mapbox token is correctly configured
4. **Branding issues**: Verify the branding configuration and environment variables
5. **Missing vessel data**: Check the Netlify function logs for vessel data extraction:
   - Look for "vessel relationship data" or "vessel lookup" log messages
   - Verify that vessel data exists in Airtable and is correctly linked to incidents
   - Check IMO numbers match between incident and vessel tables

For development environment issues, check the function logs in the Netlify dashboard:

1. Go to your site's dashboard on Netlify
2. Navigate to "Functions" in the left sidebar
3. Find the "send-flash-report" function and click on it
4. View recent invocations to see detailed logs
5. Look for key debug messages like:
   - "VESSEL DATA DEBUG"
   - "DEBUG - VESSEL DATA BEING SENT TO EMAIL"
   - "Found IMO" or "Found vessel name"
   - "Successfully fetched vessel"
   - "Vessel data source: [source]"

## Testing Links and Branding

The Flash Report system now provides:

1. **Consistent email branding**: All emails use MARA branding for a consistent experience
2. **Domain-based link branding**: When recipients click the "View Online" link, they see:
   - Client-branded version if their email domain matches a client domain
   - Default MARA branding otherwise
3. **Extended link validity**: Links now remain valid for 1 year instead of 7 days

To test these features:

1. Send a test report to both client domain emails (e.g., `user@clientdomain.com`) and non-client emails
2. Verify all emails have consistent MARA branding
3. Click the "View Online" links and verify:
   - Client domain recipients see client-branded page
   - Non-client domain recipients see MARA-branded page
4. Test the links again after several weeks to confirm extended validity
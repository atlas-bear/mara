# Flash Report Integration Guide

This guide explains how to integrate the Flash Report functionality into your applications and workflows.

## Client-Side Integration

### Basic Integration

To send a flash report from your frontend application:

```javascript
// Example using fetch API
async function sendFlashReport(incidentId, recipients) {
  try {
    const response = await fetch('/.netlify/functions/send-flash-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        incidentId,
        recipients
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send flash report');
    }
    
    return result;
  } catch (error) {
    console.error('Error sending flash report:', error);
    throw error;
  }
}

// Usage example
sendFlashReport('2024-2662', [
  { email: 'stakeholder@example.com' }
])
  .then(result => console.log('Flash report sent:', result))
  .catch(error => console.error('Failed to send flash report:', error));
```

### Client Identification

As of the latest update, emails always use MARA branding for consistency, but links in the emails will use client branding based on the recipient's email domain. To properly identify clients:

```javascript
sendFlashReport('2024-2662', [
  // Client email - will get client-branded links
  { email: 'stakeholder@clientdomain.com' },
  // Non-client email - will get MARA-branded links
  { email: 'other@example.com' }
])
  .then(result => console.log('Flash report sent:', result))
  .catch(error => console.error('Failed to send flash report:', error));
```

The system automatically detects client email domains based on the `CLIENT_DOMAINS` environment variable.

### Custom Branding (Legacy Support)

While custom branding parameters are still supported in the API for backward compatibility, they are no longer used for email branding. All emails use MARA branding regardless of these parameters.

```javascript
// Note: This customBranding is no longer applied to emails
const customBranding = {
  logo: 'https://example.com/logo.png',
  companyName: 'Example Company',
  colors: {
    primary: '#0047AB',
    secondary: '#FF6B00'
  }
};

sendFlashReport('2024-2662', [
  { email: 'stakeholder@example.com' }
], customBranding)
  .then(result => console.log('Flash report sent:', result))
  .catch(error => console.error('Failed to send flash report:', error));
```

## Server-Side Integration

If you need to trigger flash reports from other server-side functions or services:

```javascript
const axios = require('axios');

async function triggerFlashReport(incidentId, recipients) {
  try {
    const response = await axios.post(
      'https://your-netlify-site.netlify.app/.netlify/functions/send-flash-report',
      {
        incidentId,
        recipients
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // Include any necessary authorization headers
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error triggering flash report:', error.response?.data || error.message);
    throw error;
  }
}
```

## Environment Configuration

The Flash Report system relies on several environment variables that need to be configured in your Netlify deployment:

| Variable | Description | Required | Notes |
|----------|-------------|----------|-------|
| `SENDGRID_API_KEY` | API key for SendGrid email service | Yes | |
| `SENDGRID_FROM_EMAIL` | Default sender email address | Yes | |
| `MAPBOX_TOKEN` | API token for Mapbox for generating static maps | Yes | |
| `DEFAULT_LOGO` | MARA logo URL | Yes | Used in all email content |
| `DEFAULT_COMPANY_NAME` | MARA company name | Yes | Used in all email content |
| `DEFAULT_PRIMARY_COLOR` | MARA primary color (hex) | Yes | Used in all email content |
| `DEFAULT_SECONDARY_COLOR` | MARA secondary color (hex) | Yes | Used in all email content |
| `CLIENT_DOMAINS` | Comma-separated list of client email domains | No | Used to determine which recipients get client-branded links |
| `CLIENT_LOGO` | URL to client logo | No | Used only in web view for client domains |
| `CLIENT_NAME` | Client company name | No | Used only in web view for client domains |
| `CLIENT_PRIMARY_COLOR` | Client primary brand color (hex) | No | Used only in web view for client domains |
| `CLIENT_SECONDARY_COLOR` | Client secondary brand color (hex) | No | Used only in web view for client domains |

## Webhook Integration

To automatically trigger flash reports from external systems, you can set up a webhook that calls the flash report endpoint when new incidents are detected:

```javascript
// Example webhook handler in Express.js
app.post('/incident-webhook', async (req, res) => {
  try {
    const { incidentId, severity } = req.body;
    
    // Only send flash reports for high severity incidents
    if (severity === 'high') {
      // Get stakeholders who should receive this alert
      const stakeholders = await getRelevantStakeholders(incidentId);
      
      // Format recipients for the flash report API
      const recipients = stakeholders.map(s => ({ email: s.email }));
      
      // Call the flash report API
      await triggerFlashReport(incidentId, recipients);
      
      console.log(`Flash report triggered for incident ${incidentId}`);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing incident webhook:', error);
    res.status(500).json({ error: 'Failed to process incident' });
  }
});
```
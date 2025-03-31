# Weekly Report Email Notifications

This document describes the automated email notification system for weekly reports, which sends alerts to subscribed users when new reports are available.

## Overview

The Weekly Report Email Notification system is a scheduled serverless function that runs every Tuesday at 08:00 UTC, after the weekly report period has completed (Monday 21:00 UTC). It notifies subscribed users about the availability of the weekly report and provides a direct link to access it.

Key features:
- Automatic notification when weekly reports are ready
- Consistent branding with flash reports
- Support for both standard and client-branded links
- Domain-based routing to appropriate report URLs
- Opt-in subscription model

## Architecture

The email notification system consists of:

1. **Scheduled Function**: `send-weekly-report-notification` runs every Tuesday at 08:00 UTC
2. **Test Function**: `test-weekly-notification` for manual testing
3. **Supabase Integration**: User subscription management
4. **SendGrid Integration**: Email delivery service

## Implementation

### Scheduled Function

The `send-weekly-report-notification.js` function is scheduled to run automatically every Tuesday morning:

```javascript
// netlify.toml configuration
[functions."send-weekly-report-notification"]
schedule = "0 8 * * 2"  // Every Tuesday at 08:00 UTC
```

The function:
1. Determines the current reporting week (previous Monday to Monday)
2. Retrieves users who have opted in to weekly report notifications
3. Sends personalized emails with links to the appropriate report

### User Subscription Management

Users can subscribe to weekly report notifications through their account settings. Subscription preferences are stored in Supabase:

```javascript
// Fetch subscribed users from Supabase
const { data, error } = await supabase
  .from('users')
  .select('id, email, first_name, last_name, preferences')
  .eq('receive_weekly_reports', true);
```

### Client Domain Handling

For users with email domains that match the `CLIENT_DOMAINS` environment variable, the notification contains a link to the client-branded weekly report:

```javascript
// Determine which URL to use based on email domain
let reportUrl;
if (useClientBranding && clientReportUrl) {
  reportUrl = `${clientReportUrl}/${yearWeekCode}`;
} else {
  reportUrl = `${publicUrl}/weekly-report/${yearWeekCode}`;
}
```

### Email Template

The weekly notification emails follow the same design language as flash reports, creating a consistent user experience:

- Company logo and branding
- Week number and date range
- Brief description of the report contents
- Direct link to the weekly report
- Standard footer with legal text

## Configuration

### Environment Variables

The notification system requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key for email sending | `SG.xxx...` |
| `SENDGRID_FROM_EMAIL` | Email address to send from | `alerts@example.com` |
| `PUBLIC_URL` | Base URL for standard reports | `https://mara.example.com` |
| `CLIENT_REPORT_URL` | Base URL for client reports | `https://client.example.com` |
| `CLIENT_DOMAINS` | Comma-separated list of domains that should receive client-branded links | `client.com,customer.org` |
| `DEFAULT_LOGO` | URL to logo for email template | `https://example.com/logo.png` |
| `DEFAULT_COMPANY_NAME` | Company name for email template | `MARA Maritime Risk Analysis` |

### Testing

A dedicated testing endpoint is available to verify email delivery and content:

```bash
# Test email delivery
./scripts/test-weekly-email.sh "https://your-netlify-url.netlify.app" "your-email@example.com" "true"
```

Parameters:
1. Netlify site URL
2. Test recipient email
3. Whether to send both standard and client versions for testing (optional, defaults to true)

## Database Schema

The user subscription preferences are stored in the Supabase `users` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `email` | String | User's email address |
| `first_name` | String | User's first name |
| `last_name` | String | User's last name |
| `receive_weekly_reports` | Boolean | Whether the user has opted in to weekly reports |
| `preferences` | JSON | Additional user preferences |

## Debugging and Monitoring

Monitor the execution of the notification system through Netlify function logs:

1. Check scheduled function execution in the Netlify dashboard
2. View logs for the `send-weekly-report-notification` function
3. For testing, view logs for the `test-weekly-notification` function

## Related Documentation

- [Weekly Report Overview](./index.md)
- [Date Handling](./date-handling.md) - How the weekly report period is determined
- [Implementation Guide](./implementation.md) - General weekly report implementation
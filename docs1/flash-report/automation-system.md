# Flash Report Automation System

This document details the automation system for MARA Flash Reports, which handles automatic triggering of flash reports when incidents are created or updated.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram) 
- [Components](#components)
  - [Airtable Automation](#airtable-automation)
  - [Webhook Handler](#webhook-handler)
  - [Cache Management](#cache-management)
  - [Supabase Integration](#supabase-integration)
  - [Flash Report Delivery](#flash-report-delivery)
- [Sequence Diagrams](#sequence-diagrams)
- [Implementation Details](#implementation-details)
  - [Webhook Security](#webhook-security)
  - [Update Detection](#update-detection)
  - [Client Branding](#client-branding)
- [Configuration Guide](#configuration-guide)
- [Testing & Troubleshooting](#testing--troubleshooting)

## System Overview

The Flash Report Automation System automatically sends email alerts to stakeholders when maritime incidents occur or are significantly updated. The system connects Airtable (where incident data is stored) with Netlify Functions and Supabase (where recipient information is managed).

Key features include:
- Automatic triggering of flash reports when incidents are created/updated
- Smart detection of significant changes to avoid alert fatigue
- Recipient management through Supabase database
- Domain-based branding customization
- Comprehensive incident data caching

## Architecture Diagram

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│              │     │                 │     │                     │
│   Airtable   │     │  Netlify Blobs  │     │      Supabase       │
│              │     │                 │     │                     │
│  ┌────────┐  │     │  ┌───────────┐  │     │  ┌───────────────┐  │
│  │Incident │  │     │  │ Incident  │  │     │  │    Users      │  │
│  │ Table   │──┼─────┼─▶│  Cache    │  │     │  │  (Recipients) │  │
│  └────────┘  │     │  └───────────┘  │     │  └───────────────┘  │
│      │       │     │                 │     │          ▲          │
└──────┼───────┘     └─────────────────┘     └──────────┼──────────┘
       │                                                │
       │ Webhook                                        │
       │                                                │
       ▼                                                │
┌──────────────────────────────────────────────────────┼──────────┐
│                                                       │          │
│                     Netlify Functions                 │          │
│                                                       │          │
│  ┌──────────────────┐     ┌───────────────────┐      │          │
│  │                  │     │                   │      │          │
│  │ Webhook Handler  │────▶│ ensure-incident-  │      │          │
│  │                  │     │     cached        │      │          │
│  └──────────────────┘     └───────────────────┘      │          │
│           │                                           │          │
│           │                                           │          │
│           ▼                                           │          │
│  ┌──────────────────┐     ┌───────────────────┐      │          │
│  │                  │     │                   │      │          │
│  │ send-flash-report│◀────│   getRecipients   │──────┘          │
│  │                  │     │                   │                 │
│  └──────────────────┘     └───────────────────┘                 │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────┐
│                  │
│  Email Delivery  │
│    (SendGrid)    │
│                  │
└──────────────────┘
```

## Components

### Airtable Automation

An Airtable automation script triggers the process when an incident record is created or updated with a map image URL.

**Key Features:**
- Monitors for incident records with map images
- Tracks last alert sent time to detect updates
- Sends webhook with incident data to Netlify function
- Uses a simplified signature for webhook authentication

**Script Implementation:**

```javascript
// Airtable Automation Script
const config = input.config();
const recordId = config.recordId;

// Get the full record data using Airtable API
let record = await base.getTable('incident').selectRecordAsync(recordId);

// Extract the required fields
const incidentId = record.getCellValue('id');
const mapImageUrl = record.getCellValue('map_image_url');
const modifiedAt = record.getCellValue('modified_at');
const lastFlashAlertSentAt = record.getCellValue('last_flash_alert_sent_at');

// Validate we have the minimum required data
if (!incidentId || !mapImageUrl) {
    output.set('error', 'Missing required data');
    output.set('success', false);
} else {
    // Create the webhook payload
    const payload = {
        timestamp: new Date().toISOString(),
        action: "incident_map_created",
        lastFlashAlertSentAt: lastFlashAlertSentAt,
        modifiedAt: modifiedAt,
        changes: [
            {
                table: { name: "incident" },
                record: {
                    id: recordId,
                    fields: { id: incidentId, map_image_url: mapImageUrl }
                }
            }
        ],
        webhook_id: "airtable-mara-webhook"
    };
    
    // Simple security implementation
    const WEBHOOK_SECRET = "your-webhook-secret-here";
    const payloadString = JSON.stringify(payload);
    
    try {
        // Send the webhook with the secret as the signature
        const response = await fetch(
            'https://mara-v2.netlify.app/.netlify/functions/airtable-webhook-handler',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-airtable-webhook-signature': WEBHOOK_SECRET
                },
                body: payloadString
            }
        );
        
        // Update the last alert sent timestamp on success
        if (response.ok) {
            await base.getTable('incident').updateRecordAsync(recordId, {
                'last_flash_alert_sent_at': new Date().toISOString()
            });
            output.set('success', true);
        } else {
            output.set('success', false);
            output.set('error', `Request failed: ${response.status}`);
        }
    } catch (error) {
        output.set('success', false);
        output.set('error', error.message);
    }
}
```

### Webhook Handler

The `airtable-webhook-handler.js` Netlify function processes webhook events from Airtable.

**Key Features:**
- Validates webhook authenticity using signature
- Detects if an incident is new or updated
- Ensures the incident is cached
- Determines if a flash report should be sent
- Fetches recipients from Supabase
- Triggers flash report delivery

**Code Highlights:**
```javascript
// Webhook handler function
export async function handler(event) {
  // Validate webhook signature
  const webhookSecret = process.env.AIRTABLE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = event.headers['x-airtable-webhook-signature'];
    // Signature validation logic
    // ...
  }
  
  // Extract incident ID and check if this is an update
  const incidentId = extractIncidentId(payload);
  const lastFlashAlertSentAt = payload.lastFlashAlertSentAt || null;
  const modifiedAt = payload.modifiedAt || null;
  const isUpdate = !!lastFlashAlertSentAt;
  
  // Skip if already sent alert and no new changes
  if (isUpdate && lastFlashAlertSentAt && modifiedAt && 
      new Date(lastFlashAlertSentAt) >= new Date(modifiedAt)) {
    return { statusCode: 200, body: JSON.stringify({ 
      success: true, message: 'No significant changes since last alert'
    })};
  }
  
  // Ensure incident data is cached
  const cacheResult = await ensureIncidentCached(incidentId, { forceRefresh: true });
  
  // Check if incident qualifies for a flash report
  if (cacheResult.success) {
    const incident = cacheResult.incidentData;
    const canSendFlashReport = incident && incident.map_image_url && 
                              incident.incident_type && incident.incident_type.length > 0;
    
    if (canSendFlashReport && shouldSendFlashReport(incident, isUpdate)) {
      await triggerFlashReport(incidentId, isUpdate);
    }
  }
  
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}
```

### Cache Management

The system uses an enhanced caching mechanism in `incident-cache.js` to store incident data.

**Key Features:**
- Stores comprehensive incident data in Netlify Blobs
- Supports both lazy loading and forced refresh
- Includes vessel and related entity data
- Provides cache invalidation functions
- Implements configurable TTL (time-to-live)

**Key Function: ensureIncidentCached**
```javascript
export async function ensureIncidentCached(incidentId, options = {}) {
  if (!incidentId) {
    throw new Error('Incident ID is required');
  }

  try {
    // Check current cache status
    const cacheKey = `${CACHE_PREFIX}${incidentId}`;
    const existingCache = !options.forceRefresh ? await cacheOps.get(cacheKey) : null;
    
    // Determine if refresh is needed
    let needsRefresh = true;
    let incidentData = null;
    
    if (existingCache) {
      // Check cache TTL
      const cacheTime = new Date(existingCache.timestamp).getTime();
      const now = new Date().getTime();
      const ttlMs = (options.ttlHours || CACHE_TTL_HOURS) * 60 * 60 * 1000;
      
      if (now - cacheTime <= ttlMs && !options.forceRefresh) {
        // Use cache
        needsRefresh = false;
        incidentData = existingCache.data;
      }
    }
    
    // Refresh the cache if needed
    if (needsRefresh) {
      incidentData = await fetchIncidentDataComprehensive(incidentId);
      
      if (!incidentData) {
        return { success: false, error: 'Incident not found' };
      }
      
      // Store in cache
      await cacheOps.store(cacheKey, { data: incidentData });
    }
    
    return {
      success: true,
      incidentId,
      incidentData,
      fromCache: !needsRefresh,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Supabase Integration

The `supabase.js` utility connects to the Supabase database to fetch recipients for flash reports.

**Key Features:**
- Fetches recipients based on preferences
- Supports filtering by region and incident type
- Maps recipients to the format expected by send-flash-report
- Handles domain-based branding determination

**Recipient Fetching Function:**
```javascript
export async function getFlashReportRecipients(options = {}) {
  const supabase = getSupabaseClient();
  
  try {
    // Query users who want to receive flash reports
    let query = supabase
      .from('users')
      .select('id, email, first_name, last_name, preferences, receive_flash_reports')
      .eq('receive_flash_reports', true);
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Apply region and incident type filters if needed
    let recipients = data;
    
    // Format recipients for the email sending function
    return recipients.map(user => ({
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      metadata: {
        userId: user.id,
        preferences: user.preferences || {}
      }
    }));
  } catch (error) {
    console.error('Error in getFlashReportRecipients:', error);
    throw error;
  }
}
```

### Flash Report Delivery

The existing `send-flash-report.js` function has been modified to support the automation system.

**Key Changes:**
- Updated client branding logic with environment variables
- Added support for "update" vs. "new" report distinction
- Enhanced cache integration
- Improved logging and error handling

## Sequence Diagrams

### New Incident Flow

```
┌─────────┐          ┌─────────────┐          ┌───────────┐          ┌──────────┐          ┌──────────┐
│ Airtable │          │   Webhook   │          │  Cache    │          │ Supabase │          │ SendGrid │
│          │          │   Handler   │          │           │          │          │          │          │
└────┬─────┘          └──────┬──────┘          └─────┬─────┘          └────┬─────┘          └────┬─────┘
     │                       │                       │                     │                     │
     │  Webhook Trigger      │                       │                     │                     │
     │─────────────────────▶│                       │                     │                     │
     │                       │                       │                     │                     │
     │                       │  ensureIncidentCached │                     │                     │
     │                       │──────────────────────▶                     │                     │
     │                       │                       │                     │                     │
     │                       │                       │  Cache Miss         │                     │
     │                       │                       │                     │                     │
     │                       │                       │  Fetch from Airtable│                     │
     │                       │                       │◀────────────────────│                     │
     │                       │                       │                     │                     │
     │                       │                       │  Store in Cache     │                     │
     │                       │                       │─────────────────────▶                     │
     │                       │                       │                     │                     │
     │                       │◀──────────────────────                     │                     │
     │                       │                       │                     │                     │
     │                       │  Get Recipients       │                     │                     │
     │                       │───────────────────────────────────────────▶│                     │
     │                       │                       │                     │                     │
     │                       │◀──────────────────────────────────────────│                     │
     │                       │                       │                     │                     │
     │                       │  Trigger flash report │                     │                     │
     │                       │───────────────────────────────────────────────────────────────▶│
     │                       │                       │                     │                     │
     │                       │◀──────────────────────────────────────────────────────────────│
     │                       │                       │                     │                     │
     │◀──────────────────────                       │                     │                     │
     │                       │                       │                     │                     │
     │  Update last_flash_   │                       │                     │                     │
     │  alert_sent_at        │                       │                     │                     │
     │────────────────────────                       │                     │                     │
     │                       │                       │                     │                     │
```

### Updated Incident Flow

```
┌─────────┐          ┌─────────────┐          ┌───────────┐          ┌──────────┐          ┌──────────┐
│ Airtable │          │   Webhook   │          │  Cache    │          │ Supabase │          │ SendGrid │
│          │          │   Handler   │          │           │          │          │          │          │
└────┬─────┘          └──────┬──────┘          └─────┬─────┘          └────┬─────┘          └────┬─────┘
     │                       │                       │                     │                     │
     │  Webhook Trigger     │                       │                     │                     │
     │  (with lastSentAt    │                       │                     │                     │
     │   & modifiedAt)      │                       │                     │                     │
     │─────────────────────▶│                       │                     │                     │
     │                       │                       │                     │                     │
     │                       │  Check if update      │                     │                     │
     │                       │  needed               │                     │                     │
     │                       │───────┐               │                     │                     │
     │                       │       │               │                     │                     │
     │                       │◀──────┘               │                     │                     │
     │                       │                       │                     │                     │
     │                       │  ensureIncidentCached │                     │                     │
     │                       │  (forceRefresh=true)  │                     │                     │
     │                       │──────────────────────▶                     │                     │
     │                       │                       │                     │                     │
     │                       │◀──────────────────────                     │                     │
     │                       │                       │                     │                     │
     │                       │  Get Recipients       │                     │                     │
     │                       │───────────────────────────────────────────▶│                     │
     │                       │                       │                     │                     │
     │                       │◀──────────────────────────────────────────│                     │
     │                       │                       │                     │                     │
     │                       │  Trigger flash report │                     │                     │
     │                       │  (isUpdate=true)      │                     │                     │
     │                       │───────────────────────────────────────────────────────────────▶│
     │                       │                       │                     │                     │
     │                       │◀──────────────────────────────────────────────────────────────│
     │                       │                       │                     │                     │
     │◀──────────────────────                       │                     │                     │
     │                       │                       │                     │                     │
     │  Update last_flash_   │                       │                     │                     │
     │  alert_sent_at        │                       │                     │                     │
     │────────────────────────                       │                     │                     │
     │                       │                       │                     │                     │
```

## Implementation Details

### Webhook Security

The webhook validation uses a shared secret approach:

1. The Airtable script sends the secret directly as the signature header
2. The webhook handler validates this in two ways:
   - Direct comparison for Airtable scripts (which lack crypto)
   - HMAC-SHA256 validation as a fallback for other systems

```javascript
function verifyWebhookSignature(payload, signature, secret) {
  // Simple validation for Airtable
  if (signature === secret) {
    return true;
  }
  
  // Standard HMAC validation as fallback
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}
```

### Update Detection

The system detects if an incident has been updated using timestamp comparison:

1. Airtable tracks `last_flash_alert_sent_at` when an alert is sent
2. The webhook includes both `lastFlashAlertSentAt` and `modifiedAt`
3. If `modifiedAt` is newer than `lastFlashAlertSentAt`, it's considered updated
4. The webhook handler uses this to decide if a new alert should be sent

```javascript
// In the webhook handler:
if (lastFlashAlertSentAt && modifiedAt && 
    new Date(lastFlashAlertSentAt) >= new Date(modifiedAt)) {
  console.log(`No significant changes since last alert, skipping update`);
  return { /* Skip sending alert */ };
}
```

### Client Branding

Email recipients receive appropriate branding based on their email domain:

1. The system extracts the domain from the recipient's email address
2. It checks against `CLIENT_DOMAINS` environment variable (comma-separated list)
3. For matching domains, `?brand=client` is added to the public URL
4. Email templates always use MARA branding for consistency

```javascript
function shouldUseClientBranding(email) {
  if (!email) return false;
  
  // Extract domain from email
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain) return false;
  
  // Get client domains from environment
  const clientDomains = process.env.CLIENT_DOMAINS
    ? process.env.CLIENT_DOMAINS.split(",")
        .map(d => d.trim().toLowerCase())
        .filter(Boolean)
    : [];
  
  // Check if domain matches any client domain
  return clientDomains.some(clientDomain => domain === clientDomain);
}
```

## Configuration Guide

To set up the Flash Report Automation System, you need to configure the following components:

### 1. Environment Variables

Set these in your Netlify environment:

```
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here

# Webhook Security
AIRTABLE_WEBHOOK_SECRET=your-webhook-secret-here

# Client Branding
CLIENT_DOMAINS=clientdomain.com,anotherclient.com

# Base URL
PUBLIC_URL=https://mara-v2.netlify.app
```

### 2. Airtable Configuration

1. **Create Required Fields:**
   - `last_flash_alert_sent_at`: DateTime field to track when alerts were last sent
   - `modified_at`: DateTime field that updates when significant fields change

2. **Set Up Automation:**
   - Create a new automation in Airtable
   - Trigger: When record matches conditions
     - Condition: `map_image_url` is not empty
   - Action: Run a script (copy the script from the [Airtable Automation](#airtable-automation) section)
   - Remember to update the webhook secret in the script!

### 3. Supabase Configuration

1. **Create Users Table:**
   - Required columns:
     - `id`: UUID (primary key)
     - `email`: String
     - `first_name`: String
     - `last_name`: String
     - `receive_flash_reports`: Boolean
     - `preferences`: JSON (optional, for future use)

2. **Add Recipients:**
   - Add users who should receive flash reports
   - Set `receive_flash_reports` to true

## Testing & Troubleshooting

### Testing the Automation

1. **Test Airtable Script:**
   - In the Airtable automation editor, click "Run test"
   - Check the logs for success/failure messages

2. **Test Webhook Handler:**
   - Use Postman or similar to send a test webhook
   - Include the `x-airtable-webhook-signature` header with your secret
   - Check Netlify function logs for detailed error messages

3. **End-to-End Test:**
   - Add a map URL to an incident record
   - Wait for the automation to trigger
   - Check Netlify logs for all steps (webhook, caching, recipients, email)

### Common Issues

1. **Webhook Signature Failure:**
   - Verify the secret matches in both Airtable script and environment variable
   - Check for whitespace or encoding issues

2. **No Recipients Found:**
   - Verify users exist in Supabase with `receive_flash_reports: true`
   - Check Supabase connection settings

3. **Cache Issues:**
   - Use the `invalidateIncidentCache` function to clear problematic entries
   - Set `forceRefresh: true` when debugging

4. **Missing Environment Variables:**
   - Check Netlify environment configuration
   - Verify variables are correctly named and formatted
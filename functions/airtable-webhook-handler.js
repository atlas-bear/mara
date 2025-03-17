// airtable-webhook-handler.js
import { ensureIncidentCached } from './utils/incident-cache.js';
import { getFlashReportRecipients } from './utils/supabase.js';
import axios from 'axios';
import crypto from 'crypto';

/**
 * Handles Airtable webhook events for incident updates
 * 
 * This function is designed to:
 * 1. Receive notifications from Airtable when an incident record is updated
 * 2. Validate the webhook using a shared secret
 * 3. Extract the incident ID from the payload
 * 4. Ensure the incident is cached for quick access
 * 5. Optionally trigger a flash report if conditions are met
 * 
 * @param {Object} event - The Lambda/Netlify event object
 * @returns {Object} HTTP response
 */
export async function handler(event) {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  console.log('Received Airtable webhook event');
  
  try {
    // Validate webhook signature if configured
    const webhookSecret = process.env.AIRTABLE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = event.headers['x-airtable-webhook-signature'];
      if (!signature) {
        console.error('Missing webhook signature');
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorized - Missing signature' })
        };
      }
      
      // Verify the signature using HMAC
      try {
        const isValid = verifyWebhookSignature(event.body, signature, webhookSecret);
        if (!isValid) {
          console.error('Invalid webhook signature');
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized - Invalid signature' })
          };
        }
        console.log('Webhook signature verified successfully');
      } catch (error) {
        console.error('Error validating webhook signature:', error);
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorized - Signature validation error' })
        };
      }
    }

    // Parse the webhook payload
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (error) {
      console.error('Invalid webhook payload', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid payload format' })
      };
    }

    console.log('Webhook payload:', JSON.stringify(payload));
    
    // Extract incident ID from the payload
    // Note: This depends on the exact format of Airtable's webhook payload
    // and may need to be adjusted based on your webhook configuration
    const incidentId = extractIncidentId(payload);
    
    if (!incidentId) {
      console.error('Could not extract incident ID from webhook payload');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Could not determine incident ID' })
      };
    }
    
    // Determine if this is an update to an existing incident or a new incident
    // Extract last_flash_alert_sent_at and modified_at from payload
    const lastFlashAlertSentAt = payload.lastFlashAlertSentAt || null;
    const modifiedAt = payload.modifiedAt || null;
    
    // Consider it an update if we've sent an alert before
    const isUpdate = !!lastFlashAlertSentAt;
    
    if (isUpdate) {
      console.log(`Processing UPDATED incident ${incidentId}`);
      console.log(`Previous alert sent at: ${lastFlashAlertSentAt}`);
      console.log(`Last modified at: ${modifiedAt}`);
      
      // If the record hasn't been modified since last alert, we can stop
      if (lastFlashAlertSentAt && modifiedAt && new Date(lastFlashAlertSentAt) >= new Date(modifiedAt)) {
        console.log(`No significant changes since last alert, skipping update for incident ${incidentId}`);
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true,
            message: 'No significant changes since last alert, skipping update',
            incidentId
          })
        };
      }
    } else {
      console.log(`Processing NEW incident ${incidentId}`);
    }
    
    // Ensure the incident is cached
    const cacheResult = await ensureIncidentCached(incidentId, { forceRefresh: true });
    
    if (!cacheResult.success) {
      console.error(`Failed to cache incident ${incidentId}:`, cacheResult.error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed to process incident',
          details: cacheResult.error
        })
      };
    }
    
    console.log(`Successfully cached incident ${incidentId}`);
    
    // Check if incident has all required data for a flash report
    const incident = cacheResult.incidentData;
    const canSendFlashReport = 
      incident && 
      incident.map_image_url && 
      incident.incident_type && 
      incident.incident_type.length > 0;
    
    // If the incident has a map image URL and is ready for reporting,
    // optionally trigger a flash report
    if (canSendFlashReport && shouldSendFlashReport(incident, isUpdate)) {
      console.log(`Triggering flash report for incident ${incidentId} (${isUpdate ? 'UPDATE' : 'NEW'})`);
      await triggerFlashReport(incidentId, isUpdate);
    } else {
      console.log(`Not triggering flash report for incident ${incidentId} - conditions not met`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: `Processed webhook for incident ${incidentId}`,
        cached: true,
        reportTriggered: canSendFlashReport && shouldSendFlashReport(incident)
      })
    };
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}

/**
 * Verify the webhook signature using HMAC
 * 
 * @param {string} payload - The raw webhook payload body
 * @param {string} signature - The signature provided in the request header
 * @param {string} secret - The shared secret key
 * @returns {boolean} True if the signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
  // Create HMAC using the secret
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const computedSignature = hmac.digest('hex');
  
  // Use a constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch (error) {
    // If signatures are different lengths, timingSafeEqual throws an error
    console.error('Signature comparison error:', error.message);
    return false;
  }
}

/**
 * Extract the incident ID from the webhook payload
 * This is a placeholder that needs to be customized based on actual webhook format
 * 
 * @param {Object} payload - The webhook payload from Airtable
 * @returns {string|null} The incident ID or null if not found
 */
function extractIncidentId(payload) {
  // This is a placeholder implementation
  // The actual implementation depends on the structure of your Airtable webhook payload
  
  // Example: If payload contains a changes array with record information
  if (payload.changes && Array.isArray(payload.changes)) {
    for (const change of payload.changes) {
      // Look for changes to the "incident" table
      if (change.table && change.table.name === 'incident') {
        // Get the custom ID field from the changed record
        if (change.record && change.record.fields && change.record.fields.id) {
          return change.record.fields.id;
        }
      }
    }
  }
  
  return null;
}

/**
 * Determine if a flash report should be sent for this incident
 * 
 * @param {Object} incident - The incident data
 * @param {boolean} isUpdate - Whether this is an update to an existing incident
 * @returns {boolean} True if a flash report should be sent
 */
function shouldSendFlashReport(incident, isUpdate = false) {
  // Simplified approach: send flash reports for all incidents that have
  // the required data (map, incident type, etc.)
  
  // For new incidents, always send if they have the required data
  if (!isUpdate) {
    console.log('New incident with complete data - sending flash report');
    return true;
  }
  
  // For updates, you might want to be more selective to avoid alert fatigue
  // But still with a simple, maintainable approach
  if (isUpdate) {
    // Send updates for all incidents - the modified_at field already
    // ensures only meaningful updates trigger the webhook
    console.log('Updated incident with significant changes - sending flash report');
    return true;
  }
  
  return true; // Default to sending reports if all required data is present
}

/**
 * Trigger the send-flash-report function for an incident
 * 
 * @param {string} incidentId - The ID of the incident to report
 * @param {boolean} isUpdate - Whether this is an update to an existing incident
 * @returns {Promise<Object>} The response from the flash report function
 */
async function triggerFlashReport(incidentId, isUpdate = false) {
  try {
    // Netlify Functions can't directly call each other
    // We need to make an HTTP request to the send-flash-report endpoint
    
    // Ensure incident is cached and get its data
    const incidentResult = await ensureIncidentCached(incidentId);
    if (!incidentResult.success || !incidentResult.incidentData) {
      console.error(`Cannot trigger flash report - unable to get incident data for ${incidentId}`);
      return { success: false, error: 'Failed to get incident data' };
    }
    
    // Get recipients from Supabase based on incident data
    const recipients = await getRecipientsFromSupabase(incidentResult.incidentData);
    
    if (!recipients || recipients.length === 0) {
      console.log('No recipients found for flash report');
      return { success: false, error: 'No recipients found' };
    }
    
    console.log(`Sending ${isUpdate ? 'UPDATE' : 'NEW'} flash report for incident ${incidentId} to ${recipients.length} recipients`);
    
    // Call the send-flash-report function via HTTP
    const response = await axios.post(
      process.env.PUBLIC_URL + '/.netlify/functions/send-flash-report',
      {
        incidentId,
        recipients,
        // Include whether this is an update (affects email subject/content)
        isUpdate,
        // Any other parameters needed by send-flash-report
      },
      {
        headers: {
          // Include authorization if needed
          'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`
        }
      }
    );
    
    console.log(`Flash report triggered for incident ${incidentId}, status: ${response.status}`);
    return response.data;
    
  } catch (error) {
    console.error(`Error triggering flash report for incident ${incidentId}:`, error);
    throw error;
  }
}

/**
 * Fetch recipients from Supabase for an incident
 * Uses the incident data to potentially filter recipients based on region/incident type
 * 
 * @param {Object} incident - The incident data
 * @returns {Promise<Array>} Array of recipient objects formatted for send-flash-report
 */
async function getRecipientsFromSupabase(incident) {
  try {
    // Determine if we should filter recipients based on region/incident type
    const options = {};
    
    // If incident has a region, we can use it to filter recipients (future enhancement)
    if (incident.region) {
      options.regions = [incident.region];
      console.log(`Filtering recipients by region: ${incident.region}`);
    }
    
    // If incident has types, we can use them to filter recipients (future enhancement)
    if (incident.incident_type && incident.incident_type.length > 0) {
      options.incidentTypes = incident.incident_type;
      console.log(`Filtering recipients by incident types: ${incident.incident_type.join(', ')}`);
    }
    
    // Get recipients from Supabase
    const recipients = await getFlashReportRecipients(options);
    
    if (!recipients || recipients.length === 0) {
      console.log('No recipients found for flash report');
      return [];
    }
    
    console.log(`Found ${recipients.length} recipients for flash report`);
    
    // Log recipient count by domain for analytics (without exposing specific emails)
    const domainCounts = recipients.reduce((acc, recipient) => {
      const domain = recipient.email.split('@')[1]?.toLowerCase() || 'unknown';
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Recipient domain distribution:', Object.entries(domainCounts)
      .map(([domain, count]) => `${domain}: ${count}`)
      .join(', '));
    
    return recipients;
  } catch (error) {
    console.error('Error getting recipients from Supabase:', error);
    return [];
  }
}
/**
 * Test Flash Report Function
 * 
 * Test utility specifically for Flash Reports, allowing quick testing of the
 * Flash Report email functionality without needing to use the full UI.
 */

import { corsHeaders } from './utils/environment.js';

export const handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' }),
    };
  }
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }
  
  try {
    // Parse request
    const payload = JSON.parse(event.body);
    const { incidentId, recipientEmail, useDemoIncident } = payload;
    
    // Validate inputs
    if (!recipientEmail) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['recipientEmail']
        }),
      };
    }
    
    // Determine which incident ID to use
    const effectiveIncidentId = useDemoIncident ? '2024-2662' : (incidentId || '2024-2662');
    
    // Prepare recipient
    const recipient = {
      email: recipientEmail,
      isClient: recipientEmail.includes('client') || recipientEmail.includes('company')
    };
    
    // Forward to send-flash-report function
    const response = await fetch(new URL('/.netlify/functions/send-flash-report', context.invokeUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': context.invokeUrl,
      },
      body: JSON.stringify({
        incidentId: effectiveIncidentId,
        recipients: [recipient]
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Error from send-flash-report function',
          details: result
        })
      };
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Flash report test completed',
        ...result
      })
    };
  } catch (error) {
    console.error('Error testing flash report:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to test flash report',
        message: error.message
      })
    };
  }
};
import { corsHeaders, getEnv } from './utils/environment.js';
import { sendEmail } from './utils/email.js';

/**
 * Simple test endpoint to verify SendGrid email sending
 */
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
    const { to, subject, message } = payload;
    
    // Validate inputs
    if (!to || !subject || !message) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['to', 'subject', 'message']
        }),
      };
    }
    
    // Generate HTML email template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #234567;">MARA Test Email</h1>
        <p>This is a test email from the MARA system.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <strong>Message:</strong>
          <p>${message}</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is a test email sent from the MARA system. If you received this email by mistake, please ignore it.
        </p>
      </div>
    `;
    
    // Plain text fallback
    const text = `MARA Test Email\n\nThis is a test email from the MARA system.\n\nMessage: ${message}\n\nThis is a test email sent from the MARA system. If you received this email by mistake, please ignore it.`;
    
    // Check if SendGrid is available and send the email
    const result = await sendEmail(to, subject, text, html, {
      fromName: 'MARA Test Email',
      categories: ['test', 'email-test']
    });
    
    // If we're in demo mode, return a demo response
    if (result.demo) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'DEMO MODE: Email would be sent (no SendGrid API key provided)',
          details: {
            to,
            subject,
            messagePreview: message ? `${message.substring(0, 50)}...` : 'No content provided',
          }
        })
      };
    }
    
    // If successful, return success response
    if (result.success) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Test email sent successfully',
          to,
          subject,
          statusCode: result.statusCode || 202,
          headers: result.headers || {},
        }),
      };
    } else {
      // If failed, return error response
      return {
        statusCode: result.statusCode || 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Failed to send test email',
          message: result.message,
        }),
      };
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to send test email',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
  }
};
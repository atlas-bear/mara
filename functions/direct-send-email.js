/**
 * Direct email sending function for testing
 * This bypasses token generation and just sends an email immediately
 */
import sgMail from '@sendgrid/mail';
import { corsHeaders } from './utils/environment.js';

export const handler = async (event, context) => {
  // Basic CORS handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' }),
    };
  }
  
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
    console.log('Direct email test request:', JSON.stringify(payload));
    
    const { email, subject, message } = payload;
    
    if (!email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Email address is required' }),
      };
    }
    
    // Look for SendGrid API key
    const sendGridApiKey = process.env.SENDGRID_API_KEY || process.env.VITE_SENDGRID_API_KEY;
    const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.VITE_SENDGRID_FROM_EMAIL || 'alerts@example.com';
    
    console.log('SendGrid API Key found:', !!sendGridApiKey);
    console.log('SendGrid From Email:', sendGridFromEmail);
    
    if (!sendGridApiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'SendGrid API key not configured',
          environmentVars: Object.keys(process.env).filter(k => !k.includes('SECRET')).join(', ')
        }),
      };
    }
    
    // Configure SendGrid
    sgMail.setApiKey(sendGridApiKey);
    
    // Create test email
    const emailData = {
      to: email,
      from: sendGridFromEmail,
      subject: subject || 'MARA Test Email',
      text: message || 'This is a direct test email from MARA',
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #234567;">MARA Test Email</h1>
        <p>${message || 'This is a direct test email from MARA to verify email delivery is working.'}</p>
        <p>If you're receiving this email, it means your SendGrid integration is working correctly.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      </div>`
    };
    
    try {
      // Attempt to send email
      console.log(`Attempting to send direct test email to ${email}...`);
      await sgMail.send(emailData);
      console.log('Email sent successfully!');
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `Test email sent to ${email}`,
          details: {
            from: sendGridFromEmail,
            to: email,
            subject: emailData.subject,
            sentAt: new Date().toISOString()
          }
        })
      };
    } catch (sendError) {
      console.error('SendGrid error:', sendError);
      
      // Extract detailed error information
      let errorDetails = { message: sendError.message };
      if (sendError.response) {
        errorDetails.statusCode = sendError.code || sendError.response.statusCode;
        errorDetails.body = sendError.response.body;
      }
      
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Failed to send email',
          details: errorDetails
        })
      };
    }
  } catch (error) {
    console.error('Error in direct-send-email:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Server error',
        message: error.message
      })
    };
  }
};
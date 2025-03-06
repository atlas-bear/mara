/**
 * Simple test function to verify Netlify Functions are working
 * and test SendGrid email sending
 */
import sgMail from '@sendgrid/mail';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Log to Netlify function logs
  console.log('🧪 Test function called!');
  console.log('Event HTTP method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers));
  
  // If it's an OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Parse body if it exists
    let payload = {};
    if (event.body) {
      console.log('Request body:', event.body);
      payload = JSON.parse(event.body);
      console.log('Parsed payload:', JSON.stringify(payload));
    }

    // List all environment variables (without values)
    const envVars = Object.keys(process.env).filter(key => !key.includes('SECRET'));
    console.log('Available environment variables:', envVars.join(', '));
    
    // Try to send a test email if requested
    let emailResult = 'Email sending not attempted';
    if (payload.sendEmail && payload.recipients && payload.recipients.length > 0) {
      try {
        // Find SendGrid API key (with or without VITE_ prefix)
        const apiKey = process.env.SENDGRID_API_KEY || process.env.VITE_SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.VITE_SENDGRID_FROM_EMAIL || 'alerts@example.com';
        
        if (!apiKey) {
          console.warn('No SendGrid API key found');
          emailResult = 'Missing SendGrid API key';
        } else {
          console.log('Found SendGrid API key (length):', apiKey.length);
          console.log('From email:', fromEmail);
          
          // Configure SendGrid
          sgMail.setApiKey(apiKey);
          
          // Create email
          const recipient = payload.recipients[0].email;
          const msg = {
            to: recipient,
            from: fromEmail,
            subject: 'Test Email from MARA',
            text: 'This is a test email to verify SendGrid integration.',
            html: '<strong>This is a test email to verify SendGrid integration.</strong>',
          };
          
          console.log('Attempting to send test email to:', recipient);
          
          // Send email
          await sgMail.send(msg);
          console.log('Test email sent successfully!');
          emailResult = 'Test email sent successfully to ' + recipient;
        }
      } catch (emailError) {
        console.error('Error sending test email:', emailError);
        
        // Extract more details from SendGrid error
        if (emailError.response) {
          console.error('SendGrid API responded with:', {
            status: emailError.code || emailError.response.statusCode,
            body: emailError.response.body || 'No body'
          });
        }
        
        emailResult = 'Email sending failed: ' + emailError.message;
      }
    }

    // Return a success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Test function executed successfully!',
        timestamp: new Date().toISOString(),
        receivedData: payload,
        envVarsAvailable: envVars.length,
        emailResult: emailResult,
        sendGridApiKeyFound: !!(process.env.SENDGRID_API_KEY || process.env.VITE_SENDGRID_API_KEY),
        sendGridFromEmailFound: !!(process.env.SENDGRID_FROM_EMAIL || process.env.VITE_SENDGRID_FROM_EMAIL),
        dummyResults: [
          {
            email: payload.recipients?.[0]?.email || 'test@example.com',
            status: 'test-success',
            publicUrl: 'https://example.com/test-url'
          }
        ]
      })
    };
  } catch (error) {
    console.error('Error in test function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Error in test function',
        error: error.message
      })
    };
  }
};
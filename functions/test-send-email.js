/**
 * Simple test function to verify Netlify Functions are working
 */
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

    // Return a success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Test function executed successfully!',
        timestamp: new Date().toISOString(),
        receivedData: payload,
        envVarsAvailable: envVars.length,
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
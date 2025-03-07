/**
 * Environment variable diagnostic tool for Netlify Functions
 * This file helps check that all required environment variables are set correctly
 */
export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // If it's an OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Get all environment variables (without values for security)
    const allEnvVars = Object.keys(process.env)
      .filter(key => !key.includes('SECRET') && !key.includes('KEY'))
      .sort();
    
    // Check for required variables
    const requiredVars = [
      'MAPBOX_TOKEN',
      'SENDGRID_API_KEY',
      'SENDGRID_FROM_EMAIL',
      'AT_API_KEY',
      'AT_BASE_ID_CSER'
    ];
    
    // Optional variables
    const optionalVars = [
      'PUBLIC_URL',
      'SITE_URL',
      'CLIENT_LOGO',
      'DEFAULT_LOGO',
      'CLIENT_NAME',
      'DEFAULT_COMPANY_NAME',
      'CLIENT_DOMAINS',
      'CLIENT_PRIMARY_COLOR',
      'CLIENT_SECONDARY_COLOR',
      'DEFAULT_PRIMARY_COLOR',
      'DEFAULT_SECONDARY_COLOR'
    ];
    
    // Check which required variables are set
    const missingRequiredVars = requiredVars.filter(varName => !process.env[varName]);
    const presentRequiredVars = requiredVars.filter(varName => !!process.env[varName]);
    
    // Check which optional variables are set
    const presentOptionalVars = optionalVars.filter(varName => !!process.env[varName]);
    const missingOptionalVars = optionalVars.filter(varName => !process.env[varName]);
    
    // Verify Mapbox token format (should start with pk.)
    let mapboxTokenStatus = 'Not set';
    if (process.env.MAPBOX_TOKEN) {
      if (process.env.MAPBOX_TOKEN.startsWith('pk.')) {
        mapboxTokenStatus = 'Valid format (starts with pk.)';
      } else if (process.env.MAPBOX_TOKEN.startsWith('AIza')) {
        mapboxTokenStatus = 'INVALID: Appears to be a Google Maps API key (starts with AIza)';
      } else {
        mapboxTokenStatus = `INVALID: Unknown format (starts with ${process.env.MAPBOX_TOKEN.substring(0, 4)}...)`;
      }
    }
    
    // Verify SendGrid API key format
    let sendGridKeyStatus = 'Not set';
    if (process.env.SENDGRID_API_KEY) {
      if (process.env.SENDGRID_API_KEY.startsWith('SG.')) {
        sendGridKeyStatus = 'Valid format (starts with SG.)';
      } else {
        sendGridKeyStatus = `INVALID: Unknown format (starts with ${process.env.SENDGRID_API_KEY.substring(0, 4)}...)`;
      }
    }

    // Return diagnostic information
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Environment variable diagnostic check',
        timestamp: new Date().toISOString(),
        status: missingRequiredVars.length === 0 ? 'All required variables set' : 'Some required variables missing',
        environment: {
          nodeEnv: process.env.NODE_ENV || 'Not set',
          netlifyEnv: process.env.CONTEXT || 'Not set'
        },
        requiredVariables: {
          total: requiredVars.length,
          present: presentRequiredVars.length,
          missing: missingRequiredVars.length,
          presentList: presentRequiredVars,
          missingList: missingRequiredVars
        },
        optionalVariables: {
          total: optionalVars.length,
          present: presentOptionalVars.length,
          missing: missingOptionalVars.length,
          presentList: presentOptionalVars,
          missingList: missingOptionalVars
        },
        diagnostics: {
          mapboxToken: mapboxTokenStatus,
          sendGridKey: sendGridKeyStatus,
          allVariablesCount: allEnvVars.length,
          allVariablesList: allEnvVars
        }
      })
    };
  } catch (error) {
    console.error('Error in environment diagnostic:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Error in environment diagnostic function',
        error: error.message
      })
    };
  }
};
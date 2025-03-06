import { validateFlashReportToken } from './utils/token-utils.js';
import { corsHeaders } from './utils/environment.js';

/**
 * Netlify function to verify flash report access tokens
 */
export const handler = async (event, context) => {
  // Check for allowed request methods
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' }),
    };
  }
  
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get token and incident ID from query parameters
    const { token, incidentId } = event.queryStringParameters || {};
    
    // Validate required parameters
    if (!token || !incidentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          valid: false,
          error: 'Missing required parameters: token and incidentId'
        }),
      };
    }
    
    // Validate token
    const isValid = validateFlashReportToken(token, incidentId);
    
    if (isValid) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          valid: true,
          message: 'Token is valid'
        }),
      };
    } else {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          valid: false,
          error: 'Invalid or expired token'
        }),
      };
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        valid: false,
        error: 'Error verifying token',
        message: error.message
      }),
    };
  }
};
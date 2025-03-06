/**
 * Utility functions for generating and validating secure tokens
 * for public flash report access
 */

import crypto from 'crypto';

// Store the tokens in memory (for development)
// In production, these should be stored in a database with TTL
const tokenStore = new Map();

/**
 * Generate a secure token for accessing a flash report
 * @param {string} incidentId The incident ID to generate a token for
 * @param {number} expiryHours Number of hours until token expires (default: 168 = 7 days)
 * @returns {Object} Token object with value and expiry
 */
export function generateFlashReportToken(incidentId, expiryHours = 168) {
  // Generate a random token
  const tokenValue = crypto.randomBytes(32).toString('hex');
  
  // Calculate expiry time
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + expiryHours);
  
  // Store token with expiry (in production, use a database)
  const tokenData = {
    token: tokenValue,
    incidentId,
    expiry: expiryDate,
    created: new Date()
  };
  
  // Store by token value for validation lookup
  tokenStore.set(tokenValue, tokenData);
  
  return {
    token: tokenValue,
    expiry: expiryDate
  };
}

/**
 * Validate a flash report access token
 * @param {string} token The token to validate
 * @param {string} incidentId The incident ID the token should be for
 * @returns {boolean} Whether the token is valid
 */
export function validateFlashReportToken(token, incidentId) {
  // Look up token
  const tokenData = tokenStore.get(token);
  
  // Token not found
  if (!tokenData) {
    return false;
  }
  
  // Check if token is for the correct incident
  if (tokenData.incidentId !== incidentId) {
    return false;
  }
  
  // Check if token has expired
  if (new Date() > tokenData.expiry) {
    // Clean up expired token
    tokenStore.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Get the public URL for a flash report
 * @param {string} incidentId The incident ID
 * @param {string} token The access token
 * @param {string} brand Optional branding parameter
 * @returns {string} The public URL
 */
export function getPublicFlashReportUrl(incidentId, token, brand = null) {
  // Get base URL from environment variable or use default
  const baseUrl = process.env.PUBLIC_URL || 'https://mara.example.com';
  
  // Construct URL with path and parameters
  let url = `${baseUrl}/public/flash-report/${incidentId}/${token}`;
  
  // Add branding parameter if provided
  if (brand) {
    url += `?brand=${brand}`;
  }
  
  return url;
}
/**
 * Get an environment variable, with an optional default value
 * @param {string} name Name of the environment variable
 * @param {string} defaultValue Default value to return if not found
 * @returns {string} Value of the environment variable or default value
 */
export const getEnv = (name, defaultValue = null) => {
  return process.env[name] || defaultValue;
};

/**
 * Verify that all required environment variables are present
 * @param {string[]} requiredVars Array of required variable names
 * @throws {Error} If any variables are missing
 */
export const verifyEnvironmentVariables = (requiredVars) => {
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
  }
};

// CORS headers for API responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

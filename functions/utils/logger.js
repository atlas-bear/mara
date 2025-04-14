import axios from "axios";

// --- Logflare Configuration ---
// Read configuration strictly from environment variables set in Netlify
const logflareSourceId = process.env.LOGFLARE_SOURCE_ID;
const logflareApiKey = process.env.LOGFLARE_API_KEY;
const isLogflareConfigured = logflareSourceId && logflareApiKey;
const logflareUrl = isLogflareConfigured
  ? `https://api.logflare.app/logs?source=${logflareSourceId}`
  : null;

// Helper function to send logs to Logflare
const sendToLogflare = (level, message, metadata) => {
  if (!isLogflareConfigured) {
    // Optionally log a warning to console once if not configured, but avoid spamming
    // console.warn('Logflare environment variables not fully configured. Skipping external log.');
    return; // Silently skip if not configured
  }

  // Structure the payload according to Logflare's "Custom API Request" format
  const logEntry = {
    event_message: message, // Use 'event_message' as per Logflare example
    metadata: {
      level: level,
      function_name: process.env.AWS_LAMBDA_FUNCTION_NAME || "unknown", // Netlify provides this
      timestamp: new Date().toISOString(),
      ...metadata, // Spread the original metadata here
    },
  };

  // Logflare API expects an array of log entries, even if sending just one
  axios
    .post(logflareUrl, [logEntry], {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": logflareApiKey,
      },
      // Optional: Add a timeout to prevent hanging the function
      // timeout: 3000, // 3 seconds
    })
    .catch((error) => {
      // Log failure to send log to console, but don't crash the main function
      // Avoid logging the full error object here to prevent potential sensitive data leakage if the error response contains it
      console.error(
        "Logflare send error:",
        error.message || "Unknown error sending log"
      );
      if (error.response) {
        console.error("Logflare error response status:", error.response.status);
      }
    });
};

// --- Modified Logger ---
export const log = {
  info: (msg, data = {}) => {
    // Keep original console logging format
    console.log(JSON.stringify({ level: "info", msg, ...data }));
    // Send to Logflare
    sendToLogflare("info", msg, data);
  },

  error: (msg, error, data = {}) => {
    // Prepare data for console logging
    const consoleData = {
      level: "error",
      msg,
      ...(error instanceof Error && {
        error: error.message,
        stack: error.stack,
      }),
      ...data,
    };
    console.error(JSON.stringify(consoleData));

    // Prepare data for Logflare (ensure error details are included)
    const logflareMetadata = {
      ...data,
      ...(error instanceof Error && {
        error_message: error.message,
        error_stack: error.stack,
      }),
    };
    // Use the original message string for event_message, or a default if msg isn't a string
    const errorMessage = typeof msg === "string" ? msg : "Error occurred";
    sendToLogflare("error", errorMessage, logflareMetadata);
  },

  // Add other levels like warn if needed
  warn: (msg, data = {}) => {
    console.warn(JSON.stringify({ level: "warn", msg, ...data }));
    sendToLogflare("warn", msg, data);
  },
};

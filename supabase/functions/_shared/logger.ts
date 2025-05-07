// Basic logger utility for Supabase Edge Functions

// Define log levels (optional, could be expanded)
enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG", // Consider adding a DEBUG level controlled by env var
}

function formatLog(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  let logEntry = `${timestamp} [${level}] ${message}`;
  if (data !== undefined) {
    try {
      // Attempt to stringify structured data
      logEntry += ` | Data: ${JSON.stringify(data, null, 2)}`;
    } catch (err) {
      // Fallback for circular references or other stringify errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      logEntry += ` | Data: [Could not stringify data - ${errorMessage}]`;
    }
  }
  return logEntry;
}

export const log = {
  info: (message: string, data?: unknown) => {
    console.info(formatLog(LogLevel.INFO, message, data));
  },
  warn: (message: string, data?: unknown) => {
    console.warn(formatLog(LogLevel.WARN, message, data));
  },
  error: (message: string, data?: unknown) => {
    // Log error message and potentially stringified data
    console.error(formatLog(LogLevel.ERROR, message, data));

    // Also log the raw error object if it's an Error instance for stack trace
    if (data instanceof Error) {
        console.error("Raw Error Object:", data);
    }
  },
  // Add debug logging if needed, potentially gated by an environment variable
  // debug: (message: string, data?: unknown) => {
  //   if (Deno.env.get('LOG_LEVEL') === 'DEBUG') {
  //      console.debug(formatLog(LogLevel.DEBUG, message, data));
  //   }
  // }
};

log.info("Logger initialized.");

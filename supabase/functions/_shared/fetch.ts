/// <reference types="https://esm.sh/v135/@types/deno@1.40.0/index.d.ts" />

import { log } from './logger.ts';

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

// Check for Bright Data proxy environment variables
const proxyUser = Deno.env.get('BRD_USER');
const proxyPassword = Deno.env.get('BRD_PASSWORD');
const proxyHost = Deno.env.get('BRD_HOST');
const proxyPort = Deno.env.get('BRD_PORT');
const useProxy = !!(proxyUser && proxyPassword && proxyHost && proxyPort);

if (useProxy) {
    log.info('Bright Data proxy environment variables found. Fetch will attempt to use HTTPS_PROXY.');
    // Note: Deno's fetch primarily relies on the HTTPS_PROXY environment variable.
    // Ensure HTTPS_PROXY is set in the Supabase Function environment like:
    // HTTPS_PROXY=http://BRD_USER:BRD_PASSWORD@BRD_HOST:BRD_PORT
} else {
    log.warn('Bright Data proxy environment variables not fully set. Fetching directly.');
}

/**
 * Fetches a URL with retry logic, exponential backoff, timeout, and proxy support (via HTTPS_PROXY env var).
 * @param url The URL to fetch.
 * @param options Fetch options including method, headers, body, retries, delay, timeout.
 * @returns The fetch Response object.
 */
export async function fetchWithRetry(
  url: string | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    method = 'GET',
    headers = {},
    body = null,
    maxRetries = 3,
    retryDelayMs = 1000,
    timeoutMs = 10000, // Default 10 second timeout
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      log.info(`Fetch attempt ${attempt}/${maxRetries}`, { method, url: url.toString() });

      const response = await fetch(url, {
        method: method,
        headers: {
          'User-Agent': 'MARA-Collector/1.0 (Deno)', // Identify the client
          ...headers,
        },
        body: body,
        signal: controller.signal, // Link abort controller for timeout
      });

      clearTimeout(timeoutId); // Clear timeout if fetch completes

      // Check if the response status is OK (2xx)
      // You might want to customize this check based on expected non-2xx success codes
      if (!response.ok) {
          const errorBody = await response.text().catch(() => '[Could not read error body]');
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText} | Body: ${errorBody.substring(0, 200)}`);
      }

      log.info(`Fetch successful`, { status: response.status, url: url.toString() });
      return response; // Success

    } catch (err) {
      clearTimeout(timeoutId); // Clear timeout if fetch fails
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      log.warn(`Fetch attempt ${attempt} failed`, { url: url.toString(), error: error.message });

      if (attempt === maxRetries) {
        log.error(`Fetch failed after ${maxRetries} attempts`, { url: url.toString(), finalError: error.message });
        break; // Exit loop after max retries
      }

      // Don't retry on client errors (4xx) unless specifically needed
      if (error.message.includes('status: 4')) {
          log.error('Client error (4xx), not retrying.', { url: url.toString() });
          break;
      }

      const delay = retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
      log.info(`Retrying fetch in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If loop finishes without success, throw the last encountered error
  throw lastError ?? new Error('Fetch failed after multiple retries, but no specific error was captured.');
}

// Example of fetching HTML content (similar to original utility)
export async function fetchHtmlContent(url: string, headers: Record<string, string> = {}): Promise<string> {
    log.info(`Fetching HTML content from: ${url}`);
    const response = await fetchWithRetry(url, { method: 'GET', headers });
    const html = await response.text();
    log.info("HTML content fetched successfully", { url, length: html.length });
    return html;
}

import axios from "axios";
import https from "https";

// Common proxy configuration builder
export function buildProxyConfig(additionalHeaders = {}) {
  const proxyConfig = {
    proxy: {
      host: process.env.BRD_HOST,
      port: process.env.BRD_PORT,
      auth: {
        username: process.env.BRD_USER,
        password: process.env.BRD_PASSWORD,
      },
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    }),
    timeout: 10000,
    headers: {
      Accept: "application/json",
      "User-Agent": "MARA-Collector/1.0",
      ...additionalHeaders,
    },
  };

  return proxyConfig;
}

export async function fetchWithRetry(url, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    headers = {},
    timeout = 10000,
  } = options;

  const proxyConfig = buildProxyConfig(headers);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: "get",
        url,
        ...proxyConfig,
        timeout,
        validateStatus: false,
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`, {
        error: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export const fetchHtmlContent = async (url, additionalHeaders = {}, log) => {
  try {
    log.info(`Fetching content from: ${url}`);
    const proxyConfig = buildProxyConfig(additionalHeaders);
    const response = await axios.get(url, proxyConfig);
    log.info("Content fetched successfully", { length: response.data.length });
    return response.data;
  } catch (error) {
    log.error("Failed to fetch content", error);
    throw error;
  }
};

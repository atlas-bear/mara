import axios from "axios";
import https from "https";

const PROXY_CONFIG = {
  host: process.env.BRD_HOST,
  port: process.env.BRD_PORT,
  auth: {
    username: process.env.BRD_USER,
    password: process.env.BRD_PASSWORD,
  },
};

export const fetchWithTimeout = async (url, options = {}) => {
  const timeout = options.timeout || 10000; // Default timeout of 10 seconds
  const useProxy = process.env.USE_PROXY === "true"; // Enable or disable proxy via environment variable

  try {
    const agent = new https.Agent({
      keepAlive: true,
      rejectUnauthorized: useProxy ? false : true, // Skip SSL validation for proxy due to issues
    });

    const response = await axios.get(url, {
      timeout,
      httpsAgent: agent,
      proxy: useProxy ? PROXY_CONFIG : undefined, // Use proxy only if enabled
    });
    return response;
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
};

export const fetchHtmlContent = async (url, proxyConfig, log) => {
  try {
    log.info(`Fetching content from: ${url}`);
    const response = await axios.get(url, proxyConfig);
    log.info("Content fetched successfully", { length: response.data.length });
    return response.data;
  } catch (error) {
    log.error("Failed to fetch content", error);
    throw error;
  }
};

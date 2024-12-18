import axios from "axios";
import https from "https";

export const fetchWithTimeout = async (url, options = {}) => {
  const timeout = options.timeout || 10000; // Default timeout of 10 seconds

  try {
    const agent = new https.Agent({ keepAlive: true });
    const response = await axios.get(url, {
      timeout,
      httpsAgent: agent,
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

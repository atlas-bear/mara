import axios from "axios";
import https from "https";

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

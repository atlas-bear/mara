import axios from "axios";

/**
 * Check if a PDF exists for a report
 * @param {string} reportId - The report ID (e.g., "2025-06")
 * @param {string} endpoint - The API endpoint
 * @returns {Promise<{exists: boolean, url: string|null}>}
 */
export const checkPdfExists = async (
  reportId,
  endpoint = "/api/get-pdf-url"
) => {
  try {
    const response = await axios.get(`${endpoint}/${reportId}`);
    return {
      exists: response.data.exists,
      url: response.data.url || null,
    };
  } catch (error) {
    return { exists: false, url: null };
  }
};

/**
 * Generate a PDF for a report
 * @param {string} reportId - The report ID (e.g., "2025-06")
 * @param {string} endpoint - The API endpoint
 * @returns {Promise<{success: boolean, pdfUrl: string|null}>}
 */
export const generatePdf = async (reportId, endpoint = "/api/generate-pdf") => {
  try {
    const response = await axios.post(endpoint, { reportId });
    return {
      success: response.data.success || false,
      pdfUrl: response.data.pdfUrl || null,
    };
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to generate PDF");
  }
};

/**
 * Clear cached PDF URLs
 * @param {string|null} reportId - Optional specific report ID to clear
 * @returns {number} - Number of items cleared
 */
export const clearPdfUrlCache = (reportId = null) => {
  if (reportId) {
    localStorage.removeItem(`pdf-url-${reportId}`);
    return 1;
  }

  let count = 0;
  const keysToRemove = [];

  // Find all pdf-url items
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("pdf-url-")) {
      keysToRemove.push(key);
    }
  }

  // Remove them
  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    count++;
  });

  return count;
};

const cloudinary = require("cloudinary").v2;

// Initialize Cloudinary with environment variables
const initCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - The file buffer to upload
 * @param {Object} options - Upload options
 * @returns {Promise} - Resolves to Cloudinary upload response
 */
const uploadBuffer = async (buffer, options = {}) => {
  const cl = initCloudinary();

  const defaultOptions = {
    folder: "mara-reports",
    resource_type: "raw",
    type: "upload",
  };

  const uploadOptions = { ...defaultOptions, ...options };

  return new Promise((resolve, reject) => {
    cl.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      })
      .end(buffer);
  });
};

/**
 * Check if a file exists in Cloudinary
 * @param {string} publicId - The public ID to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
const resourceExists = async (publicId) => {
  const cl = initCloudinary();

  try {
    await cl.api.resource(publicId, { resource_type: "raw" });
    return true;
  } catch (error) {
    if (error.error && error.error.http_code === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * Construct the full Cloudinary URL for a report PDF
 * @param {string} reportId - The report ID (e.g., "2025-06")
 * @returns {string} - The full Cloudinary URL
 */
const getReportPdfUrl = (reportId) => {
  const cl = initCloudinary();
  const publicId = `mara-reports/report-${reportId}`;

  return cl.url(publicId, {
    resource_type: "raw",
    format: "pdf",
  });
};

// Use module.exports for CommonJS exports
module.exports = {
  initCloudinary,
  uploadBuffer,
  resourceExists,
  getReportPdfUrl,
};

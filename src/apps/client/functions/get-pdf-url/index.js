import { getReportPdfUrl, resourceExists } from "../utils/cloudinary.js";

export const handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Get report ID from path parameter
    const pathParts = event.path.split("/");
    const reportId = pathParts[pathParts.length - 1];

    if (!reportId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Report ID is required" }),
      };
    }

    // Check if PDF exists in Cloudinary
    const publicId = `mara-reports/report-${reportId}`;
    const exists = await resourceExists(publicId);

    if (exists) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          exists: true,
          url: getReportPdfUrl(reportId),
        }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          exists: false,
          message: `PDF for report ${reportId} not found`,
        }),
      };
    }
  } catch (error) {
    console.error("Error checking PDF URL:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to check PDF URL",
        message: error.message,
      }),
    };
  }
};

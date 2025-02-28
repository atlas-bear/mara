import { generateReportPdf } from "../utils/pdf-generator.js";

export const handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse request body
    const { reportId } = JSON.parse(event.body);

    if (!reportId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Report ID is required" }),
      };
    }

    // Get the site URL from environment or headers
    const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

    // Generate the PDF
    const { pdfUrl, isNew } = await generateReportPdf(reportId, siteUrl);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        pdfUrl,
        isNew,
      }),
    };
  } catch (error) {
    console.error("PDF generation error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to generate PDF",
        message: error.message,
      }),
    };
  }
};

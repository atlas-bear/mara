const pdfGenerator = require("../utils/pdf-generator");

module.exports.handler = async (event, context) => {
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
    // Use the complete original URL if available to handle custom domains
    const referer = event.headers.referer;
    const originUrl = event.headers.origin;
    let siteUrl;
    
    if (referer) {
      // Extract base URL from referer
      const url = new URL(referer);
      siteUrl = `${url.protocol}//${url.host}`;
    } else if (originUrl) {
      siteUrl = originUrl;
    } else {
      siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;
    }
    
    console.log(`Using site URL: ${siteUrl} for PDF generation`);

    // Generate the PDF
    const { pdfUrl, isNew } = await pdfGenerator.generateReportPdf(
      reportId,
      siteUrl
    );

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

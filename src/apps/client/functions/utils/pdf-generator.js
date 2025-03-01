const chromium = require("chrome-aws-lambda");
const cloudinaryUtils = require("./cloudinary");

/**
 * Generate a PDF for a specific report
 * @param {string} reportId - The report ID (e.g., "2025-06")
 * @param {string} baseUrl - The base URL of the site
 * @returns {Promise<Object>} - Object containing the PDF URL
 */
async function generateReportPdf(reportId, baseUrl) {
  let browser = null;

  try {
    console.log("Initializing Chrome for PDF generation");

    // Check if PDF already exists in Cloudinary
    const publicId = `mara-reports/report-${reportId}`;
    const exists = await cloudinaryUtils.resourceExists(publicId);

    if (exists) {
      console.log(`PDF for report ${reportId} already exists`);
      return {
        pdfUrl: cloudinaryUtils.getReportPdfUrl(reportId),
        isNew: false,
      };
    }

    // Configure Chrome options for Netlify Functions environment
    const executablePath = process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath;
    
    // Launch headless browser with minimal arguments for Netlify Functions
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    // Create new page and navigate to report URL with print flag
    const page = await browser.newPage();
    const reportUrl = `${baseUrl}/${reportId}?print=true`;

    console.log(`Navigating to ${reportUrl}`);

    await page.goto(reportUrl, {
      waitUntil: "networkidle0",
      timeout: 30000, // 30 second timeout for loading
    });

    // Add a small delay to ensure all charts render properly
    await page.waitForTimeout(2000);

    // Generate PDF buffer with appropriate settings
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size: 8px; text-align: right; width: 100%; padding: 5px 20px;">MARA Maritime Security Report ${reportId}</div>`,
      footerTemplate: `<div style="font-size: 8px; text-align: center; width: 100%; padding: 5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    });

    // Upload PDF to Cloudinary
    const uploadResult = await cloudinaryUtils.uploadBuffer(pdfBuffer, {
      public_id: `report-${reportId}`,
      filename: `weekly-report-${reportId}.pdf`,
    });

    return {
      pdfUrl: uploadResult.secure_url,
      isNew: true,
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  } finally {
    if (browser !== null) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
  }
}

// Use module.exports for CommonJS exports
module.exports = {
  generateReportPdf,
};

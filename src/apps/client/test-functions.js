const {
  handler: generatePdfHandler,
} = require("./functions/generate-pdf/index");
const { handler: getPdfUrlHandler } = require("./functions/get-pdf-url/index");

async function testGeneratePdf() {
  try {
    const event = {
      httpMethod: "POST",
      body: JSON.stringify({ reportId: "2025-06" }),
    };

    const response = await generatePdfHandler(event);
    console.log("Generate PDF response:", response);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testGeneratePdf();

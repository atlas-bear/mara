const {
  handler: generatePdfHandler,
} = require("./functions/generate-pdf/index");
const { handler: getPdfUrlHandler } = require("./functions/get-pdf-url/index");

async function testGeneratePdf() {
  try {
    const event = {
      httpMethod: "POST",
      headers: {
        host: "localhost:3000"
      },
      body: JSON.stringify({ reportId: "2025-06" }),
    };

    const response = await generatePdfHandler(event);
    console.log("Generate PDF response:", response);
  } catch (error) {
    console.error("Test failed:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
}

async function testGetPdfUrl() {
  try {
    const event = {
      httpMethod: "GET",
      path: "/api/get-pdf-url/2025-06",
    };

    const response = await getPdfUrlHandler(event);
    console.log("Get PDF URL response:", response);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run tests
async function runTests() {
  console.log("=== Testing PDF URL endpoint ===");
  await testGetPdfUrl();
  console.log("\n=== Testing PDF generation endpoint ===");
  await testGeneratePdf();
}

runTests().catch(console.error);

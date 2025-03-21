# PDF Download Button Component

## Overview

This component provides PDF generation and download functionality for the weekly reports. It has been simplified to use only browser-based PDF generation using html2canvas and jsPDF, which has proven more reliable than the server-side approach.

## Functionality

The component generates PDFs directly in the browser using html2canvas and jsPDF:
- Captures the page content as a high-quality image
- Adds a header with the report ID and optional client logo
- Converts to PDF format and offers it as a download

## Architecture Notes

- The browser-based generation works by:
  - Taking a screenshot of the page content using html2canvas
  - Adding a header with the report ID and optional logo
  - Converting to PDF format using jsPDF
  - Offering it as a download

- Server-side PDF generation functionality has been removed from the main app but still exists in the client app:
  - `src/apps/client/functions/generate-pdf/`
  - `src/apps/client/functions/utils/pdf-generator.js`
  - The client app's implementation uses Puppeteer (chrome-aws-lambda) and Cloudinary storage

- We chose browser-based generation because:
  1. It works reliably across all environments
  2. It eliminates the dependency on serverless functions
  3. It avoids the complexity of maintaining Puppeteer in serverless environments
  4. It removes the need for Cloudinary API integration

## Future Improvements

If needed, consider:

1. Extracting the PDF generation logic into a separate utility for reuse
2. Adding options to customize PDF output (paper size, orientation, margins)
3. Improving styling for better print output
4. Adding progress indicators for large reports

## Dependencies

- html2canvas: For capturing DOM content as canvas
- jsPDF: For converting canvas to PDF
- React: For component lifecycle and state management
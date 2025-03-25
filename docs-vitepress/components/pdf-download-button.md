# PDF Download Button Component

## Overview

The PDF Download Button component provides PDF generation and download functionality for reports in the MARA system. It has been simplified to use only browser-based PDF generation using html2canvas and jsPDF, which has proven more reliable than the server-side approach.

## Functionality

The component generates PDFs directly in the browser using html2canvas and jsPDF:
- Captures the page content as a high-quality image
- Adds a header with the report ID and optional client logo
- Converts to PDF format and offers it as a download

## Implementation Details

### Component Location

The component is located at `/src/shared/components/PDFDownloadButton/index.jsx` and is used across different applications for generating downloadable PDF reports.

### Technical Approach

The browser-based generation works by:
1. Taking a screenshot of the page content using html2canvas
2. Adding a header with the report ID and optional logo
3. Converting to PDF format using jsPDF
4. Offering it as a download

### Architecture Decision

Server-side PDF generation functionality has been removed from the main app in favor of the browser-based approach because:

1. It works reliably across all environments
2. It eliminates the dependency on serverless functions
3. It avoids the complexity of maintaining Puppeteer in serverless environments
4. It removes the need for Cloudinary API integration

## Usage

To use the PDF Download Button in a component:

```jsx
import PDFDownloadButton from '@mara/shared/components/PDFDownloadButton';

function ReportPage() {
  return (
    <div>
      <div id="report-content">
        {/* Report content goes here */}
      </div>
      <PDFDownloadButton 
        contentId="report-content"
        fileName="Weekly-Report-2023-10"
        reportId="WR-2023-10"
      />
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| contentId | string | ID of the DOM element to capture as PDF |
| fileName | string | Name of the downloaded file (without .pdf extension) |
| reportId | string | ID to display in the PDF header |
| logo | string | Optional URL to client logo for the PDF header |

## Dependencies

- html2canvas: For capturing DOM content as canvas
- jsPDF: For converting canvas to PDF
- React: For component lifecycle and state management

## Future Improvements

If needed, consider:

1. Extracting the PDF generation logic into a separate utility for reuse
2. Adding options to customize PDF output (paper size, orientation, margins)
3. Improving styling for better print output
4. Adding progress indicators for large reports
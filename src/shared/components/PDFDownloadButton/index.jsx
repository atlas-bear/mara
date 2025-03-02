import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import axios from 'axios';

const PDFDownloadButton = ({ 
  className = "",
  customReportId = null, // Allow overriding the reportId from URL params
  apiEndpoint = '/.netlify/functions/get-pdf-url',
  generateEndpoint = '/.netlify/functions/generate-pdf',
  variant = 'primary',
  label = 'Download PDF'
}) => {
  // Either use the provided reportId or get it from URL params
  const { yearWeek, "*": wildcardParam } = useParams();
  // Try to get reportId from different possible URL patterns
  const reportId = customReportId || yearWeek || wildcardParam || 
  // Extract from pathname as fallback
    window.location.pathname.split('/').filter(segment => segment).pop();
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Default styles based on variant
  const getButtonStyles = () => {
    const baseStyles = "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md";
    
    const variantStyles = {
      primary: "border border-gray-300 shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50",
      secondary: "text-gray-700 hover:bg-gray-100 disabled:opacity-50",
      minimal: "text-gray-600 hover:text-gray-900 disabled:opacity-50"
    };
    
    return `${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${className}`;
  };

  // Check if we have a PDF URL when the report ID changes
  useEffect(() => {
    if (!reportId) return;
    
    const checkPdfUrl = async () => {
      try {
        // Clear previous state
        setPdfUrl(null);
        setError(null);
        
        // Check local storage first for quick loading
        const cachedUrl = localStorage.getItem(`pdf-url-${reportId}`);
        if (cachedUrl) {
          setPdfUrl(cachedUrl);
          return;
        }
        
        // Otherwise check if the PDF exists on Cloudinary
        const response = await axios.get(`${apiEndpoint}/${reportId}`);
        
        if (response.data.exists && response.data.url) {
          setPdfUrl(response.data.url);
          localStorage.setItem(`pdf-url-${reportId}`, response.data.url);
        }
      } catch (error) {
        console.log('PDF not yet available, will generate on demand');
        // We don't set an error here as this is an expected case
      }
    };
    
    checkPdfUrl();
  }, [reportId, apiEndpoint]);
  
  const generatePdfInBrowser = async () => {
    try {
      console.log('Starting single-page PDF generation...');
      
      // First try using html2canvas + jsPDF approach for continuous page
      const contentElement = document.querySelector('.content-container') || document.body;
      
      // Create a loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.style.position = 'fixed';
      loadingIndicator.style.top = '50%';
      loadingIndicator.style.left = '50%';
      loadingIndicator.style.transform = 'translate(-50%, -50%)';
      loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      loadingIndicator.style.color = 'white';
      loadingIndicator.style.padding = '20px';
      loadingIndicator.style.borderRadius = '5px';
      loadingIndicator.style.zIndex = '99999';
      loadingIndicator.textContent = 'Generating PDF (this may take a moment)...';
      document.body.appendChild(loadingIndicator);
      
      // Using html2canvas directly to avoid page breaks
      try {
        // Import libraries if needed
        const html2canvas = window.html2canvas || await import('html2canvas').then(m => m.default);
        const jsPDF = window.jspdf?.jsPDF || await import('jspdf').then(m => m.default);
        
        // We'll only modify the cloned document, not the actual DOM
        // This way we don't affect what's shown on screen
        
        // Create a screenshot of the entire content with improved settings
        const canvas = await html2canvas(contentElement, {
          scale: 2, // Higher quality
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff', // Ensure white background
          scrollX: 0,
          scrollY: 0,
          windowWidth: document.documentElement.offsetWidth,
          windowHeight: document.documentElement.offsetHeight,
          onclone: function(clonedDoc) {
            // Hide elements only in the cloned document that's used for PDF generation
            // This doesn't affect the actual webpage DOM
            
            // Hide the title in the cloned document
            const titleElements = clonedDoc.querySelectorAll('.pdf-cover, .content-container > div:first-child > h1');
            titleElements.forEach(el => {
              if (el) el.style.display = 'none';
            });
            
            // Hide other elements we don't want in the PDF
            const elementsToHide = clonedDoc.querySelectorAll('nav, button, .no-print, footer, .pdf-download-container');
            elementsToHide.forEach(el => {
              if (el) el.style.display = 'none';
            });
            
            // Apply additional styles
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              .executive-brief h1 { font-size: 18pt; }
              body { background: white !important; }
            `;
            clonedDoc.head.appendChild(style);
          }
        });

        // Calculate the PDF dimensions (A4 = 210 x 297 mm)
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        
        // Create PDF of the right size to fit content plus space for logo
        const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight + 20]); // Add 20mm for header
        
        // Try to find client logo in the DOM
        const logoElement = document.querySelector('.client-logo img, header img, .logo img, nav img');
        let logoUrl = null;
        
        // Add header to PDF
        try {
          // If we have a logo, add it
          if (logoElement && logoElement.src) {
            // Get logo URL
            logoUrl = logoElement.src;
            console.log('Found client logo:', logoUrl);
            
            // Create a temporary image to get dimensions
            const logoImg = new Image();
            logoImg.crossOrigin = 'Anonymous';
            
            // Wait for logo to load
            await new Promise((resolve, reject) => {
              logoImg.onload = resolve;
              logoImg.onerror = reject;
              logoImg.src = logoUrl;
            });
            
            // Calculate logo dimensions for PDF - max height 10mm
            const logoMaxHeight = 10; // mm
            const logoRatio = logoImg.width / logoImg.height;
            const logoHeight = Math.min(logoMaxHeight, 20); // mm, prevent oversized logos
            const logoWidth = logoHeight * logoRatio;
            
            // Add logo to the top-left of PDF
            pdf.addImage(
              logoImg, 
              'PNG', 
              10, // x position (10mm from left)
              5,  // y position (5mm from top)
              logoWidth, 
              logoHeight
            );
          }
          
          // Add report title (centered or offset right if logo exists)
          pdf.setFontSize(14);
          pdf.setTextColor(60, 60, 60);
          pdf.text('Weekly Maritime Security Report', imgWidth / 2, 10, { align: 'center' });
          
          // Add report ID
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Report ID: ${reportId}`, imgWidth / 2, 15, { align: 'center' });
          
          // Add horizontal line under header area
          pdf.setDrawColor(200, 200, 200); // light gray
          pdf.setLineWidth(0.2);
          pdf.line(10, 17, imgWidth - 10, 17);
          
        } catch (headerError) {
          console.error('Error adding header to PDF:', headerError);
          // Continue without header if there's an error
        }
        
        // Add the main content image to the PDF
        pdf.addImage(
          imgData, 
          'JPEG', 
          0, // x position
          20, // y position - leave space for logo and header
          imgWidth, 
          imgHeight
        );
        
        // Save the PDF with white-labeled filename
        pdf.save(`weekly-security-report-${reportId}.pdf`);
        
        // Remove loading indicator
        document.body.removeChild(loadingIndicator);
        return 'pdf-generated';
      } catch (html2canvasError) {
        console.error('First method failed, trying backup method:', html2canvasError);
        // Continue to backup method
      }
      
      // Backup method: Open in new window with print styles that disable pagination
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        console.error('Popup blocker may be preventing opening the print window');
        document.body.removeChild(loadingIndicator);
        alert('Please allow pop-ups for this site to generate the PDF');
        return null;
      }
      
      // Create a continuous single page version
      const printDoc = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Weekly Security Report ${reportId}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          
          <!-- Copy all stylesheets from current page -->
          ${Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(link => link.outerHTML)
            .join('')}
          
          <style>
            /* Force size to be continuous with no pagination */
            @page {
              size: auto;
              margin: 0mm;
            }
            
            html, body {
              margin: 0;
              padding: 0;
              background: white !important;
              color: black !important;
              font-family: Arial, sans-serif;
              width: 100%;
              max-width: 100%;
            }
            
            /* Remove all page breaks */
            * {
              page-break-inside: auto !important;
              page-break-before: auto !important;
              page-break-after: auto !important;
            }
            
            /* Hide navigation, buttons, and other UI */
            nav, button, .no-print, header, footer, .navbar, .pdf-download-container {
              display: none !important;
            }
            
            /* Main content styling */
            .print-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            
            /* Fix chart and map rendering */
            .mapboxgl-map {
              height: 400px !important;
              width: 100% !important;
            }
            
            /* Ensure all widths are appropriate */
            .container, .max-w-4xl, .mx-auto, div {
              max-width: 100%;
              width: auto;
              box-sizing: border-box;
            }
            
            /* Improve spacing between sections */
            .regional-section, .incident-detail, .executive-brief {
              margin-bottom: 30px;
              border-bottom: 1px solid #eee;
              padding-bottom: 30px;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <!-- Skip the title page since it's already in the content -->
            
            <!-- Insert the main content -->
            ${document.querySelector('.content-container')?.outerHTML || document.body.outerHTML}
          </div>
          
          <script>
            window.onload = function() {
              // Wait for content to load
              setTimeout(function() {
                // Trigger print dialog
                window.print();
                
                // In the print dialog, user can select "Save as PDF"
                // Leave window open for 1 minute
                setTimeout(function() {
                  window.close();
                }, 60000);
              }, 2000);
            };
          </script>
        </body>
        </html>
      `;
      
      // Write to the new window
      printWindow.document.open();
      printWindow.document.write(printDoc);
      printWindow.document.close();
      
      // Remove loading indicator
      document.body.removeChild(loadingIndicator);
      
      return 'print-dialog-opened';
    } catch (error) {
      console.error('Error generating PDF in browser:', error);
      // Remove any loading indicator if it exists
      const loadingIndicator = document.querySelector('[style*="position: fixed"][style*="z-index: 99999"]');
      if (loadingIndicator) {
        document.body.removeChild(loadingIndicator);
      }
      throw error;
    }
  };
  
  // Try server-side generation, fall back to browser generation
  const handleDownload = async () => {
    // If we don't have a reportId, we can't do anything
    if (!reportId) {
      setError('No report ID found');
      return;
    }

    // If we already have the URL, just download it
    if (pdfUrl) {
      console.log('Using cached PDF URL:', pdfUrl);
      window.open(pdfUrl, '_blank');
      return;
    }
    
    // Otherwise try to generate it
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Starting PDF generation process for report:', reportId);
      
      // First try the server-side generation
      let serverSuccess = false;
      try {
        console.log('Attempting server-side PDF generation via:', generateEndpoint);
        
        const response = await axios.post(generateEndpoint, {
          reportId
        });
        
        console.log('Server response:', response.data);
        
        if (response.data.success && response.data.pdfUrl) {
          console.log('Server successfully generated PDF at:', response.data.pdfUrl);
          setPdfUrl(response.data.pdfUrl);
          localStorage.setItem(`pdf-url-${reportId}`, response.data.pdfUrl);
          
          // Try to open PDF in new tab
          console.log('Opening PDF in new tab');
          window.open(response.data.pdfUrl, '_blank');
          serverSuccess = true;
          return;
        } else {
          console.warn('Server returned success but no PDF URL was provided');
        }
      } catch (serverError) {
        console.warn('Server-side PDF generation failed:', serverError);
        // Continue to client-side generation
      }
      
      if (!serverSuccess) {
        console.log('Falling back to browser-based PDF generation');
        // Fall back to browser-based generation
        await generatePdfInBrowser();
      }
      
    } catch (error) {
      console.error('Error in PDF generation process:', error);
      setError('Failed to generate PDF. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Don't render if we don't have a report ID and no custom override was provided
  if (!reportId) return null;
  
  return (
    <div className="pdf-download-container no-print">
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className={`${getButtonStyles()} no-print`}
        aria-label="Download PDF report"
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating PDF...
          </span>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default PDFDownloadButton;
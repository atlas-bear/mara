import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';

/**
 * Button component for PDF generation and download
 * 
 * This simplified version uses only browser-based PDF generation
 * with html2canvas and jsPDF. The server-side PDF generation has been removed.
 */
const PDFDownloadButton = ({ 
  className = "",
  customReportId = null, // Allow overriding the reportId from URL params
  variant = 'primary',
  label = 'Download PDF'
}) => {
  // Either use the provided reportId or get it from URL params
  const { yearWeek, "*": wildcardParam } = useParams();
  // Try to get reportId from different possible URL patterns
  const reportId = customReportId || yearWeek || wildcardParam || 
  // Extract from pathname as fallback
    window.location.pathname.split('/').filter(segment => segment).pop();
  
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
  
  const generatePdfInBrowser = async () => {
    try {
      console.log('Starting PDF generation...');
      
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
      
      // Get the content element
      const contentElement = document.querySelector('.content-container') || document.body;
      
      // Import libraries if needed
      const html2canvas = window.html2canvas || await import('html2canvas').then(m => m.default);
      const jsPDF = window.jspdf?.jsPDF || await import('jspdf').then(m => m.default);
      
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
          
          // Hide elements we don't want in the PDF
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
  
  const handleDownload = async () => {
    // If we don't have a reportId, we can't do anything
    if (!reportId) {
      setError('No report ID found');
      return;
    }
    
    // Start browser-based generation
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Starting PDF generation for report:', reportId);
      await generatePdfInBrowser();
    } catch (error) {
      console.error('Error generating PDF:', error);
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
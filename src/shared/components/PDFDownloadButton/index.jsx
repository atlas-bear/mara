import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
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
        console.log('PDF not yet available, will use print view');
        // We don't set an error here as this is an expected case
      }
    };
    
    checkPdfUrl();
  }, [reportId, apiEndpoint]);
  
  // New method to handle browser printing in the current window
  const handlePrint = () => {
    // Add print mode class to body
    document.body.classList.add('print-mode');
    
    // Store current URL to restore after printing
    const currentUrl = window.location.href;
    
    // Add print parameter to URL without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('print', 'true');
    window.history.replaceState({}, '', newUrl);
    
    // Short delay to ensure styles are applied
    setTimeout(() => {
      // Trigger browser print dialog
      window.print();
      
      // After printing complete, restore the URL and remove print mode
      setTimeout(() => {
        window.history.replaceState({}, '', currentUrl);
        document.body.classList.remove('print-mode');
        setIsLoading(false);
      }, 500);
    }, 300);
  };
  
  const handleDownload = async () => {
    // If we don't have a reportId, we can't do anything
    if (!reportId) {
      setError('No report ID found');
      return;
    }

    // If we already have a cached PDF URL, just open it
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      return;
    }
    
    // Otherwise use browser printing in current tab
    setIsLoading(true);
    
    try {
      // Fall back to browser printing for PDF generation
      handlePrint();
    } catch (error) {
      console.error('Error with print dialog:', error);
      setError('Failed to open print dialog. Please try again.');
      setIsLoading(false);
    }
  };
  
  // Don't render if we don't have a report ID and no custom override was provided
  if (!reportId) return null;
  
  return (
    <div className="pdf-download-container flex space-x-2">
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className={getButtonStyles()}
        aria-label="Download PDF report"
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Opening...
          </span>
        ) : (
          <>
            {pdfUrl ? (
              <Download className="mr-2 h-4 w-4" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {pdfUrl ? label : 'Print PDF'}
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
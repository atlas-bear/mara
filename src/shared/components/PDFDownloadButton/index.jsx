import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import axios from 'axios';

const PDFDownloadButton = ({ 
  className = "",
  customReportId = null, // Allow overriding the reportId from URL params
  apiEndpoint = '/api/get-pdf-url', // Allow customizing the API endpoint
  generateEndpoint = '/api/generate-pdf',
  variant = 'primary',
  label = 'Download PDF'
}) => {
  // Either use the provided reportId or get it from URL params
  const { yearWeek } = useParams();
  const reportId = customReportId || yearWeek;
  
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
  
  const handleDownload = async () => {
    // If we don't have a reportId, we can't do anything
    if (!reportId) {
      setError('No report ID found');
      return;
    }

    // If we already have the URL, just download it
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      return;
    }
    
    // Otherwise generate it on-demand
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(generateEndpoint, {
        reportId
      });
      
      if (response.data.success && response.data.pdfUrl) {
        setPdfUrl(response.data.pdfUrl);
        localStorage.setItem(`pdf-url-${reportId}`, response.data.pdfUrl);
        window.open(response.data.pdfUrl, '_blank');
      } else {
        throw new Error('PDF generation failed');
      }
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
    <div className="pdf-download-container">
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
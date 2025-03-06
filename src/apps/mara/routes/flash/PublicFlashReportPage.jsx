import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PreviewMode from '../../components/FlashReport/PreviewMode';

// For testing - will eventually come from API/database
const sampleIncidents = {
  '2025-0010': {
    id: '2025-0010',
    title: 'Armed Robbery aboard ASPASIA LUCK',
    type: 'robbery',
    date: '2024-10-17T18:08:00.000Z',
    location: 'Singapore Strait',
    coordinates: {
      latitude: 1.13,
      longitude: 103.5
    },
    vesselName: 'ASPASIA LUCK',
    vesselType: 'Bulk Carrier',
    vesselFlag: 'Liberia',
    vesselIMO: '9223485',
    status: 'Underway',
    destination: 'PEBGB',
    crewStatus: 'All Safe',
    description: 'Test incident description',
    responseActions: [
      'Action 1',
      'Action 2'
    ],
    analysis: [
      'Analysis point 1',
      'Analysis point 2'
    ]
  }
};

// Branding configurations
const brandingConfigs = {
  default: {
    logo: 'https://res.cloudinary.com/dwnh4b5sx/image/upload/v1741248008/branding/public/mara_logo_k4epmo.png',
    companyName: 'MARA Maritime Risk Analysis',
    colors: {
      primary: '#234567', // dark blue
      secondary: '#890123' // red
    }
  },
  client: {
    logo: import.meta.env.VITE_CLIENT_LOGO,
    companyName: import.meta.env.VITE_CLIENT_NAME,
    colors: {
      primary: import.meta.env.VITE_CLIENT_PRIMARY_COLOR, // dark blue
      secondary: import.meta.env.VITE_CLIENT_SECONDARY_COLOR // light blue
    }
  }
};

function PublicFlashReportPage() {
  const { incidentId, token } = useParams();
  const [searchParams] = useSearchParams();
  const brandParam = searchParams.get('brand');
  
  const incident = sampleIncidents[incidentId];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branding, setBranding] = useState(brandingConfigs.default);
  
  useEffect(() => {
    document.title = 'Maritime Flash Report';
    
    // In production, verify token is valid for this incident
    // This would involve an API call to validate the token
    const validateToken = async () => {
      setLoading(true);
      
      try {
        // For demo, we'll just simulate a request
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // In real implementation:
        // const response = await fetch(`/.netlify/functions/verify-flash-token?token=${token}&incidentId=${incidentId}`);
        // if (!response.ok) throw new Error('Invalid or expired token');
        
        // Set branding based on URL parameter
        if (brandParam === 'client') {
          setBranding(brandingConfigs.client);
        } else {
          setBranding(brandingConfigs.default);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error validating token:', err);
        setError('This link is invalid or has expired');
        setLoading(false);
      }
    };
    
    validateToken();
  }, [incidentId, token, brandParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
          <p className="text-gray-600">Please wait while we load the flash report.</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">{error || `The incident ${incidentId} could not be found.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          {/* Header with branding */}
          <div className="flex justify-center mb-6">
            <img 
              src={branding.logo} 
              alt={branding.companyName} 
              className="h-12 object-contain" 
            />
          </div>
          
          <div className="border-b border-gray-200 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-center" style={{ color: branding.colors.primary }}>
              Flash Report: {incident.vesselName}
            </h1>
            <p className="text-center text-gray-500 mt-2">
              Published on {new Date(incident.date).toLocaleDateString()}
            </p>
          </div>
          
          {/* Preview content */}
          <PreviewMode incident={incident} />
          
          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} {branding.companyName}. All rights reserved.</p>
            <p className="mt-1">This report is confidential and for the intended recipient only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicFlashReportPage;
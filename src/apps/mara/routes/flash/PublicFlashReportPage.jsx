import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useIncident } from '@shared/features/incidents';
import { IncidentDetails } from '@shared/features/weekly-report';

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
  
  // Use the shared incident hook to fetch data
  const { incident: incidentData, loading: incidentLoading, error: incidentError } = useIncident(incidentId);
  
  // State for token validation
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState(null);
  const [branding, setBranding] = useState(brandingConfigs.default);
  
  // State for the formatted incident data
  const [formattedIncident, setFormattedIncident] = useState(null);
  
  // Effect to set the document title
  useEffect(() => {
    document.title = 'Maritime Flash Report';
  }, []);
  
  // Effect to validate the token
  useEffect(() => {
    // In production, verify token is valid for this incident
    const validateToken = async () => {
      setTokenLoading(true);
      
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
        
        setTokenLoading(false);
      } catch (err) {
        console.error('Error validating token:', err);
        setTokenError('This link is invalid or has expired');
        setTokenLoading(false);
      }
    };
    
    validateToken();
  }, [incidentId, token, brandParam]);
  
  // Effect to transform API data to the format expected by IncidentDetails
  useEffect(() => {
    if (!incidentData) return;
    
    console.log('Formatting incident data for IncidentDetails component:', incidentData);
    
    // The IncidentDetails component expects a specific structure
    const formattedData = {
      incident: incidentData.incident,
      vessel: incidentData.vessel,
      incidentVessel: incidentData.incidentVessel,
      incidentType: incidentData.incidentType
    };
    
    setFormattedIncident(formattedData);
  }, [incidentData]);

  // Show loading state while either the token is being validated or the incident is loading
  const loading = tokenLoading || incidentLoading;
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            {/* Header with branding skeleton */}
            <div className="flex justify-center mb-6">
              <Skeleton width={160} height={48} />
            </div>
            
            <div className="border-b border-gray-200 pb-4 mb-6">
              <Skeleton height={30} width={300} className="mx-auto mb-2" />
              <Skeleton height={20} width={180} className="mx-auto" />
            </div>
            
            {/* Incident Details skeleton */}
            <div className="bg-orange-50 p-6 rounded-t-lg border-b border-orange-100">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton width={100} height={24} />
                    <Skeleton width={100} height={24} />
                  </div>
                  <Skeleton height={32} width={200} className="mb-1" />
                  <Skeleton height={20} width={250} />
                </div>
                <div>
                  <Skeleton height={16} width={80} />
                  <Skeleton height={24} width={120} />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-b border-gray-200">
              <Skeleton height={24} width={120} className="mb-4" />
              <Skeleton height={300} className="mb-2" />
            </div>
            
            <div className="p-6">
              <Skeleton height={24} width={150} className="mb-4" />
              <Skeleton count={3} className="mb-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  const error = tokenError || incidentError;
  if (error || !formattedIncident) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">{error || `The incident ${incidentId} could not be found.`}</p>
        </div>
      </div>
    );
  }

  // Extract vessel information for the header
  const vesselName = formattedIncident.vessel?.fields?.name || 
                     formattedIncident.incident?.fields?.vessel_name || 
                     'Incident Report';
  const incidentDate = formattedIncident.incident?.fields?.date_time_utc || 
                       formattedIncident.incident?.fields?.date || 
                       new Date().toISOString();
  
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
              Flash Report: {vesselName}
            </h1>
            <p className="text-center text-gray-500 mt-2">
              Published on {new Date(incidentDate).toLocaleDateString()}
            </p>
          </div>
          
          {/* Incident Details - using the shared component with interactive map */}
          <IncidentDetails 
            incident={formattedIncident} 
            showHistoricalContext={false}
            useInteractiveMap={true} // Use the interactive MapboxGL map for Flash Reports
          />
          
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
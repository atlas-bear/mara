import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import PreviewMode from '../../components/FlashReport/PreviewMode';
import EmailTemplate from '../../components/FlashReport/EmailTemplate';
import { useNotifications } from '../../hooks/useNotifications';
import { useIncident } from '@shared/features/incidents';
import { Send, Mail, Eye, EyeOff, User, Tag } from 'lucide-react';

// Sample subscribers for testing
const sampleSubscribers = [
  { id: 'user1', email: 'test@example.com', firstName: 'Test', lastName: 'User', isClient: false },
  { id: 'user2', email: 'client@clientdomain.com', firstName: 'Client', lastName: 'User', isClient: true }
];

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

function FlashReportPage() {
  const { incidentId } = useParams();
  const { incident: incidentData, loading, error } = useIncident(incidentId);
  const { sendFlashReport } = useNotifications();
  
  // Prepare the incident data in the format expected by the components
  const [incident, setIncident] = useState(null);
  
  const [activeTab, setActiveTab] = useState('preview');
  const [subscribers, setSubscribers] = useState([]);
  const [newSubscriber, setNewSubscriber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  
  // State for branding in preview
  const [branding, setBranding] = useState(brandingConfigs.default);
  
  // State to keep track of which recipient is selected for preview
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  
  useEffect(() => {
    document.title = 'MARA Flash Report';
    
    // Load sample subscribers
    setSubscribers(sampleSubscribers);
  }, []);
  
  // Effect to transform API data into the format expected by components
  useEffect(() => {
    if (!incidentData) return;
    
    console.log('Processing incident data from API:', incidentData);
    
    // Extract fields from the API response
    const fields = incidentData.incident.fields;
    const vesselFields = incidentData.vessel?.fields || {};
    const incidentVesselFields = incidentData.incidentVessel?.fields || {};
    const incidentTypeFields = incidentData.incidentType?.fields || {};
    
    // Create a structured incident object
    const formattedIncident = {
      id: fields.id,
      title: fields.title || `Incident at ${fields.location_name}`,
      type: incidentTypeFields.name?.toLowerCase() || 'incident',
      date: fields.date_time_utc,
      location: fields.location_name,
      coordinates: {
        latitude: parseFloat(fields.latitude) || 0,
        longitude: parseFloat(fields.longitude) || 0
      },
      vesselName: vesselFields.name || 'Unknown Vessel',
      vesselType: vesselFields.type || 'Unknown',
      vesselFlag: vesselFields.flag || 'Unknown',
      vesselIMO: vesselFields.imo || 'Unknown',
      status: incidentVesselFields.vessel_status_during_incident || 'Unknown',
      destination: fields.vessel_destination || 'Unknown',
      crewStatus: incidentVesselFields.crew_impact || 'No information available',
      description: fields.description || 'No description available',
      responseActions: fields.response_type || [],
      analysis: fields.analysis ? [fields.analysis] : ['No analysis available'],
      // Include any additional fields needed by the components
      map_image_url: fields.map_image_url
    };
    
    console.log('Formatted incident for UI:', formattedIncident);
    setIncident(formattedIncident);
  }, [incidentData]);
  
  const handleAddSubscriber = () => {
    if (!newSubscriber || !newSubscriber.includes('@')) return;
    
    const domain = newSubscriber.split('@')[1];
    const firstName = newSubscriber.split('@')[0];
    
    // Determine if this is a client domain (for demonstration purposes)
    const isClient = domain.includes('client') || domain.includes('company');
    
    const newSubscriberObj = {
      id: `user${subscribers.length + 1}`,
      email: newSubscriber,
      firstName,
      lastName: '',
      domain,
      isClient
    };
    
    setSubscribers([...subscribers, newSubscriberObj]);
    setNewSubscriber('');
  };
  
  const handleRemoveSubscriber = (id) => {
    setSubscribers(subscribers.filter(s => s.id !== id));
  };
  
  const handleSendReport = async () => {
    if (subscribers.length === 0) {
      setDialogMessage('Please add at least one subscriber.');
      setShowDialog(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Send the flash report to all subscribers - pass the full subscriber objects
      const result = await sendFlashReport(incident, subscribers);
      console.log('Flash report result:', result);
      
      // Show success message with recipient statuses
      const sentCount = result.results?.filter(r => r.status === 'sent' || r.status === 'demo-sent').length || 0;
      const totalCount = subscribers.length;
      
      // Check if public URLs are available
      const hasPublicUrls = result.results?.some(r => r.publicUrl);
      
      let message = `Flash report sent successfully!${result.message?.includes('DEMO') ? ' (DEMO MODE)' : ''}\n` +
        `${sentCount} of ${totalCount} recipients received the report.`;
      
      // Add public URL information if available
      if (hasPublicUrls) {
        message += `\n\nRecipients can view the report online. URLs are logged in the console for testing.`;
        message += `\n\nℹ️ In production, each recipient would receive an email with their unique secure link.`;
        
        // Specifically for the demo, add the first URL directly to the message
        const firstUrl = result.results?.find(r => r.publicUrl)?.publicUrl;
        if (firstUrl) {
          message += `\n\n🔗 Demo URL (for testing): ${firstUrl}`;
        }
      }
      
      setDialogMessage(message);
      setShowDialog(true);
    } catch (error) {
      console.error('Error sending flash report:', error);
      setDialogMessage(`Error sending flash report: ${error.message}`);
      setShowDialog(true);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to handle selecting a recipient for email preview
  const handleSelectRecipient = (subscriber) => {
    setSelectedRecipient(subscriber);
    
    // Set branding based on whether the selected recipient is a client
    if (subscriber.isClient) {
      setBranding(brandingConfigs.client);
    } else {
      setBranding(brandingConfigs.default);
    }
  };
  
  // Toggle branding for testing purposes
  const handleTestClientBranding = () => {
    // Toggle between default and client branding
    if (branding.companyName === brandingConfigs.client.companyName) {
      setBranding(brandingConfigs.default);
      setSelectedRecipient(null);
    } else {
      setBranding(brandingConfigs.client);
      setSelectedRecipient(null);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <Skeleton width={300} height={36} />
              <div className="flex gap-2">
                <Skeleton width={120} height={40} />
                <Skeleton width={120} height={40} />
              </div>
            </div>
            
            <div className="border-b border-gray-200 mb-6">
              <Skeleton width={200} height={40} />
            </div>
            
            {/* Preview Skeleton */}
            <div className="mt-6">
              <div className="mb-4">
                <Skeleton height={60} className="mb-4" />
                <Skeleton count={2} className="mb-2" />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <Skeleton height={30} width={200} className="mb-4" />
                <Skeleton count={3} className="mb-2" />
              </div>
              
              <div className="mt-4">
                <Skeleton height={300} className="mb-6" />
                <Skeleton count={4} className="mb-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }
  
  // Show not found state
  if (!incident && !loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Incident Not Found</h1>
          <p className="text-gray-600">The incident {incidentId} could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Flash Report: {incident.vesselName}</h1>
            <div className="flex gap-2">
              <button 
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => setShowEmailPreview(!showEmailPreview)}
              >
                {showEmailPreview ? <EyeOff className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                <span>{showEmailPreview ? "Hide Email Preview" : "Show Email Preview"}</span>
              </button>
              {activeTab === 'recipients' ? (
                <button 
                  className={`flex items-center gap-1 px-3 py-2 ${
                    selectedRecipient 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'border border-gray-300 text-gray-700'
                  } rounded-md hover:bg-gray-50`}
                  onClick={() => {
                    if (selectedRecipient) {
                      setSelectedRecipient(null);
                      setBranding(brandingConfigs.default);
                    } else if (subscribers.length > 0) {
                      handleSelectRecipient(subscribers[0]);
                    }
                  }}
                  disabled={subscribers.length === 0}
                >
                  <User className="h-4 w-4" />
                  <span>{selectedRecipient ? 'Clear Selection' : 'Select Recipient'}</span>
                </button>
              ) : (
                <button 
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  onClick={handleTestClientBranding}
                >
                  <Tag className="h-4 w-4" />
                  <span>Toggle Branding</span>
                </button>
              )}
              <button 
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSendReport}
                disabled={isSubmitting || subscribers.length === 0}
              >
                <Send className="h-4 w-4" />
                <span>Send Flash Report</span>
              </button>
            </div>
          </div>
          
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'preview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('preview')}
              >
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Preview</span>
                </div>
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'recipients'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab('recipients')}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Recipients ({subscribers.length})</span>
                </div>
              </button>
            </nav>
          </div>
          
          {activeTab === 'preview' && (
            <div className="mt-6">
              {showEmailPreview ? (
                <div className="border p-4 rounded max-w-2xl mx-auto">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm uppercase tracking-wide text-gray-500">Email Preview</h3>
                    {selectedRecipient && (
                      <div className="text-sm">
                        Previewing for: <span className="font-medium">{selectedRecipient.email}</span>
                        {selectedRecipient.isClient && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Client Branding
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <EmailTemplate incident={incident} branding={branding} />
                </div>
              ) : (
                <PreviewMode incident={incident} />
              )}
            </div>
          )}
          
          {activeTab === 'recipients' && (
            <div className="mt-6">
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Add Recipient Email
                  </label>
                  <input
                    type="email"
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newSubscriber}
                    onChange={(e) => setNewSubscriber(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <button 
                  className="self-end px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleAddSubscriber}
                  disabled={!newSubscriber || !newSubscriber.includes('@')}
                >
                  Add
                </button>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Recipients:</h3>
                {subscribers.length === 0 ? (
                  <p className="text-gray-500">No recipients added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {subscribers.map(sub => (
                      <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{sub.email}</p>
                          <p className="text-sm text-gray-500">
                            {sub.firstName} {sub.lastName}
                            {sub.isClient && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Client
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            className={`px-2 py-1 text-sm ${
                              selectedRecipient?.id === sub.id 
                                ? 'bg-green-100 text-green-800 rounded' 
                                : 'text-blue-600 hover:text-blue-800'
                            }`}
                            onClick={() => handleSelectRecipient(sub)}
                          >
                            {selectedRecipient?.id === sub.id ? 'Selected' : 'Preview'}
                          </button>
                          <button 
                            className="px-2 py-1 text-sm text-red-600 hover:text-red-800"
                            onClick={() => handleRemoveSubscriber(sub.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {dialogMessage.includes('Error') ? 'Error' : 'Success'}
              </h2>
              <div className="text-gray-700 whitespace-pre-line">{dialogMessage}</div>
              <div className="mt-6 flex justify-end">
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() => setShowDialog(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashReportPage;
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PreviewMode from '../../components/FlashReport/PreviewMode';
import EmailTemplate from '../../components/FlashReport/EmailTemplate';
import { useNotifications } from '../../hooks/useNotifications';
import { Send, Mail, Eye, EyeOff, User, Tag } from 'lucide-react';

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
  const incident = sampleIncidents[incidentId];
  const { sendFlashReport } = useNotifications();
  
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

  if (!incident) {
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
              <div className="flex gap-2">
                <button 
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSendReport}
                  disabled={isSubmitting || subscribers.length === 0}
                >
                  <Send className="h-4 w-4" />
                  <span>Send Flash Report</span>
                </button>

                {/* Direct Send-Flash-Report API test button */}
                <button 
                  className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Directly test the send-flash-report API"
                  onClick={async () => {
                    try {
                      if (subscribers.length === 0) {
                        alert('Please add at least one subscriber/recipient first');
                        return;
                      }
                      
                      if (window.confirm(`Directly call send-flash-report API for ${subscribers[0].email}?`)) {
                        console.log('Directly calling send-flash-report API...');
                        
                        const formattedRecipients = subscribers.map(sub => ({
                          email: sub.email,
                          firstName: sub.firstName || '',
                          lastName: sub.lastName || '',
                          isClient: sub.isClient || false
                        }));
                        
                        const response = await fetch('/.netlify/functions/send-flash-report', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            incidentId: incident.id,
                            recipients: formattedRecipients,
                            testMode: true
                          }),
                        });
                        
                        console.log('Direct API call response status:', response.status);
                        
                        let responseText;
                        try {
                          responseText = await response.text();
                          console.log('Direct API call raw response:', responseText);
                        } catch (e) {
                          console.error('Error getting response text:', e);
                        }
                        
                        try {
                          const data = responseText ? JSON.parse(responseText) : {};
                          console.log('Direct API call parsed response:', data);
                          
                          // Show detailed message
                          let message = `Direct send-flash-report API test:\n`;
                          message += `Status: ${response.status}\n`;
                          message += `Message: ${data.message || 'No message'}\n\n`;
                          
                          if (data.results && data.results.length > 0) {
                            message += `Results:\n`;
                            data.results.forEach(r => {
                              message += `- ${r.email}: ${r.status}\n`;
                              if (r.publicUrl) {
                                message += `  URL: ${r.publicUrl}\n`;
                              }
                              if (r.error) {
                                message += `  Error: ${r.error}\n`;
                              }
                            });
                          }
                          
                          alert(message);
                        } catch (e) {
                          console.error('Error parsing response:', e);
                          alert(`API returned non-JSON: ${responseText}`);
                        }
                      }
                    } catch (err) {
                      console.error('API call error:', err);
                      alert(`API call error: ${err.message}`);
                    }
                  }}
                >
                  Test send-flash-report
                </button>
                
                {/* Direct email test button */}
                <button 
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Directly send a simple test email"
                  onClick={async () => {
                    try {
                      if (subscribers.length === 0) {
                        alert('Please add at least one subscriber/recipient first');
                        return;
                      }
                      
                      if (window.confirm(`Send a simple test email to ${subscribers[0].email}?`)) {
                        console.log('Directly sending test email...');
                        const response = await fetch('/.netlify/functions/direct-send-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            email: subscribers[0].email,
                            subject: 'Direct MARA Test Email',
                            message: 'This is a direct test email from MARA to verify that your SendGrid integration is working correctly.'
                          }),
                        });
                        
                        console.log('Email API response status:', response.status);
                        
                        const text = await response.text();
                        console.log('Email API raw response:', text);
                        
                        try {
                          const data = JSON.parse(text);
                          console.log('Email API parsed response:', data);
                          
                          if (data.success) {
                            alert(`Test email sent successfully to ${subscribers[0].email}!\n\nPlease check your inbox (and spam folder).`);
                          } else {
                            alert(`Failed to send email: ${data.error || 'Unknown error'}\n\n${JSON.stringify(data.details || {})}`);
                          }
                        } catch (e) {
                          console.error('Error parsing response:', e);
                          alert(`API returned non-JSON: ${text}`);
                        }
                      }
                    } catch (err) {
                      console.error('Email test error:', err);
                      alert(`Email test error: ${err.message}`);
                    }
                  }}
                >
                  Send Test Email
                </button>
                
                <button 
                  className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Test the email function directly"
                  onClick={async () => {
                    try {
                      if (subscribers.length === 0) {
                        alert('Please add at least one subscriber/recipient first');
                        return;
                      }
                      
                      if (window.confirm(`Send a test email to ${subscribers[0].email}?`)) {
                        console.log('Testing Netlify function with email send...');
                        const response = await fetch('/.netlify/functions/test-send-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            test: true,
                            sendEmail: true, 
                            recipients: subscribers.map(s => ({ email: s.email }))
                          }),
                        });
                        const text = await response.text();
                        console.log('Test function response status:', response.status);
                        console.log('Test function raw response:', text);
                        
                        try {
                          const data = JSON.parse(text);
                          console.log('Test function parsed response:', data);
                          
                          // Show detailed message including SendGrid info
                          let message = `Test function result:\n`;
                          message += `Status: ${response.status}\n`;
                          message += `Message: ${data.message || 'No message'}\n\n`;
                          
                          // Add email result info
                          message += `Email: ${data.emailResult || 'No result'}\n`;
                          message += `SendGrid API Key: ${data.sendGridApiKeyFound ? 'Found' : 'Not Found'}\n`;
                          message += `SendGrid From Email: ${data.sendGridFromEmailFound ? 'Found' : 'Not Found'}\n`;
                          
                          alert(message);
                        } catch (e) {
                          console.error('Error parsing test response:', e);
                          alert(`Test function returned non-JSON: ${text}`);
                        }
                      } else {
                        // User canceled email sending, just test function
                        console.log('Testing Netlify function without email...');
                        const response = await fetch('/.netlify/functions/test-send-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            test: true,
                            recipients: subscribers.map(s => ({ email: s.email }))
                          }),
                        });
                        const text = await response.text();
                        console.log('Test function response status:', response.status);
                        console.log('Test function raw response:', text);
                        
                        try {
                          const data = JSON.parse(text);
                          console.log('Test function parsed response:', data);
                          alert(`Test function success!\nStatus: ${response.status}\nMessage: ${data.message || 'No message'}`);
                        } catch (e) {
                          console.error('Error parsing test response:', e);
                          alert(`Test function returned non-JSON: ${text}`);
                        }
                      }
                    } catch (err) {
                      console.error('Test error:', err);
                      alert(`Test error: ${err.message}`);
                    }
                  }}
                >
                  Test Function
                </button>
              </div>
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
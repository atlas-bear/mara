import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  // These would eventually come from your API/data source
  const latestWeeklyReport = '2025-06';
  const latestFlashReport = '2024-2662';
  
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('MARA Test Email');
  const [emailMessage, setEmailMessage] = useState('This is a test message from MARA.');
  const [testResult, setTestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailTest, setShowEmailTest] = useState(false);
  const [showFlashTest, setShowFlashTest] = useState(false);
  const [flashRecipient, setFlashRecipient] = useState('');
  const [useDemoIncident, setUseDemoIncident] = useState(true);
  const [customIncidentId, setCustomIncidentId] = useState('');
  const [flashTestResult, setFlashTestResult] = useState(null);
  const [isFlashLoading, setIsFlashLoading] = useState(false);

  useEffect(() => {
    document.title = 'MARA';
  }, []);
  
  const handleTestEmail = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/.netlify/functions/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          message: emailMessage,
        }),
      });

      const data = await response.json();
      setTestResult({
        success: response.ok,
        message: data.message || data.error,
        details: data,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error.message,
        error,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTestFlashReport = async (e) => {
    e.preventDefault();
    setIsFlashLoading(true);
    setFlashTestResult(null);
    
    try {
      const response = await fetch('/.netlify/functions/test-flash-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: flashRecipient,
          useDemoIncident: useDemoIncident,
          incidentId: useDemoIncident ? undefined : customIncidentId,
        }),
      });
      
      const data = await response.json();
      setFlashTestResult({
        success: response.ok,
        message: data.message || data.error,
        details: data,
      });
    } catch (error) {
      setFlashTestResult({
        success: false,
        message: error.message,
        error,
      });
    } finally {
      setIsFlashLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
          MARA (Multi-source Analysis and Reporting Architecture)
          </h1>
          
          <div className="space-y-6">
            <div className="bg-orange-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Latest Reports</h2>
              <div className="space-y-4">
                <Link 
                  to={`/weekly-report/${latestWeeklyReport}`}
                  className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-gray-900">Latest Weekly Report</div>
                  <div className="text-gray-600">Week {latestWeeklyReport}</div>
                </Link>
                
                <Link 
                  to={`/flash/${latestFlashReport}`}
                  className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-gray-900">Latest Flash Report</div>
                  <div className="text-gray-600">Incident {latestFlashReport}</div>
                </Link>
              </div>
            </div>
            
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => {
                  setShowEmailTest(!showEmailTest);
                  if (!showEmailTest) setShowFlashTest(false);
                }}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
              >
                {showEmailTest ? 'Hide Email Test' : 'Show Email Test Tool'}
              </button>
              
              <button 
                onClick={() => {
                  setShowFlashTest(!showFlashTest);
                  if (!showFlashTest) setShowEmailTest(false);
                }}
                className="bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 transition"
              >
                {showFlashTest ? 'Hide Flash Report Test' : 'Show Flash Report Test'}
              </button>
            </div>
            
            {showEmailTest && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 mt-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Test Tool</h2>
                <p className="text-gray-600 mb-4">
                  Use this form to test email sending with SendGrid. This will help verify your
                  environment variables are set up correctly.
                </p>

                <form onSubmit={handleTestEmail} className="space-y-4">
                  <div>
                    <label htmlFor="emailTo" className="block text-sm font-medium text-gray-700">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      id="emailTo"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="recipient@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700">
                      Subject
                    </label>
                    <input
                      type="text"
                      id="emailSubject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="emailMessage" className="block text-sm font-medium text-gray-700">
                      Message
                    </label>
                    <textarea
                      id="emailMessage"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={4}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Send Test Email'}
                  </button>
                </form>

                {testResult && (
                  <div
                    className={`mt-4 p-4 rounded-md ${
                      testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <h3
                      className={`text-sm font-medium ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {testResult.success ? 'Success' : 'Error'}
                    </h3>
                    <p
                      className={`mt-2 text-sm ${
                        testResult.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {testResult.message}
                    </p>
                    <pre
                      className={`mt-2 text-xs overflow-auto p-2 rounded ${
                        testResult.success ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            
            {showFlashTest && (
              <div className="bg-white border border-orange-200 rounded-lg p-6 mt-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Flash Report Test Tool</h2>
                <p className="text-gray-600 mb-4">
                  Use this form to test the Flash Report email functionality. This will send a test Flash Report
                  email to the specified recipient.
                </p>

                <form onSubmit={handleTestFlashReport} className="space-y-4">
                  <div>
                    <label htmlFor="flashRecipient" className="block text-sm font-medium text-gray-700">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      id="flashRecipient"
                      value={flashRecipient}
                      onChange={(e) => setFlashRecipient(e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500"
                      placeholder="recipient@example.com"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Tip: Use an email with "client" or "company" in the domain to test client branding.
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useDemoIncident"
                      checked={useDemoIncident}
                      onChange={(e) => setUseDemoIncident(e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useDemoIncident" className="ml-2 block text-sm text-gray-700">
                      Use demo incident (2024-2662)
                    </label>
                  </div>

                  {!useDemoIncident && (
                    <div>
                      <label htmlFor="customIncidentId" className="block text-sm font-medium text-gray-700">
                        Custom Incident ID
                      </label>
                      <input
                        type="text"
                        id="customIncidentId"
                        value={customIncidentId}
                        onChange={(e) => setCustomIncidentId(e.target.value)}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500"
                        placeholder="YYYY-NNNN"
                        required={!useDemoIncident}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isFlashLoading || (!useDemoIncident && !customIncidentId)}
                    className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isFlashLoading ? 'Sending...' : 'Send Test Flash Report'}
                  </button>
                </form>

                {flashTestResult && (
                  <div
                    className={`mt-4 p-4 rounded-md ${
                      flashTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <h3
                      className={`text-sm font-medium ${
                        flashTestResult.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {flashTestResult.success ? 'Success' : 'Error'}
                    </h3>
                    <p
                      className={`mt-2 text-sm ${
                        flashTestResult.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {flashTestResult.message}
                    </p>
                    <pre
                      className={`mt-2 text-xs overflow-auto p-2 rounded max-h-64 ${
                        flashTestResult.success ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {JSON.stringify(flashTestResult.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
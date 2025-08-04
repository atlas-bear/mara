import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useIncident } from '@shared/features/incidents';

function IncidentPage() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  
  const { 
    incident, 
    relatedIncidents, 
    incidentHistory, 
    loading, 
    error 
  } = useIncident(incidentId, {
    includeRelated: true,
    includeHistory: true,
    relatedLimit: 5,
    relatedRadius: 50
  });

  useEffect(() => {
    document.title = incident 
      ? `MARA - Incident ${incident.id}` 
      : 'MARA - Incident Details';
  }, [incident]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header Skeleton */}
          <div className="mb-6">
            <Skeleton height={40} width={200} className="mb-2" />
            <Skeleton height={20} width={400} />
          </div>

          {/* Main Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Details */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-md rounded-lg p-6 mb-6">
                <Skeleton height={30} width={250} className="mb-4" />
                <Skeleton count={4} className="mb-2" />
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Skeleton height={80} />
                  <Skeleton height={80} />
                </div>
              </div>
              
              {/* Map Skeleton */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <Skeleton height={25} width={150} className="mb-4" />
                <Skeleton height={300} />
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-md rounded-lg p-6 mb-6">
                <Skeleton height={25} width={120} className="mb-4" />
                <Skeleton count={6} className="mb-2" />
              </div>
              
              <div className="bg-white shadow-md rounded-lg p-6">
                <Skeleton height={25} width={150} className="mb-4" />
                <Skeleton count={3} className="mb-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading incident</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <div className="mt-4 flex space-x-4">
                  <button 
                    onClick={() => window.location.reload()} 
                    className="bg-red-100 text-red-800 px-4 py-2 rounded-md text-sm hover:bg-red-200"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => navigate('/weekly-report')} 
                    className="bg-gray-100 text-gray-800 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                  >
                    Back to Reports
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Incident not found</h3>
                <p className="mt-2 text-sm text-yellow-700">
                  The incident with ID "{incidentId}" could not be found.
                </p>
                <button 
                  onClick={() => navigate('/weekly-report')} 
                  className="mt-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm hover:bg-yellow-200"
                >
                  Back to Reports
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Get incident severity color
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Incident {incident.id}
              </h1>
              <p className="text-gray-600 mt-1">
                {formatDate(incident.date_time || incident.created_at)}
              </p>
            </div>
            <button
              onClick={() => navigate('/weekly-report')}
              className="bg-white px-4 py-2 rounded-md shadow hover:bg-gray-50"
            >
              ← Back to Reports
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Incident Details */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Incident Details</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900">Description</h3>
                  <p className="text-gray-700 mt-1">
                    {incident.description || incident.summary || 'No description available'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Location</h3>
                    <p className="text-gray-700 mt-1">
                      {incident.location || 'Unknown location'}
                    </p>
                    {incident.latitude && incident.longitude && (
                      <p className="text-sm text-gray-500">
                        {incident.latitude}°, {incident.longitude}°
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900">Region</h3>
                    <p className="text-gray-700 mt-1">
                      {incident.region || 'Unknown region'}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900">Incident Type</h3>
                    <p className="text-gray-700 mt-1">
                      {incident.incident_type || incident.type || 'Unknown type'}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900">Vessel Type</h3>
                    <p className="text-gray-700 mt-1">
                      {incident.vessel_type || 'Unknown vessel type'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Section */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Location</h2>
              {incident.latitude && incident.longitude ? (
                <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                  <p className="text-gray-600">
                    Map component would be rendered here
                    <br />
                    <span className="text-sm">
                      Coordinates: {incident.latitude}°, {incident.longitude}°
                    </span>
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg h-64 flex items-center justify-center">
                  <p className="text-gray-500">No location data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Key Information */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Key Information</h2>
              
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">Status</span>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(incident.status)}`}>
                      {incident.status || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Source</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {incident.source || 'Unknown source'}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Date & Time</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(incident.date_time || incident.created_at)}
                  </p>
                </div>

                {incident.vessel_name && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Vessel Name</span>
                    <p className="text-sm text-gray-900 mt-1">{incident.vessel_name}</p>
                  </div>
                )}

                {incident.flag && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Flag</span>
                    <p className="text-sm text-gray-900 mt-1">{incident.flag}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Related Incidents */}
            {relatedIncidents.length > 0 && (
              <div className="bg-white shadow-md rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Related Incidents</h2>
                <div className="space-y-3">
                  {relatedIncidents.map((related, index) => (
                    <div key={index} className="border-l-2 border-blue-200 pl-3">
                      <p className="text-sm font-medium text-gray-900">
                        {related.description || 'Incident ' + related.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(related.date_time || related.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incident History */}
            {incidentHistory.length > 0 && (
              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">History</h2>
                <div className="space-y-3">
                  {incidentHistory.map((entry, index) => (
                    <div key={index} className="border-l-2 border-gray-200 pl-3">
                      <p className="text-sm text-gray-900">{entry.description}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncidentPage;

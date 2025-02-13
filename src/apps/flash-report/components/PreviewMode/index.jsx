import React from 'react';
import { MapPin, Ship, Users } from 'lucide-react';
import MaritimeMap from '../../../../shared/components/MaritimeMap';

const PreviewMode = ({ incident }) => {
  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Header with Alert Status */}
      <div className="bg-orange-50 p-6 rounded-t-lg border-b border-orange-100">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Alert ID: {incident.id}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                {incident.type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {incident.vesselName}
            </h1>
            <p className="text-gray-600">
              {incident.vesselType} | IMO: {incident.vesselIMO} | Flag: {incident.vesselFlag}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Reported</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(incident.date).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Facts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-gray-200">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-semibold text-gray-900">{incident.location}</p>
            <p className="text-sm text-gray-600">
              {incident.coordinates.latitude}°N, {incident.coordinates.longitude}°E
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Ship className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Vessel Status</p>
            <p className="font-semibold text-gray-900">{incident.status}</p>
            <p className="text-sm text-gray-600">En route to {incident.destination}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Crew Status</p>
            <p className="font-semibold text-gray-900">{incident.crewStatus}</p>
            <p className="text-sm text-gray-600">No injuries reported</p>
          </div>
        </div>
      </div>

      {/* Incident Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
        <MaritimeMap 
          incidents={[{
            latitude: incident.coordinates.latitude,
            longitude: incident.coordinates.longitude,
            title: incident.vesselName,
            description: incident.description,
            type: (incident.type || 'robbery').toLowerCase()
          }]}
          center={[incident.coordinates.longitude, incident.coordinates.latitude]}
          zoom={8}
        />
        <div className="mt-2 text-xs text-gray-500">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> 
            Incident Location
          </span>
        </div>
      </div>

      {/* Incident Details */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Incident Details</h2>
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700">{incident.description}</p>
          </div>

          {incident.responseActions && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Response Actions</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {incident.responseActions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Section */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis</h2>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
            <ul className="list-disc list-inside text-sm text-gray-700">
              {incident.analysis.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewMode;
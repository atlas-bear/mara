import React from 'react';
import { MapPin, Ship, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import MaritimeMap from '@shared/components/MaritimeMap';

const areaIncidentData = [
  { month: 'May', incidents: 2 },
  { month: 'Jun', incidents: 3 },
  { month: 'Jul', incidents: 2 },
  { month: 'Aug', incidents: 4 },
  { month: 'Sep', incidents: 3 },
  { month: 'Oct', incidents: 5 }
];

const IncidentDetails = ({ incident, isHistorical = false }) => {
  if (!incident) return null;

  // Get fields from the nested structure
  const fields = incident.incident.fields;
  const vesselFields = incident.vessel?.fields || {};
  const incidentVesselFields = incident.incidentVessel?.fields || {};
  const incidentTypeFields = incident.incidentType?.fields || {};

  // Configure map data
  const mapIncidents = [{
    latitude: parseFloat(fields.latitude),
    longitude: parseFloat(fields.longitude),
    title: vesselFields.name || 'Unknown Vessel',
    description: fields.description,
    type: (incidentTypeFields.name || 'unknown').toLowerCase()
  }];

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Header with Alert Status */}
      <div className="bg-orange-50 p-6 rounded-t-lg border-b border-orange-100">
        {isHistorical && (
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 p-2 rounded">
            Historical incident - Most recent in this region
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Alert ID: {fields.id}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                {incidentTypeFields.name}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {vesselFields.name || 'Unknown Vessel'}
            </h1>
            <p className="text-gray-600">
              {vesselFields.type} | IMO: {vesselFields.imo} | Flag: {vesselFields.flag}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Reported</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(fields.date_time_utc).toLocaleString()}
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
            <p className="font-semibold text-gray-900">{fields.location_name}</p>
            <p className="text-sm text-gray-600">
              {fields.latitude}°N, {fields.longitude}°E
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Ship className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Vessel Status</p>
            <p className="font-semibold text-gray-900">{incidentVesselFields.vessel_status_during_incident || 'Unknown'}</p>
            <p className="text-sm text-gray-600">{vesselFields.type}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Crew Status</p>
            <p className="font-semibold text-gray-900">
              {incidentVesselFields.crew_impact || 'No injuries reported'}
            </p>
          </div>
        </div>
      </div>

      {/* Incident Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
        <MaritimeMap 
          incidents={mapIncidents}
          center={[parseFloat(fields.longitude), parseFloat(fields.latitude)]}
          zoom={10}
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
            <p className="text-gray-700">{fields.description}</p>
          </div>

          {fields.response_type && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Response Actions</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {fields.response_type.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
                {fields.authorities_notified?.map((authority, index) => (
                  <li key={`auth-${index}`}>{authority}</li>
                ))}
              </ul>
            </div>
          )}

          {fields.items_stolen && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Stolen Items</h3>
              <ul className="list-disc list-inside text-gray-700">
                {fields.items_stolen.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Section */}
      {/* Analysis Section */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis</h2>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
            <p className="text-sm text-gray-700">{fields.analysis}</p>
          </div>

          {/* Historical Context */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Historical Context</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[
                  { month: 'May', incidents: 2 },
                  { month: 'Jun', incidents: 3 },
                  { month: 'Jul', incidents: 2 },
                  { month: 'Aug', incidents: 4 },
                  { month: 'Sep', incidents: 3 },
                  { month: 'Oct', incidents: 5 }
                ]}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="incidents" 
                    stroke="#f97316" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Incidents in {fields.region} (Past 6 Months)
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Recommendations</h3>
            <p className="text-sm text-gray-700">{fields.recommendations}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetails;
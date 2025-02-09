import React, { useState, useEffect } from 'react';
import { MapPin, Ship, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import MaritimeMap from '../MaritimeMap';
import { fetchIncident } from '../../utils/airtable';

// Sample historical data - this could be fetched from Airtable as well
const areaIncidentData = [
  { month: 'May', incidents: 2 },
  { month: 'Jun', incidents: 3 },
  { month: 'Jul', incidents: 2 },
  { month: 'Aug', incidents: 4 },
  { month: 'Sep', incidents: 3 },
  { month: 'Oct', incidents: 5 }
];

const IncidentDetails = ({ incidentId }) => {
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadIncident() {
      try {
        const data = await fetchIncident(incidentId);
        setIncident(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    loadIncident();
  }, [incidentId]);

  if (loading) return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8 p-6">
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8 p-6">
      <div className="text-red-600">Error loading incident: {error}</div>
    </div>
  );

  if (!incident) return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8 p-6">
      <div>No incident found</div>
    </div>
  );

  // Configure map data
  const mapIncidents = [{
    latitude: incident.location.lat,
    longitude: incident.location.lng,
    title: incident.title,
    description: incident.description,
    type: incident.type.toLowerCase()
  }];

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Header with Alert Status */}
      <div className="bg-orange-50 p-6 rounded-t-lg border-b border-orange-100">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Alert ID: {incident.alertId}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                {incident.type}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {incident.vesselName}
            </h1>
            <p className="text-gray-600">
              {incident.vesselType} | IMO: {incident.vesselImo} | Flag: {incident.vesselFlag}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Reported</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(incident.dateTime).toLocaleString()}
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
            <p className="font-semibold text-gray-900">{incident.location.name}</p>
            <p className="text-sm text-gray-600">
              {incident.location.formatted}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Ship className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Vessel Status</p>
            <p className="font-semibold text-gray-900">{incident.vesselStatus}</p>
            <p className="text-sm text-gray-600">{incident.vesselActivity}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Crew Status</p>
            <p className="font-semibold text-gray-900">
              {incident.crewImpact || 'No injuries reported'}
            </p>
          </div>
        </div>
      </div>

      {/* Incident Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
        <MaritimeMap 
          incidents={mapIncidents}
          center={[incident.location.lng, incident.location.lat]}
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
            <p className="text-gray-700">{incident.description}</p>
          </div>

          {incident.responseType && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Response Actions</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {incident.responseType.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
                {incident.authoritiesNotified?.map((authority, index) => (
                  <li key={`auth-${index}`}>{authority} notified</li>
                ))}
              </ul>
            </div>
          )}

          {incident.itemsStolen && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Stolen Items</h3>
              <ul className="list-disc list-inside text-gray-700">
                {incident.itemsStolen.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Section */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis</h2>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
            <p className="text-sm text-gray-700">{incident.analysis}</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Historical Context</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={areaIncidentData}>
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
              Incidents in {incident.region} (Past 6 Months)
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-700">{incident.recommendations}</p>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetails;
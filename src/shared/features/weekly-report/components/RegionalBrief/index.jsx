import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import MaritimeMap from '@shared/components/MaritimeMap';
import { getFirstSentence } from '@shared/features/weekly-report';
import { regionalMonthlyData } from '../../utils/mock-data';

// Define regions info
const REGIONS = {
  'West Africa': {
    title: 'West Africa',
    description: 'West African VRA/HRA',
    defaultCenter: [1, 4],
    defaultZoom: 3,
    threatLevel: 'SUBSTANTIAL'
  },
  'Southeast Asia': {
    title: 'Southeast Asia',
    description: 'Southeast Asia Region',
    defaultCenter: [103.8, 1.12],
    defaultZoom: 3,
    threatLevel: 'SUBSTANTIAL'
  },
  'Indian Ocean': {
    title: 'Indian Ocean',
    description: 'Indian Ocean VRA/HRA',
    defaultCenter: [65, 12],
    defaultZoom: 3,
    threatLevel: 'SUBSTANTIAL'
  },
  'Americas': {
    title: 'Americas',
    description: 'Americas Region',
    defaultCenter: [-80, 10],
    defaultZoom: 3,
    threatLevel: 'MODERATE'
  },
  'Europe': {
    title: 'Europe',
    description: 'Europe/Black Sea Region',
    defaultCenter: [30, 45],
    defaultZoom: 3,
    threatLevel: 'MODERATE'
  }
};

const RegionalBrief = ({ incidents = [], latestIncidents = {}, currentRegion, start, end }) => {
  const region = REGIONS[currentRegion];
  if (!region) return null;

  const regionIncidents = incidents.filter(incident => 
    incident.incident?.fields?.region === currentRegion
  );
  
  const latestIncident = latestIncidents[currentRegion]?.incident?.fields;
  const displayIncidents = regionIncidents.length > 0 ? regionIncidents : (latestIncident ? [latestIncident] : []);

  const uniqueLocations = Array.from(
    new Set(
      [
        ...regionIncidents
          .map(incident => incident.incident?.fields?.location_name)
          .filter(Boolean),
  
        ...Object.values(latestIncidents)
          .map(region => region.incident?.fields?.location_name)
          .filter(Boolean)
      ]
    )
  );
  

  const mapIncidents = displayIncidents.map(incident => {
    const fields = incident.incident?.fields || incident;
    const incidentType = incident.incidentType?.fields?.name || 'unknown';
    return {
      latitude: parseFloat(fields.latitude),
      longitude: parseFloat(fields.longitude),
      title: fields.vessel_name || 'Unknown Vessel',
      description: fields.description,
      type: incidentType.toLowerCase()
    };
  }).filter(inc => inc.latitude && inc.longitude);

  // Get the region-specific monthly data or use a default if not found
  const monthlyData = regionalMonthlyData[currentRegion] || [
    { month: 'Aug', incidents: 0 },
    { month: 'Sep', incidents: 0 },
    { month: 'Oct', incidents: 0 },
    { month: 'Nov', incidents: 0 },
    { month: 'Dec', incidents: 0 },
    { month: 'Jan', incidents: 0 },
    { month: 'Feb', incidents: 0 },
    { month: 'Mar', incidents: 0 }
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Region Header */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{region.title}</h2>
            <p className="text-gray-600">{region.description}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
            ▲ {region.threatLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Status Notice */}
      {regionIncidents.length === 0 && latestIncident && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-700">
            No incidents reported during this period.
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Weekly Incidents</p>
          <p className="text-2xl font-bold text-gray-900">{regionIncidents.length}</p>
          <p className="text-xs text-orange-600">↑ 50% from last week</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">YTD Incidents</p>
          <p className="text-2xl font-bold text-gray-900">
          {new Set(incidents
            .filter(i => i.incident?.fields?.region === currentRegion)
            .filter(i => new Date(i.incident?.fields?.date_time_utc).getFullYear() === new Date().getFullYear())
          ).size}
          </p>
          <p className="text-xs text-green-600">↓ 15% from 2023</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Armed Incidents</p>
          <p className="text-2xl font-bold text-gray-900">
            {regionIncidents.filter(i => {
              const incidentType = i.incidentType?.fields?.name || '';
              return incidentType.includes('Armed');
            }).length}
          </p>
          <p className="text-xs text-gray-600">67% of weekly total</p>
        </div>
        {/* <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Vessels Affected</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Set(regionIncidents.map(i => i.vessel?.fields?.type)).size}
          </p>
        </div> */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">High-Risk Areas</p>
          {uniqueLocations.length > 0 ? (
    uniqueLocations.map((location, idx) => (
      <div key={idx} className="text-sm text-gray-800">{location}</div>
    ))
  ) : (
    <div className="text-sm text-gray-600">No active areas</div>
  )}
        </div>
      </div>

      {/* Recent Incidents Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h2>
        <MaritimeMap 
          incidents={mapIncidents}
          center={region.defaultCenter}
          zoom={region.defaultZoom}
        />
        <div className="mt-2 text-xs text-gray-500 flex justify-end gap-3">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Robbery
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-orange-500 mr-1"></span> Attack
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Military
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Other
          </span>
        </div>
      </div>

      {/* 6-Month Trend */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">6-Month Incident Type Breakdown</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="robberies" stroke="#ef4444" fill="#fecaca" />
              <Area type="monotone" dataKey="attacks" stroke="#86198f" fill="#e9d5ff" />
              <Area type="monotone" dataKey="boardings" stroke="#3b82f6" fill="#bfdbfe" />
              <Area type="monotone" dataKey="other" stroke="#059669" fill="#a7f3d0" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-gray-500 flex justify-center gap-3 flex-wrap">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Robberies
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-1"></span> Attacks
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Boardings
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Other
            </span>
          </div>
        </div>
      </div>

      {/* Incident Details */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Incident Details</h2>
        <div className="space-y-4">
          {displayIncidents.map((incident, idx) => {
            const fields = incident.incident?.fields || incident;
            const vesselFields = incident.vessel?.fields || {};
            const incidentType = incident.incidentType?.fields?.name || 'Unknown Type';
            
            return (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {vesselFields.name || fields.vessel_name || 'Unknown Vessel'}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {new Date(fields.date_time_utc).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{getFirstSentence(fields.description)}</p>
                <div className="flex gap-2">
                  {vesselFields.type && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {vesselFields.type}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {incidentType}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analysis Section */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis & Recommendations</h2>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>
                {regionIncidents.length > 0 
                  ? `${regionIncidents.length} incidents reported during this period`
                  : 'No incidents reported during this period'}
              </li>
              <li>
                {regionIncidents.filter(i => {
                  const incidentType = i.incidentType?.fields?.name || '';
                  return incidentType.includes('Armed');
                }).length > 0
                  ? 'Armed incidents indicate elevated threat level'
                  : 'No armed incidents reported'}
              </li>
              <li>Region maintains {region.threatLevel.toLowerCase()} threat level</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Recommendations</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Maintain vigilant watch when transiting high-risk areas</li>
              <li>Review and update vessel security plans as needed</li>
              <li>Ensure crew are briefed on latest regional threats</li>
              <li>Monitor regional alerts and advisories</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalBrief;
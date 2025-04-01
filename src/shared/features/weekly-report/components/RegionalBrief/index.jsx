import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import { getFirstSentence } from '@shared/features/weekly-report';
import { regionalMonthlyData, regionalStats } from '../../utils/report-data';
import { SharedMap, MAP_IDS, useMapManager } from '@shared/features/weekly-report/utils/map-manager';

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
  
  // First, check if we have any incidents that match the current region
  const regionIncidents = incidents.filter(incident => 
    incident.incident?.fields?.region === currentRegion
  );
  
  const latestIncident = latestIncidents[currentRegion];
  
  // This is what would match the IncidentDetails component's expectations
  const displayIncidents = regionIncidents.length > 0 ? regionIncidents : (latestIncident ? [latestIncident] : []);

  // Ensure incidents that happen on the final day of the reporting period are not marked as historical
  const isHistoricalIncident = (incident) => {
    // If we're showing latest incident because there are no current incidents, it's historical
    if (regionIncidents.length === 0 && incident === latestIncident) {
      return true;
    }
    
    // If the incident is in the current region's incidents list, it's not historical
    if (regionIncidents.includes(incident)) {
      return false;
    }
    
    return true;
  };

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
    try {
      // Use safe error handling
      if (!incident) {
        console.error('Incident is null or undefined');
        throw new Error('Incident is null');
      }
      
      // Get fields safely
      const fields = incident.incident?.fields || incident;
      if (!fields) {
        console.error('Fields is null or undefined');
        throw new Error('Fields is null');
      }
      
      // For vessel data, safely extract from the incident object
      const vesselFields = incident.vessel?.fields || {};
      
      // Use a consistent approach with IncidentDetails component
      let incidentType = 'Unknown';
      
      if (incident.incidentType && incident.incidentType.fields && incident.incidentType.fields.name) {
        incidentType = incident.incidentType.fields.name;
      } else {
        // Since we can't access it the same way as IncidentDetails, try using the title field as a fallback
        incidentType = fields.title || 'Unknown';
      }
      
      return {
        latitude: parseFloat(fields.latitude),
        longitude: parseFloat(fields.longitude),
        title: fields.title || 'Unknown Vessel',
        description: fields.description,
        // Keep original casing for better matching in map component
        type: incidentType
      };
    } catch (err) {
      console.error('Error processing map incident:', err);
      return {
        latitude: null,
        longitude: null,
        title: 'Error',
        description: 'Error processing incident',
        type: 'Unknown'
      };
    }
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
      {regionIncidents.length === 0 && (
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
          
          {/* Calculate the change percentage if possible */}
          {(regionalStats[currentRegion]?.lastWeekIncidents === 0 && regionIncidents.length === 0) && (
            <p className="text-xs text-gray-600">No change from last week</p>
          )}
          
          {(regionalStats[currentRegion]?.lastWeekIncidents === 0 && regionIncidents.length > 0) && (
            <p className="text-xs text-red-600">
              ↑ Up from 0 last week
            </p>
          )}
          
          {(regionalStats[currentRegion]?.lastWeekIncidents > 0 && regionIncidents.length === 0) && (
            <p className="text-xs text-green-600">
              ↓ Down from {regionalStats[currentRegion]?.lastWeekIncidents} last week
            </p>
          )}
          
          {(regionalStats[currentRegion]?.lastWeekIncidents > 0 && regionIncidents.length > 0) && (
            <p className={`text-xs ${regionIncidents.length > regionalStats[currentRegion]?.lastWeekIncidents ? 'text-red-600' : 
                                     regionIncidents.length < regionalStats[currentRegion]?.lastWeekIncidents ? 'text-green-600' : 
                                     'text-gray-600'}`}>
              {regionIncidents.length > regionalStats[currentRegion]?.lastWeekIncidents ? 
                `↑ Up from ${regionalStats[currentRegion]?.lastWeekIncidents} last week` : 
                regionIncidents.length < regionalStats[currentRegion]?.lastWeekIncidents ? 
                `↓ Down from ${regionalStats[currentRegion]?.lastWeekIncidents} last week` : 
                `No change from last week (${regionalStats[currentRegion]?.lastWeekIncidents})`}
            </p>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">YTD Incidents (2025)</p>
          <p className="text-2xl font-bold text-gray-900">
            {regionalStats[currentRegion]?.ytdIncidents || 0}
          </p>
          {regionalStats[currentRegion]?.changeDirection === "up" && (
            <p className="text-xs text-red-600">
              ↑ Up {regionalStats[currentRegion]?.changeFromLastYear}% from 2024 ({regionalStats[currentRegion]?.lastYearIncidents})
            </p>
          )}
          {regionalStats[currentRegion]?.changeDirection === "down" && (
            <p className="text-xs text-green-600">
              ↓ Down {regionalStats[currentRegion]?.changeFromLastYear}% from 2024 ({regionalStats[currentRegion]?.lastYearIncidents})
            </p>
          )}
          {regionalStats[currentRegion]?.changeDirection === "none" && (
            <p className="text-xs text-gray-600">
              No change ({regionalStats[currentRegion]?.lastYearIncidents} in 2024)
            </p>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Armed Incidents</p>
          <p className="text-2xl font-bold text-gray-900">
            {regionIncidents.filter(i => {
              // Check in both title and incident type
              const title = i.incident?.fields?.title || '';
              const incidentType = i.incidentType?.fields?.name || '';
              return title.includes('Armed') || incidentType.includes('Armed');
            }).length}
          </p>
          <p className="text-xs text-gray-600">
            {regionIncidents.length > 0 ? 
              Math.round((regionIncidents.filter(i => {
                // Check in both title and incident type
                const title = i.incident?.fields?.title || '';
                const incidentType = i.incidentType?.fields?.name || '';
                return title.includes('Armed') || incidentType.includes('Armed');
              }).length / regionIncidents.length) * 100) + "% of weekly total" 
              : "No weekly incidents"
            }
          </p>
        </div>
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
        <SharedMap 
          mapId={`region-${currentRegion.toLowerCase().replace(/\s+/g, '-')}`}
          incidents={mapIncidents}
          center={region.defaultCenter}
          zoom={region.defaultZoom}
          useClustering={true}
        />
        <div className="mt-2 text-xs text-gray-500 flex justify-end gap-3 flex-wrap">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Violent (Attack, Boarding)
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Robbery/Theft
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-purple-500 mr-1"></span> Military Activity
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-orange-500 mr-1"></span> Suspicious/Advisory
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-gray-500 mr-1"></span> Other
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
            try {
              // Safe error handling
              if (!incident) {
                console.error('Incident is null in details section');
                return null;
              }
              
              // Get fields safely
              const fields = incident.incident?.fields || incident;
              if (!fields) {
                console.error('Fields is null in details section');
                return null;
              }
              
              // Get vessel name from title or from vessel fields like in the map
              const vesselFields = incident.vessel?.fields || {};
              const vesselName = fields.title || vesselFields.name || 'Unknown Vessel';
              
              // Get vessel type from vessel fields
              const vesselType = vesselFields.type || null;
              
              // Use the same approach as in IncidentDetails component
              let incidentType = 'Unknown Type';
              
              if (incident.incidentType && incident.incidentType.fields && incident.incidentType.fields.name) {
                incidentType = incident.incidentType.fields.name;
              } else {
                // Fallback to using the title
                incidentType = fields.title || 'Unknown Type';
              }
              
              // Determine if this is a historical incident
              const historical = isHistoricalIncident(incident);
            
              return (
                <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                  {historical && (
                    <div className="mb-2 text-xs text-blue-700 bg-blue-50 p-1 rounded">
                      Historical incident - Most recent in this region
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {vesselName}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {new Date(fields.date_time_utc).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{getFirstSentence(fields.description)}</p>
                  <div className="flex gap-2">
                    {vesselType && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {vesselType}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {incidentType}
                    </span>
                  </div>
                </div>
              );
            } catch (err) {
              console.error('Error rendering incident detail:', err);
              return null;
            }
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
                  // Check in both title and incident type
                  const title = i.incident?.fields?.title || '';
                  const incidentType = i.incidentType?.fields?.name || '';
                  return title.includes('Armed') || incidentType.includes('Armed');
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
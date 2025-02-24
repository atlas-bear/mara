import React from 'react';
import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import _ from 'lodash';
import MaritimeMap from '@shared/components/MaritimeMap';
import { formatDateRange, getWeekNumber } from '@shared/features/weekly-report/utils/dates';
import { fetchAllHistoricalTrends } from '@shared/features/weekly-report/utils/trend-api';

// Sparkline component
const Sparkline = ({ data }) => (
  <ResponsiveContainer width="100%" height={20}>
    <LineChart data={data}>
      <Line
        type="monotone"
        dataKey="value"
        stroke="#6b7280"
        strokeWidth={1}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

// Utility function to calculate threat level based on incidents
const calculateThreatLevel = (incidents) => {
  // Count serious incidents (attacks, armed robberies, military activity)
  const seriousIncidents = incidents.filter(inc => {
    const incidentType = inc.incidentType?.fields?.name;
    const description = inc.incident.fields.description?.toLowerCase() || '';
    return (
      incidentType === 'Attack' ||
      (incidentType === 'Robbery' && description.includes('armed')) ||
      incidentType === 'Military Activity'
    );
  }).length;
  
  if (seriousIncidents >= 5) return { level: 'Critical', icon: '⚠⚠', class: 'bg-red-100 text-red-800' };
  if (seriousIncidents >= 3) return { level: 'Severe', icon: '⚠', class: 'bg-rose-100 text-rose-800' };
  if (seriousIncidents >= 2) return { level: 'Substantial', icon: '▲', class: 'bg-orange-100 text-orange-800' };
  if (seriousIncidents >= 1) return { level: 'Moderate', icon: '►', class: 'bg-yellow-100 text-yellow-800' };
  return { level: 'Low', icon: '●', class: 'bg-green-100 text-green-800' };
};

// Utility function to identify key developments
const identifyKeyDevelopments = (incidents) => {
  return incidents
    .filter(inc => {
      const description = inc.incident.fields.description?.toLowerCase() || '';
      const incidentType = inc.incidentType?.fields?.name;
      return (
        incidentType === 'Attack' ||
        (incidentType === 'Robbery' && description.includes('armed')) ||
        description.includes('killed') ||
        description.includes('injured') ||
        description.includes('damage') ||
        incidentType === 'Military Activity'
      );
    })
    .sort((a, b) => new Date(b.incident.fields.date_time_utc) - new Date(a.incident.fields.date_time_utc))
    .slice(0, 4);
};

const ExecutiveBrief = ({ incidents, start, end }) => {
  // Transform incidents for map
  const mapIncidents = incidents.map(inc => ({
    latitude: inc.incident.fields.latitude,
    longitude: inc.incident.fields.longitude,
    title: inc.incident.fields.title,
    description: inc.incident.fields.description,
    type: (inc.incidentType?.fields?.name || 'unknown').toLowerCase()
  }));

  // Group incidents by region
  const regionData = _.groupBy(incidents, inc => inc.incident.fields.region);
  
  // Calculate regional stats and trends
  const regionalStats = Object.entries(regionData).map(([region, regionIncidents]) => {
    const threatLevel = calculateThreatLevel(regionIncidents);
    
    const [historicalTrends, setHistoricalTrends] = useState({});

  useEffect(() => {
    const loadTrends = async () => {
      const trends = await fetchAllHistoricalTrends();
      setHistoricalTrends(trends);
    };
    loadTrends();
  }, []);

  // Use historical trends if available, otherwise use current week data
  const trend = historicalTrends[region] || Array.from({ length: 8 }, (_, i) => ({
    week: -(8-i),
    value: 0
  }));

    return {
      region,
      threatLevel,
      incidents: regionIncidents.length,
      trend
    };
  });

  // Identify key developments
  const keyDevelopments = identifyKeyDevelopments(incidents);

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Title Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-baseline">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Maritime Security Executive Brief
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Week {getWeekNumber(new Date(start))} ({formatDateRange(start, end)})
          </p>
        </div>
      </div>

      {/* Active Incidents Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Active Incidents
        </h2>
        <MaritimeMap 
          incidents={mapIncidents}
          center={[40, 20]}
          zoom={1}
        />
        <div className="mt-2 text-xs text-gray-500 flex justify-end gap-3">
          {/* Only show incident types that are present on the map */}
          {[...new Set(mapIncidents.map(inc => inc.type))].map(type => (
            <span key={type} className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-1 ${
                type === 'robbery' ? 'bg-red-500' :
                type === 'attack' ? 'bg-orange-500' :
                type === 'military' ? 'bg-blue-500' : 'bg-gray-500'
              }`}></span>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* Threat Level Legend */}
      <div className="px-6 pt-4 flex flex-wrap gap-2 text-sm">
        <span className="font-semibold text-gray-700">Threat Levels:</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
          ⚠⚠ Critical
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-rose-100 text-rose-800">
          ⚠ Severe
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
          ▲ Substantial
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          ► Moderate
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
          ● Low
        </span>
      </div>

      {/* Global Threat Overview Table */}
      <div className="p-6 border-b border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">Region</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">Threat Level</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">Incidents</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">8-Week Trend</th>
              </tr>
            </thead>
            <tbody>
              {regionalStats.map(({ region, threatLevel, incidents, trend }) => (
                <tr key={region} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border">{region}</td>
                  <td className="px-4 py-3 border">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${threatLevel.class}`}>
                      {threatLevel.icon} {threatLevel.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center border">{incidents}</td>
                  <td className="px-4 py-3 border">
                    <div className="h-5">
                      <Sparkline data={trend} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Developments */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Key Developments</h2>
        <ul className="space-y-4">
          {keyDevelopments.map((inc, index) => (
            <li key={index} className="flex items-start">
              <span className={`flex-shrink-0 h-5 w-5 ${
                inc.incidentType?.fields?.name === 'Attack' ? 'text-red-600' :
                inc.incidentType?.fields?.name === 'Robbery' ? 'text-orange-600' :
                'text-blue-600'
              }`}>●</span>
              <span className="ml-2 text-gray-700">
                <strong>{inc.incident.fields.region}:</strong> {inc.incident.fields.description}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 7-Day Forecast */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">7-Day Forecast</h2>
        <ul className="space-y-4">
          {regionalStats.map(({ region, threatLevel, trend }) => {
            const trendDirection = trend[trend.length - 1].value > trend[0].value ? '↗' :
                                 trend[trend.length - 1].value < trend[0].value ? '↘' : '→';
            return (
              <li key={region} className="flex items-start">
                <span className={`flex-shrink-0 h-5 w-5 ${
                  threatLevel.level === 'Critical' ? 'text-red-600' :
                  threatLevel.level === 'Severe' ? 'text-rose-600' :
                  threatLevel.level === 'Substantial' ? 'text-orange-600' :
                  'text-yellow-600'
                }`}>{trendDirection}</span>
                <span className="ml-2 text-gray-700">
                  <strong>{region}:</strong> {generateForecast(region, threatLevel, trend)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// Utility function to generate forecast text
const generateForecast = (region, threatLevel, trend) => {
  const trendValue = trend[trend.length - 1].value - trend[0].value;
  const trendDescription = trendValue > 0 ? 'increasing' : trendValue < 0 ? 'decreasing' : 'stable';
  
  return `Incident rate ${trendDescription}. Maintain ${threatLevel.level.toLowerCase()} level precautions.`;
};

export default ExecutiveBrief;
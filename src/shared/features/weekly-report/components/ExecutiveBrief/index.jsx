import React from 'react';
import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import _ from 'lodash';
import MaritimeMap from '@shared/components/MaritimeMap';
import { formatDateRange, getYearWeek } from '@shared/features/weekly-report/utils/dates';
import { fetchAllHistoricalTrends } from '@shared/features/weekly-report/utils/trend-api';
import { fetchWeeklyReportContent } from '@shared/features/weekly-report/utils/client-api';

// Color mappings for key development levels
const LEVEL_COLORS = {
  red: 'text-red-600',
  orange: 'text-orange-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600'
};

// Icon mappings for forecast trends
const TREND_ICONS = {
  up: '↗',
  down: '↘',
  stable: '→'
};

/**
 * Simple sparkline chart for displaying trending data
 * 
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.data - Array of data points with value property
 * @returns {JSX.Element} Sparkline chart
 */
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

/**
 * Calculates threat level based on incident types and descriptions
 * 
 * @param {Array<Object>} incidents - Array of incident objects
 * @returns {Object} Threat level object with level name, icon, and CSS class
 */
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

/**
 * Identifies key significant incidents to highlight in the executive brief
 * 
 * @param {Array<Object>} incidents - Array of incident objects
 * @returns {Array<Object>} Array of significant incidents sorted by date
 */
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

/**
 * Executive Brief component displaying a summary of maritime security incidents
 * 
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.incidents - Array of incident objects
 * @param {Date} props.start - Start date of the reporting period
 * @param {Date} props.end - End date of the reporting period
 * @param {string} [props.yearWeek] - Year-week string in format "YYYY-WW" (e.g., "2025-12")
 * @returns {JSX.Element} Executive brief component
 */
const ExecutiveBrief = ({ incidents, start, end, yearWeek }) => {
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
  
  const [historicalTrends, setHistoricalTrends] = useState({});
  const [generatedContent, setGeneratedContent] = useState({
    keyDevelopments: [],
    forecast: []
  });
  const [contentLoading, setContentLoading] = useState(true);
  
  // Using the client-safe API function imported at the top
  
  // Fetch trends and generated content
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load trends
        const trends = await fetchAllHistoricalTrends();
        setHistoricalTrends(trends);
        
        // Only fetch content if start and end dates are valid
        if (start && end) {
          setContentLoading(true);
          
          // Use the client-safe API wrapper
          const data = await fetchWeeklyReportContent(start, end);
          if (data) {
            setGeneratedContent(data);
          }
        }
      } catch (error) {
        console.error("Error loading weekly report content:", error);
      } finally {
        setContentLoading(false);
      }
    };
    
    loadData();
  }, [start, end]);
  
  // Calculate regional stats and trends
  const regionalStats = Object.entries(regionData).map(([region, regionIncidents]) => {
    // Override threat levels for Southeast Asia and Indian Ocean to "Substantial"
    let threatLevel;
    if (region === "Southeast Asia" || region === "Indian Ocean" || region === "West Africa") {
      threatLevel = { level: 'Substantial', icon: '▲', class: 'bg-orange-100 text-orange-800' };
    } else {
      threatLevel = calculateThreatLevel(regionIncidents);
    }

    // Use historical trends if available, otherwise use current month data
    const trend = historicalTrends[region] || Array.from({ length: 6 }, (_, i) => ({
      month: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"][i],
      value: 0
    }));

    return {
      region,
      threatLevel,
      incidents: regionIncidents.length,
      trend
    };
  });

  // Use automated content if available, otherwise fall back to algorithm
  const keyDevelopments = generatedContent.keyDevelopments?.length > 0 
    ? generatedContent.keyDevelopments 
    : identifyKeyDevelopments(incidents).map(inc => ({
        region: inc.incident.fields.region,
        level: 'orange',
        content: `${inc.incident.fields.title}: ${inc.incident.fields.description?.substring(0, 100)}...`
      }));

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Title Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-baseline">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Executive Brief
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Week {yearWeek ? yearWeek.split('-')[1] : getYearWeek(new Date(start)).week} ({formatDateRange(start, end)})
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

      {/* Only show Threat Level Legend and Global Threat Overview Table if there's at least one region with incidents */}
      {regionalStats.some(stat => stat.incidents > 0) ? (
        <>
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
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">6-Month Trend</th>
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
        </>
      ) : (
        <div className="p-6 border-b border-gray-200">
          <p className="text-sm text-gray-600 italic text-center">No incidents reported during this period.</p>
        </div>
      )}

      {/* Key Developments */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Key Developments</h2>
        {contentLoading ? (
          <p className="text-gray-500 italic">Loading key developments...</p>
        ) : (
          <ul className="space-y-4">
            {keyDevelopments.map((dev, index) => (
              <li key={index} className="flex items-start">
                <span className={`flex-shrink-0 h-5 w-5 ${LEVEL_COLORS[dev.level] || 'text-blue-600'}`}>●</span>
                <span className="ml-2 text-gray-700">
                  <strong>{dev.region}:</strong> {dev.content}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 7-Day Forecast */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">7-Day Forecast</h2>
        {contentLoading ? (
          <p className="text-gray-500 italic">Loading forecast data...</p>
        ) : (
          <ul className="space-y-4">
            {generatedContent.forecast?.length > 0 ? (
              generatedContent.forecast.map((forecast, index) => (
                <li key={index} className="flex items-start">
                  <span className={`flex-shrink-0 h-5 w-5 ${
                    forecast.trend === 'up' ? 'text-red-600' : 
                    forecast.trend === 'down' ? 'text-green-600' : 
                    'text-orange-600'
                  }`}>
                    {TREND_ICONS[forecast.trend] || '→'}
                  </span>
                  <span className="ml-2 text-gray-700">
                    <strong>{forecast.region}:</strong> {forecast.content}
                  </span>
                </li>
              ))
            ) : (
              // Fallback content if no forecast is available
              <>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-5 w-5 text-orange-600">→</span>
                  <span className="ml-2 text-gray-700">
                    <strong>Indian Ocean:</strong> Maintain heightened vigilance. Follow official maritime advisories for the Red Sea and Gulf of Aden.
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-5 w-5 text-orange-600">→</span>
                  <span className="ml-2 text-gray-700">
                    <strong>Southeast Asia:</strong> Exercise caution in the Singapore Strait. Report suspicious activity promptly to authorities.
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 h-5 w-5 text-orange-600">→</span>
                  <span className="ml-2 text-gray-700">
                    <strong>West Africa:</strong> Follow BMP West Africa guidelines. Maintain watch and report all suspicious activity to MDAT-GoG.
                  </span>
                </li>
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Generates forecast text based on region, threat level, and trend data
 * 
 * @param {string} region - Region name
 * @param {Object} threatLevel - Threat level object with level property
 * @param {Array<Object>} trend - Array of trend data points
 * @returns {string} Forecast text for the region
 */
const generateForecast = (region, threatLevel, trend) => {
  const trendValue = trend[trend.length - 1].value - trend[0].value;
  const trendDescription = trendValue > 0 ? 'increasing' : trendValue < 0 ? 'decreasing' : 'stable';
  
  return `Incident rate ${trendDescription}. Maintain ${threatLevel.level.toLowerCase()} level precautions.`;
};

export default ExecutiveBrief;
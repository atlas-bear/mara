import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import ExecutiveBrief from './components/ExecutiveBrief'
import RegionalBrief from './components/RegionalBrief'
import IncidentDetails from './components/IncidentDetails'
import { getReportingWeek, formatDateRange } from './utils/dates'
import { fetchWeeklyIncidents } from './utils/api'

// Define regions with their display properties
const REGIONS = {
  'West Africa': {
    id: 'West Africa',
    title: 'West Africa',
    description: 'West African VRA/HRA',
    defaultCenter: [1, 4],
    defaultZoom: 5,
    threatLevel: 'SUBSTANTIAL'
  },
  'Southeast Asia': {
    id: 'Southeast Asia',
    title: 'Southeast Asia',
    description: 'Southeast Asia Region',
    defaultCenter: [103.8, 1.12],
    defaultZoom: 8,
    threatLevel: 'SUBSTANTIAL'
  },
  'Indian Ocean': {
    id: 'Indian Ocean',
    title: 'Indian Ocean',
    description: 'Indian Ocean VRA/HRA',
    defaultCenter: [65, 12],
    defaultZoom: 5,
    threatLevel: 'SUBSTANTIAL'
  },
  'Americas': {
    id: 'Americas',
    title: 'Americas',
    description: 'Americas Region',
    defaultCenter: [-80, 10],
    defaultZoom: 4,
    threatLevel: 'MODERATE'
  },
  'Europe': {
    id: 'Europe',
    title: 'Europe',
    description: 'Europe/Black Sea Region',
    defaultCenter: [30, 45],
    defaultZoom: 6,
    threatLevel: 'MODERATE'
  }
};

// Define region display order
const REGION_ORDER = [
  'West Africa',
  'Southeast Asia',
  'Indian Ocean',
  'Americas',
  'Europe'
];

function App() {
  const { yearWeek } = useParams();
  const [incidents, setIncidents] = useState([]);
  const [latestIncidents, setLatestIncidents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For testing, use week 6 of 2025
  const testYearWeek = '2025-06';
  const activeYearWeek = yearWeek || testYearWeek;

  // Memoize date calculations
  const { start, end } = useMemo(() => {
    if (!activeYearWeek) return {};
    const [year, week] = activeYearWeek.split('-').map(n => parseInt(n, 10));
    return getReportingWeek(year, week);
  }, [activeYearWeek]);

  useEffect(() => {
    if (!start || !end) return;

    let mounted = true;
    
    const fetchData = async () => {
      try {
        console.log('Fetching data for:', { start, end });
        const response = await fetchWeeklyIncidents(start, end);
        
        console.log('API Response:', response);

        if (!response || !response.incidents) {
          throw new Error('No incidents data in response');
        }

        if (mounted) {
          setIncidents(response.incidents);
          if (response.latestIncidents) {
            setLatestIncidents(response.latestIncidents);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching incidents:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [start, end]);

  if (!yearWeek) {
    return <Navigate to={`/weekly-report/${testYearWeek}`} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-4xl mx-auto text-red-600">Error: {error}</div>
      </div>
    );
  }

  // Group incidents by region
  const incidentsByRegion = {};
  incidents.forEach(incident => {
    const region = incident.incident.fields.region;
    if (!incidentsByRegion[region]) {
      incidentsByRegion[region] = [];
    }
    incidentsByRegion[region].push(incident);
  });

  console.log('Incidents by region:', incidentsByRegion);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Weekly Maritime Security Report
        </h1>
        <p className="text-gray-600">
          {formatDateRange(start, end)}
        </p>
      </div>
      
      <ExecutiveBrief 
        incidents={incidents} 
        start={start} 
        end={end} 
      />

      {/* Display each region in order */}
      {REGION_ORDER.map(region => {
        const regionIncidents = incidentsByRegion[region] || [];
        const latestRegionIncident = latestIncidents[region];

        return (
          <div key={region}>
            {/* Regional Brief Section */}
            <RegionalBrief 
              incidents={regionIncidents}
              latestIncidents={{ [region]: latestRegionIncident }}
              currentRegion={region}
              start={start} 
              end={end}
            />

            {/* Display incidents for this region */}
            {regionIncidents.map(incident => (
              <IncidentDetails 
                key={incident.incident.id}
                incident={incident}
              />
            ))}

            {/* Show latest incident if no current incidents */}
            {regionIncidents.length === 0 && latestRegionIncident && (
              <IncidentDetails 
                incident={latestRegionIncident}
                isHistorical={true}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
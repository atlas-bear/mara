import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { 
  ExecutiveBrief, 
  RegionalBrief, 
  IncidentDetails,
  getReportingWeek,
  formatDateRange,
  fetchWeeklyIncidents
} from '@shared/features/weekly-report';

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

function WeeklyReportPage() {
  const { yearWeek } = useParams();
  const [incidents, setIncidents] = useState([]);
  const [latestIncidents, setLatestIncidents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'MARA Weekly Report';
  }, []);

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
        <div className="max-w-4xl mx-auto p-4">
          {/* Executive Brief Skeleton */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-8">
            <Skeleton height={40} width={300} className="mb-4" />
            <Skeleton count={3} className="mb-2" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </div>
          </div>
          
          {/* Regional Briefs Skeleton */}
          {Array(3).fill().map((_, index) => (
            <div key={index} className="bg-white shadow-md rounded-lg p-6 mb-8">
              <Skeleton height={30} width={200} className="mb-4" />
              <Skeleton count={2} className="mb-4" />
              <div className="mt-4">
                <Skeleton height={200} className="mb-4" />
                <Skeleton count={3} className="mb-2" />
              </div>
            </div>
          ))}
        </div>
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
        
        <ExecutiveBrief 
          incidents={incidents} 
          start={start} 
          end={end}
          yearWeek={activeYearWeek} // Pass the year-week from URL
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
                showHistoricalContext={false}
                startDate={start}
                endDate={end}
              />
            ))}

            {/* Show latest incident if no current incidents */}
            {regionIncidents.length === 0 && latestRegionIncident && (
              <IncidentDetails 
                incident={latestRegionIncident}
                isHistorical={true}
                showHistoricalContext={false}
                startDate={start}
                endDate={end}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WeeklyReportPage;
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { 
  ExecutiveBrief, 
  RegionalBrief, 
  IncidentDetails,
  getReportingWeek,
  formatDateRange,
  fetchWeeklyIncidents
} from '@shared/features/weekly-report';
import '@shared/components/print-styles.css';

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

function WeeklyReport() {
  const { yearWeek } = useParams();
  const location = useLocation();
  const [incidents, setIncidents] = useState([]);
  const [latestIncidents, setLatestIncidents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Check if in print mode
  const isPrintMode = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('print') === 'true';
  }, [location.search]);
  
  // Set basic title immediately
  useEffect(() => {
    document.title = 'MARA Weekly Report';
  }, []);

  // Update title and print mode when data is available
  useEffect(() => {
    // Only update title if both start and end are available
    if (start && end) {
      try {
        const dateRange = formatDateRange(start, end);
        document.title = `MARA Report ${dateRange}`;
      } catch (err) {
        console.error('Error formatting date range for title:', err);
      }
    }
  }, [start, end]);
  
  // Handle print mode separately
  useEffect(() => {
    if (isPrintMode) {
      document.body.classList.add('print-mode');
    } else {
      document.body.classList.remove('print-mode');
    }
    
    return () => {
      document.body.classList.remove('print-mode');
    };
  }, [isPrintMode]);

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
        console.log("Debug before API call:", typeof start, start, typeof end, end);

        console.log('Year-Week:', activeYearWeek);
        console.log('Parsed dates:', {
          start: start.toISOString(),
          end: end.toISOString(),
          startDay: start.getDay(),
          endDay: end.getDay()
        });

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

  // Only log incident data in non-print mode
  if (!isPrintMode) {
    console.log('Incidents by region:', incidentsByRegion);
  }

  const reportHeaderClass = isPrintMode ? "py-4 flex justify-center items-center mb-8" : "hidden";
  
  return (
    <div className={`${isPrintMode ? 'bg-white' : 'min-h-screen bg-gray-100'} py-8`}>
      
      {/* Print-only header */}
      <div className={reportHeaderClass}>
        <h1 className="text-2xl font-bold text-center">
          MARA Maritime Security Report
          <br />
          <span className="text-xl">{formatDateRange(start, end)}</span>
        </h1>
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
          <div key={region} className="regional-section mb-8">
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

export default WeeklyReport;
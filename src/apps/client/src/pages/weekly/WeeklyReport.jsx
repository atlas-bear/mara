import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { 
  ExecutiveBrief, 
  RegionalBrief, 
  IncidentDetails,
  getReportingWeek,
  formatDateRange,
  fetchWeeklyIncidents
} from '@shared/features/weekly-report';
import '@shared/components/print-styles.css';
import { useBranding } from '../../hooks/useBranding';

// Define regions with their display properties
const REGIONS = {
  'West Africa': {
    id: 'West Africa',
    title: 'West Africa',
    description: 'West African VRA/HRA',
    defaultCenter: [1, 4],
    defaultZoom: 3,
    threatLevel: 'SUBSTANTIAL'
  },
  'Southeast Asia': {
    id: 'Southeast Asia',
    title: 'Southeast Asia',
    description: 'Southeast Asia Region',
    defaultCenter: [103.8, 1.12],
    defaultZoom: 3,
    threatLevel: 'SUBSTANTIAL'
  },
  'Indian Ocean': {
    id: 'Indian Ocean',
    title: 'Indian Ocean',
    description: 'Indian Ocean VRA/HRA',
    defaultCenter: [65, 12],
    defaultZoom: 3,
    threatLevel: 'SUBSTANTIAL'
  },
  'Americas': {
    id: 'Americas',
    title: 'Americas',
    description: 'Americas Region',
    defaultCenter: [-80, 10],
    defaultZoom: 3,
    threatLevel: 'MODERATE'
  },
  'Europe': {
    id: 'Europe',
    title: 'Europe',
    description: 'Europe/Black Sea Region',
    defaultCenter: [30, 45],
    defaultZoom: 3,
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
  const [incidents, setIncidents] = useState([]);
  const [latestIncidents, setLatestIncidents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { branding } = useBranding();

  const [searchParams] = useSearchParams();
  const isPrintMode = searchParams.get('print') === 'true';
  
  useEffect(() => {
    // Use client branding in the page title instead of hardcoded "MARA"
    document.title = `${branding.companyName} Weekly Report`;
    
    // Apply print mode class if needed
    if (isPrintMode) {
      document.documentElement.classList.add('print-mode');
      // Auto-trigger print dialog after content loads
      const timer = setTimeout(() => {
        window.print();
      }, 3000); // Wait for maps and charts to render
      
      return () => {
        clearTimeout(timer);
        document.documentElement.classList.remove('print-mode');
      };
    }
  }, [isPrintMode, branding.companyName]);

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

  console.log('Incidents by region:', incidentsByRegion);

  return (
    <div className={`min-h-screen bg-gray-100 py-8 ${isPrintMode ? 'print-mode' : ''}`}>
      <div className="content-container max-w-4xl mx-auto">
        {/* Cover section only visible in screen mode, not in PDF */}
        <div className="pdf-cover page-break-after mb-8 no-print">
          <h1 className="text-3xl font-bold text-center mb-4">
            Weekly Maritime Security Report
          </h1>
        </div>
        
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
              <div className="incidents-container">
                {regionIncidents.map(incident => (
                  <IncidentDetails 
                    key={incident.incident.id}
                    incident={incident}
                    showHistoricalContext={false}
                  />
                ))}

                {/* Show latest incident if no current incidents */}
                {regionIncidents.length === 0 && latestRegionIncident && (
                  <IncidentDetails 
                    incident={latestRegionIncident}
                    isHistorical={true}
                    showHistoricalContext={false}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyReport;
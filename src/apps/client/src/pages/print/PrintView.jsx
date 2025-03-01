import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ExecutiveBrief, 
  RegionalBrief, 
  IncidentDetails,
  getReportingWeek,
  formatDateRange,
  fetchWeeklyIncidents
} from '@shared/features/weekly-report';
import '@shared/components/print-styles.css';

// Define regions with their display properties - same as in WeeklyReport
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

// PrintView is optimized specifically for printing
export default function PrintView() {
  const { yearWeek } = useParams();
  const [incidents, setIncidents] = useState([]);
  const [latestIncidents, setLatestIncidents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('');
  
  // Basic page title
  useEffect(() => {
    document.title = 'MARA Report for Printing';
    
    // Automatically open print dialog when everything is loaded
    const timer = setTimeout(() => {
      if (!loading && !error) {
        window.print();
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [loading, error]);
  
  useEffect(() => {
    if (!yearWeek) return;
    
    // Process the yearWeek parameter
    try {
      const [year, week] = yearWeek.split('-').map(n => parseInt(n, 10));
      const { start, end } = getReportingWeek(year, week);
      
      if (start && end) {
        setDateRange(formatDateRange(start, end));
        document.title = `MARA Report ${formatDateRange(start, end)}`;
        
        // Fetch data for this period
        fetchWeeklyIncidents(start, end)
          .then(response => {
            if (response && response.incidents) {
              setIncidents(response.incidents);
              if (response.latestIncidents) {
                setLatestIncidents(response.latestIncidents);
              }
            } else {
              throw new Error('Invalid data response');
            }
          })
          .catch(err => {
            console.error('Error fetching print data:', err);
            setError(err.message);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } catch (err) {
      console.error('Error processing dates:', err);
      setError('Invalid report period');
      setLoading(false);
    }
  }, [yearWeek]);
  
  if (loading) {
    return (
      <div className="print-loading">
        <h1>Loading report data...</h1>
        <p>Please wait while we prepare your report for printing.</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="print-error">
        <h1>Error Loading Report</h1>
        <p>Sorry, we couldn't load the report data: {error}</p>
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
  
  return (
    <div className="print-container bg-white py-8">
      {/* Report header */}
      <div className="py-4 flex justify-center items-center mb-8">
        <h1 className="text-2xl font-bold text-center">
          MARA Maritime Security Report
          <br />
          <span className="text-xl">{dateRange}</span>
        </h1>
      </div>
      
      {/* Executive Brief */}
      <ExecutiveBrief 
        incidents={incidents} 
        start={new Date()} // Placeholder - the component will handle undefined dates
        end={new Date()} 
      />

      {/* Regional sections */}
      {REGION_ORDER.map(region => {
        const regionIncidents = incidentsByRegion[region] || [];
        const latestRegionIncident = latestIncidents[region];
        
        if (!regionIncidents.length && !latestRegionIncident) return null;

        return (
          <div key={region} className="regional-section mb-8">
            {/* Regional Brief Section */}
            <RegionalBrief 
              incidents={regionIncidents}
              latestIncidents={{ [region]: latestRegionIncident }}
              currentRegion={region}
              start={new Date()}
              end={new Date()}
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
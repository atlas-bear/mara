import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import ExecutiveBrief from './components/ExecutiveBrief'
import RegionalBrief from './components/RegionalBrief'
import IncidentDetails from './components/IncidentDetails'
import { getReportingWeek, formatDateRange } from './utils/dates'
import { fetchWeeklyIncidents } from './utils/api'

function App() {
  const { yearWeek } = useParams();
  const [incidents, setIncidents] = useState([]);
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
        
        if (!response || !response.incidents) {
          throw new Error('No incidents data in response');
        }

        if (mounted) {
          setIncidents(response.incidents);
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
      
      <ExecutiveBrief incidents={incidents} start={start} end={end} />
      <RegionalBrief incidents={incidents} start={start} end={end} />
      
      {/* Map over all incidents to show their details */}
      {incidents.map(incident => (
        <IncidentDetails 
          key={incident.incident.fields.id} 
          incidentId={incident.incident.fields.id} 
        />
      ))}
    </div>
  );
}

export default App;
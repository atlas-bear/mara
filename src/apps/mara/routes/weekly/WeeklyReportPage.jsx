import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { 
  ExecutiveBrief, 
  RegionalBrief, 
  IncidentDetails,
  getReportingWeek,
  formatDateRange,
  fetchWeeklyIncidents,
  fetchWeeklyReportContent,
  exportWeeklyReport,
  getSubscriptionPreferences,
  updateSubscriptionPreferences
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
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [latestIncidents, setLatestIncidents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [reportContent, setReportContent] = useState(null);

  useEffect(() => {
    document.title = 'MARA Weekly Report';
    
    // Load subscription preferences
    const loadPreferences = async () => {
      try {
        const prefs = await getSubscriptionPreferences();
        setSubscribed(prefs.weekly_report_email || false);
      } catch (err) {
        console.error('Error loading preferences:', err);
      }
    };
    
    loadPreferences();
  }, []);

  // For testing, use week 6 of 2025
  const testYearWeek = '2025-06';
  const activeYearWeek = yearWeek || testYearWeek;

  // Memoize date calculations
  const { start, end, previousWeek, nextWeek } = useMemo(() => {
    if (!activeYearWeek) return {};
    const [year, week] = activeYearWeek.split('-').map(n => parseInt(n, 10));
    const dates = getReportingWeek(year, week);
    
    // Calculate previous week
    const prevDate = new Date(dates.start);
    prevDate.setDate(prevDate.getDate() - 7);
    const prevYearWeek = `${prevDate.getFullYear()}-${String(Math.ceil(prevDate.getDate() / 7)).padStart(2, '0')}`;
    
    // Calculate next week (only if not current week)
    const now = new Date();
    const nextDate = new Date(dates.end);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextYearWeek = nextDate <= now ? 
      `${nextDate.getFullYear()}-${String(Math.ceil(nextDate.getDate() / 7)).padStart(2, '0')}` : 
      null;

    return {
      ...dates,
      previousWeek: prevYearWeek,
      nextWeek: nextYearWeek
    };
  }, [activeYearWeek]);

  useEffect(() => {
    if (!start || !end) return;

    let mounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch incidents and report content in parallel
        const [incidentsResponse, contentResponse] = await Promise.all([
          fetchWeeklyIncidents(start, end),
          fetchWeeklyReportContent(start, end)
        ]);
        
        if (!mounted) return;

        if (!incidentsResponse || !incidentsResponse.incidents) {
          throw new Error('No incidents data in response');
        }

        setIncidents(incidentsResponse.incidents);
        if (incidentsResponse.latestIncidents) {
          setLatestIncidents(incidentsResponse.latestIncidents);
        }
        setReportContent(contentResponse);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [start, end]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const pdfBlob = await exportWeeklyReport(activeYearWeek);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MARA-Weekly-Report-${activeYearWeek}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting report:', err);
      setError('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleSubscriptionToggle = async () => {
    try {
      const newPrefs = await updateSubscriptionPreferences({
        weekly_report_email: !subscribed
      });
      setSubscribed(newPrefs.weekly_report_email);
    } catch (err) {
      console.error('Error updating subscription:', err);
      setError('Failed to update subscription. Please try again.');
    }
  };

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
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading report</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="mt-4 bg-red-100 text-red-800 px-4 py-2 rounded-md text-sm hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
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
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation and Controls */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex space-x-4">
            {previousWeek && (
              <button
                onClick={() => navigate(`/weekly-report/${previousWeek}`)}
                className="bg-white px-4 py-2 rounded-md shadow hover:bg-gray-50"
              >
                ← Previous Week
              </button>
            )}
            {nextWeek && (
              <button
                onClick={() => navigate(`/weekly-report/${nextWeek}`)}
                className="bg-white px-4 py-2 rounded-md shadow hover:bg-gray-50"
              >
                Next Week →
              </button>
            )}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleSubscriptionToggle}
              className={`px-4 py-2 rounded-md shadow ${
                subscribed 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              {subscribed ? 'Subscribed ✓' : 'Subscribe to Updates'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>
        
        <ExecutiveBrief 
          incidents={incidents} 
          start={start} 
          end={end}
          yearWeek={activeYearWeek}
          reportContent={reportContent}
        />

        {/* Display each region in order */}
        {REGION_ORDER.map(region => {
          const regionIncidents = incidentsByRegion[region] || [];
          const latestRegionIncident = latestIncidents[region];

          return (
            <div key={region} className="mb-8">
              {/* Regional Brief Section */}
              <RegionalBrief 
                incidents={regionIncidents}
                latestIncidents={{ [region]: latestRegionIncident }}
                currentRegion={region}
                start={start} 
                end={end}
              />

              {/* Display incidents for this region */}
              <div className="space-y-4">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyReportPage;

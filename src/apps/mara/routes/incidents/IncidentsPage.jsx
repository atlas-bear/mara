import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

function IncidentsPage() {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    source: 'all',
    severity: 'all',
    dateRange: '30days'
  });

  // Mock data - replace with actual API calls
  const [incidents] = useState([
    {
      id: '2024-2662',
      title: 'Vessel Hijacking - Gulf of Aden',
      source: 'UKMTO',
      severity: 'high',
      date: '2024-12-15',
      location: 'Gulf of Aden',
      status: 'resolved',
      description: 'Commercial vessel reported hijacking attempt by armed pirates'
    },
    {
      id: '2024-2661',
      title: 'Suspicious Approach - Red Sea',
      source: 'MDAT',
      severity: 'medium',
      date: '2024-12-14',
      location: 'Red Sea',
      status: 'monitoring',
      description: 'Multiple small boats approached merchant vessel at high speed'
    },
    {
      id: '2024-2660',
      title: 'Armed Robbery - Singapore Strait',
      source: 'RECAAP',
      severity: 'high',
      date: '2024-12-13',
      location: 'Singapore Strait',
      status: 'resolved',
      description: 'Armed robbery of ship supplies while vessel was anchored'
    },
    {
      id: '2024-2659',
      title: 'Drone Activity - Persian Gulf',
      source: 'UKMTO',
      severity: 'low',
      date: '2024-12-12',
      location: 'Persian Gulf',
      status: 'monitoring',
      description: 'Unidentified drone observed near commercial shipping lane'
    },
    {
      id: '2024-2658',
      title: 'Vessel Detention - Strait of Hormuz',
      source: 'ICC',
      severity: 'high',
      date: '2024-12-11',
      location: 'Strait of Hormuz',
      status: 'active',
      description: 'Commercial vessel detained by naval forces for inspection'
    }
  ]);

  useEffect(() => {
    document.title = 'MARA - Incident Search';
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = selectedFilters.source === 'all' || incident.source === selectedFilters.source;
    const matchesSeverity = selectedFilters.severity === 'all' || incident.severity === selectedFilters.severity;
    
    return matchesSearch && matchesSource && matchesSeverity;
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800';
      case 'monitoring': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <Skeleton height={32} width={300} className="mb-2" />
            <Skeleton height={20} width={500} />
          </div>
          
          {/* Search and Filters Skeleton */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <Skeleton height={40} className="mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          </div>
          
          {/* Results Skeleton */}
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-3">
                  <Skeleton height={24} width={300} />
                  <div className="flex space-x-2">
                    <Skeleton height={20} width={60} />
                    <Skeleton height={20} width={80} />
                  </div>
                </div>
                <Skeleton height={16} width="100%" className="mb-2" />
                <div className="flex justify-between items-center">
                  <Skeleton height={16} width={200} />
                  <Skeleton height={16} width={100} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Incident Search</h1>
          <p className="text-gray-600 mt-1">
            Find and analyze specific maritime security incidents
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search incidents by title, description, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={selectedFilters.source}
                onChange={(e) => setSelectedFilters(prev => ({ ...prev, source: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sources</option>
                <option value="UKMTO">UKMTO</option>
                <option value="MDAT">MDAT</option>
                <option value="RECAAP">RECAAP</option>
                <option value="ICC">ICC</option>
                <option value="CWD">CWD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={selectedFilters.severity}
                onChange={(e) => setSelectedFilters(prev => ({ ...prev, severity: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={selectedFilters.dateRange}
                onChange={(e) => setSelectedFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="1year">Last year</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredIncidents.length} of {incidents.length} incidents
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {filteredIncidents.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No incidents found</h3>
              <p className="text-gray-600">
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
            </div>
          ) : (
            filteredIncidents.map((incident) => (
              <Link
                key={incident.id}
                to={`/incident/${incident.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900 hover:text-blue-600">
                    {incident.title}
                  </h3>
                  <div className="flex space-x-2 ml-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(incident.severity)}`}>
                      {incident.severity.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(incident.status)}`}>
                      {incident.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-3 line-clamp-2">
                  {incident.description}
                </p>
                
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {incident.location}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h3z" />
                      </svg>
                      {incident.source}
                    </span>
                  </div>
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V8a1 1 0 011-1h3z" />
                    </svg>
                    {new Date(incident.date).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Load More Button (for pagination) */}
        {filteredIncidents.length > 0 && (
          <div className="mt-8 text-center">
            <button className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-50 transition-colors">
              Load More Incidents
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default IncidentsPage;

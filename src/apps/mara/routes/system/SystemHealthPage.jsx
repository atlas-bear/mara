import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SystemHealthPage = () => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Mock system health data - in real implementation, this would come from APIs
  const [systemStatus, setSystemStatus] = useState({
    overall: 'operational',
    services: [
      {
        id: 'data-collection',
        name: 'Data Collection',
        status: 'operational',
        description: 'Maritime incident data ingestion from multiple sources',
        uptime: '99.9%',
        responseTime: '120ms',
        lastCheck: new Date(Date.now() - 30000),
        details: {
          sources: ['CWD', 'UKMTO', 'RECAAP', 'MDAT', 'ICC'],
          activeConnections: 5,
          dataPoints: '2.3M',
          errorRate: '0.1%'
        }
      },
      {
        id: 'report-generation',
        name: 'Report Generation',
        status: 'operational',
        description: 'Weekly and flash report processing system',
        uptime: '99.8%',
        responseTime: '2.1s',
        lastCheck: new Date(Date.now() - 45000),
        details: {
          weeklyReports: 156,
          flashReports: 89,
          avgProcessingTime: '1.8s',
          queueSize: 0
        }
      },
      {
        id: 'email-service',
        name: 'Email Service',
        status: 'operational',
        description: 'Email notification and delivery system',
        uptime: '99.7%',
        responseTime: '450ms',
        lastCheck: new Date(Date.now() - 60000),
        details: {
          emailsSent: '12.4K',
          deliveryRate: '98.9%',
          bounceRate: '1.1%',
          queueSize: 3
        }
      },
      {
        id: 'database',
        name: 'Database',
        status: 'operational',
        description: 'Primary data storage and caching layer',
        uptime: '99.9%',
        responseTime: '15ms',
        lastCheck: new Date(Date.now() - 20000),
        details: {
          connections: 45,
          queryTime: '12ms',
          cacheHitRate: '94.2%',
          storage: '78% used'
        }
      },
      {
        id: 'api-gateway',
        name: 'API Gateway',
        status: 'degraded',
        description: 'External API routing and rate limiting',
        uptime: '98.2%',
        responseTime: '890ms',
        lastCheck: new Date(Date.now() - 10000),
        details: {
          requests: '45.2K/hr',
          errorRate: '2.1%',
          rateLimits: 'Active',
          throttling: 'Enabled'
        }
      },
      {
        id: 'ai-processing',
        name: 'AI Processing',
        status: 'operational',
        description: 'LLM-powered analysis and content generation',
        uptime: '99.5%',
        responseTime: '3.2s',
        lastCheck: new Date(Date.now() - 90000),
        details: {
          modelsActive: 3,
          tokensProcessed: '890K',
          avgLatency: '2.8s',
          queueDepth: 2
        }
      }
    ],
    metrics: {
      totalIncidents: 2847,
      reportsGenerated: 245,
      emailsDelivered: 12389,
      apiCalls: 45234,
      uptime: '99.7%',
      avgResponseTime: '1.2s'
    }
  });

  useEffect(() => {
    document.title = 'MARA - System Health';
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'outage':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'degraded':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'outage':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L10 10.586l1.293-1.293a1 1 0 011.414 1.414L10 13.414l-1.293 1.293a1 1 0 01-1.414-1.414L9.586 12l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const formatTime = (date) => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((date - new Date()) / 60000),
      'minute'
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">System Health</h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor system status and performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg 
                className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overall Status */}
        <div className="mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus.overall)}
                  <h2 className="text-lg font-semibold text-gray-900">
                    All Systems Operational
                  </h2>
                </div>
                <span className="text-sm text-gray-500">
                  Last updated {formatTime(lastUpdated)}
                </span>
              </div>
              <div className="flex items-center space-x-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.uptime}</div>
                  <div className="text-gray-500">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.avgResponseTime}</div>
                  <div className="text-gray-500">Avg Response</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.apiCalls.toLocaleString()}</div>
                  <div className="text-gray-500">API Calls/day</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {systemStatus.services.map((service) => (
            <div key={service.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(service.status)}`}>
                  {service.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Uptime</div>
                  <div className="text-lg font-semibold text-gray-900">{service.uptime}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Response Time</div>
                  <div className="text-lg font-semibold text-gray-900">{service.responseTime}</div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(service.details).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="font-medium text-gray-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Last checked {formatTime(service.lastCheck)}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.totalIncidents.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Total Incidents</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.reportsGenerated}</div>
                <div className="text-sm text-gray-500">Reports Generated</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.emailsDelivered.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Emails Delivered</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{systemStatus.metrics.apiCalls.toLocaleString()}</div>
                <div className="text-sm text-gray-500">API Calls Today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPage;

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

function HomePage() {
  // These would eventually come from your API/data source
  const latestWeeklyReport = '2025-06';
  const latestFlashReport = '2024-2662';
  // Add loading state for demo purposes
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'MARA';
    // Simulate loading for demo purposes
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <>
            {/* Header Skeleton */}
            <div className="mb-8">
              <Skeleton height={32} width={500} className="mb-2" />
              <Skeleton height={20} width={400} />
            </div>
            
            {/* Cards Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <Skeleton height={24} width={150} className="mb-4" />
                <div className="space-y-3">
                  <Skeleton height={60} />
                  <Skeleton height={60} />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <Skeleton height={24} width={120} className="mb-4" />
                <div className="space-y-2">
                  <Skeleton height={20} />
                  <Skeleton height={20} />
                  <Skeleton height={20} />
                </div>
              </div>
            </div>
            
            {/* Quick Actions Skeleton */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <Skeleton height={24} width={120} className="mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton height={80} />
                <Skeleton height={80} />
                <Skeleton height={80} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Multi-source Analysis and Reporting Architecture
              </p>
            </div>
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Latest Reports */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Reports</h2>
                <div className="space-y-3">
                  <Link 
                    to={`/weekly-report/${latestWeeklyReport}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Latest Weekly Report</div>
                        <div className="text-sm text-gray-600">Week {latestWeeklyReport}</div>
                      </div>
                      <div className="text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                  
                  <Link 
                    to={`/flash/${latestFlashReport}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Latest Flash Report</div>
                        <div className="text-sm text-gray-600">Incident {latestFlashReport}</div>
                      </div>
                      <div className="text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
              
              {/* System Status */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm text-gray-700">Incident Monitoring</span>
                    </div>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm text-gray-700">Flash Report System</span>
                    </div>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Operational</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm text-gray-700">Weekly Report Generation</span>
                    </div>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">Operational</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link 
                    to="/system/health"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View detailed system health →
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link 
                  to="/weekly-report"
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-center"
                >
                  <div className="text-2xl mb-2">📊</div>
                  <div className="font-medium text-gray-900">Weekly Reports</div>
                  <div className="text-xs text-gray-600 mt-1">View comprehensive analysis</div>
                </Link>
                
                <Link 
                  to="/preferences"
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-center"
                >
                  <div className="text-2xl mb-2">⚙️</div>
                  <div className="font-medium text-gray-900">Preferences</div>
                  <div className="text-xs text-gray-600 mt-1">Manage notifications</div>
                </Link>
                
                <Link 
                  to="/system/health"
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-center"
                >
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="font-medium text-gray-900">System Health</div>
                  <div className="text-xs text-gray-600 mt-1">Monitor performance</div>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default HomePage;

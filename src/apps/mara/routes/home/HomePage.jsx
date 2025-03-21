import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  // These would eventually come from your API/data source
  const latestWeeklyReport = '2025-06';
  const latestFlashReport = '2024-2662';

  useEffect(() => {
    document.title = 'MARA';
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
          MARA (Multi-source Analysis and Reporting Architecture)
          </h1>
          
          <div className="space-y-6">
            <div className="bg-orange-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Latest Reports</h2>
              <div className="space-y-4">
                <Link 
                  to={`/weekly-report/${latestWeeklyReport}`}
                  className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-gray-900">Latest Weekly Report</div>
                  <div className="text-gray-600">Week {latestWeeklyReport}</div>
                </Link>
                
                <Link 
                  to={`/flash/${latestFlashReport}`}
                  className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-gray-900">Latest Flash Report</div>
                  <div className="text-gray-600">Incident {latestFlashReport}</div>
                </Link>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-700">Incident Monitoring: Active</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-700">Flash Report System: Operational</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-gray-700">Weekly Report Generation: Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
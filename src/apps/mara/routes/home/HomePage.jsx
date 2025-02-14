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
      <div className="max-w-4xl mx-auto">
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
                  to={`/flash-report/${latestFlashReport}`}
                  className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold text-gray-900">Latest Flash Report</div>
                  <div className="text-gray-600">Incident {latestFlashReport}</div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
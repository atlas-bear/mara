import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';
import MaritimeMap from '../MaritimeMap';

const monthlyData = [
  { month: 'May', incidents: 8, robberies: 6, attacks: 2, boardings: 4 },
  { month: 'Jun', incidents: 6, robberies: 4, attacks: 2, boardings: 3 },
  { month: 'Jul', incidents: 5, robberies: 3, attacks: 2, boardings: 2 },
  { month: 'Aug', incidents: 7, robberies: 5, attacks: 2, boardings: 4 },
  { month: 'Sep', incidents: 6, robberies: 4, attacks: 2, boardings: 3 },
  { month: 'Oct', incidents: 9, robberies: 7, attacks: 2, boardings: 5 }
];

const RegionalBrief = () => {
  // Sample data for Southeast Asia incidents
  const regionalIncidents = [
    {
      latitude: 1.12,
      longitude: 103.8,
      title: "MARAN SPIRIT",
      description: "Perpetrator sighted in engine room. Alarm raised, crew mustered.",
      type: "robbery"
    },
    {
      latitude: 1.13,
      longitude: 103.5,
      title: "ASPASIA LUCK",
      description: "10 intruders armed with knives sighted in engine room. Engine spares stolen.",
      type: "robbery"
    },
    {
      latitude: 1.13,
      longitude: 103.49,
      title: "NYON",
      description: "Five intruders armed with knives sighted in engine room.",
      type: "robbery"
    }
  ];
  
  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Southeast Asia
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              Regional Maritime Security Brief - Week 42
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
              ▲ SUBSTANTIAL
            </span>
            <p className="text-sm text-gray-500 mt-1">Updated: Oct 21, 2024</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Weekly Incidents</p>
          <p className="text-2xl font-bold text-gray-900">3</p>
          <p className="text-xs text-orange-600">↑ 50% from last week</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">YTD Incidents</p>
          <p className="text-2xl font-bold text-gray-900">32</p>
          <p className="text-xs text-green-600">↓ 15% from 2023</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Armed Incidents</p>
          <p className="text-2xl font-bold text-gray-900">2</p>
          <p className="text-xs text-gray-600">67% of weekly total</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">High-Risk Areas</p>
          <p className="text-2xl font-bold text-gray-900">2</p>
          <p className="text-xs text-gray-600">Singapore Strait, Phillip Channel</p>
        </div>
      </div>

      {/* Incident Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Incidents</h2>
        <MaritimeMap 
          incidents={regionalIncidents}
          center={[103.8, 1.12]} // Centered on Singapore Strait
          zoom={9} // Closer zoom for regional view
        />
        <div className="mt-2 text-xs text-gray-500 flex justify-end gap-3">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Robbery
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-orange-500 mr-1"></span> Attack
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Military
          </span>
        </div>
      </div>

      {/* Incident Trends */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">6-Month Trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="incidents" stroke="#f97316" fill="#fed7aa" />
              <Area type="monotone" dataKey="robberies" stroke="#ef4444" fill="#fecaca" />
              <Area type="monotone" dataKey="boardings" stroke="#3b82f6" fill="#bfdbfe" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Incident Details</h2>
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">MARAN SPIRIT</h3>
              <span className="text-sm text-gray-500">Oct 17, 2024</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Perpetrator sighted in engine room. Alarm raised, crew mustered. No items stolen. 
              Incident reported to Singapore VTIS West.
            </p>
            <div className="flex gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                Bulk Carrier
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Attempted Theft
              </span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">ASPASIA LUCK</h3>
              <span className="text-sm text-gray-500">Oct 17, 2024</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              10 intruders armed with knives sighted in engine room. Engine spares stolen. 
              PCG conducted search upon arrival at Singapore Anchorage.
            </p>
            <div className="flex gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                Bulk Carrier
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Armed Robbery
              </span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">NYON</h3>
              <span className="text-sm text-gray-500">Oct 17, 2024</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Five intruders armed with knives sighted in engine room. Nothing stolen. 
              PCG conducted search at Singapore Anchorage.
            </p>
            <div className="flex gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                Bulk Carrier
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Armed Robbery
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis & Recommendations */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis & Recommendations</h2>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Pattern of coordinated attacks suggests organized criminal activity</li>
              <li>Increased use of weapons in recent incidents</li>
              <li>Focus on engine room targeting indicates sophisticated approach</li>
              <li>All incidents occurred during hours of darkness</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Recommendations</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Enhance engine room security during night hours</li>
              <li>Maintain vigilant watch when transiting Singapore Strait</li>
              <li>Test alarm systems and emergency communications before entering high-risk areas</li>
              <li>Conduct additional security drills focusing on armed intruder scenarios</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalBrief;
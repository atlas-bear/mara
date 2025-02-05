import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import MaritimeMap from '../MaritimeMap';

// Sample incident data for the map
const currentIncidents = [
  {
    latitude: 1.12,
    longitude: 103.8,
    title: "Singapore Strait Robbery",
    description: "Armed robbery aboard bulk carrier",
    type: "robbery"
  },
  {
    latitude: 14.5,
    longitude: 42.5,
    title: "Red Sea Attack",
    description: "Missile attack on commercial vessel",
    type: "attack"
  },
  {
    latitude: 46.48,
    longitude: 30.75,
    title: "Black Sea Incident",
    description: "Military activity affecting port operations",
    type: "military"
  },
  {
    latitude: 18.37,
    longitude: -93.82,
    title: "Gulf of Mexico Incident",
    description: "Armed robbery near FPSO",
    type: "robbery"
  }
];

// Sparkline component
const Sparkline = ({ data }) => (
  <ResponsiveContainer width="100%" height={20}>
    <LineChart data={data}>
      <Line
        type="monotone"
        dataKey="value"
        stroke="#6b7280"
        strokeWidth={1}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

export default function ExecutiveBrief() {
  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Title Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-baseline">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Maritime Security Executive Brief
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Week 42 (Oct 14-21, 2024)
          </p>
        </div>
      </div>

      {/* Active Incidents Map Section */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Active Incidents
        </h2>
        <div className="rounded-lg overflow-hidden shadow-sm">
          {import.meta.env.VITE_MAPBOX_TOKEN ? (
            <MaritimeMap 
              incidents={currentIncidents}
              center={[40, 20]}
              zoom={1}
            />
          ) : (
            <div className="w-full h-[300px] bg-gray-100 flex items-center justify-center">
              <p className="text-gray-500">MapBox token not found</p>
            </div>
          )}
        </div>
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

      {/* Threat Level Legend */}
      <div className="px-6 pt-4 flex flex-wrap gap-2 text-sm">
        <span className="font-semibold text-gray-700">Threat Levels:</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
          ⚠⚠ Critical
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-rose-100 text-rose-800">
          ⚠ Severe
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
          ▲ Substantial
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          ► Moderate
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
          ● Low
        </span>
      </div>

      {/* Global Threat Overview Table */}
      <div className="p-6 border-b border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">
                  Region
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">
                  Threat Level
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">
                  Incidents
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">
                  5-Week Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 border">Indian Ocean</td>
                <td className="px-4 py-3 border">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    ⚠⚠ Critical
                  </span>
                </td>
                <td className="px-4 py-3 text-center border">5</td>
                <td className="px-4 py-3 border">
                  <div className="h-5">
                    <Sparkline data={[
                      { week: 1, value: 4 }, { week: 2, value: 1 }, 
                      { week: 3, value: 6 }, { week: 4, value: 2 }, 
                      { week: 5, value: 3 }
                    ]} />
                  </div>
                </td>
              </tr>
              
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 border">Europe</td>
                <td className="px-4 py-3 border">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-rose-100 text-rose-800">
                    ⚠ Severe
                  </span>
                </td>
                <td className="px-4 py-3 text-center border">4</td>
                <td className="px-4 py-3 border">
                  <div className="h-5">
                    <Sparkline data={[
                      { week: 1, value: 4 }, { week: 2, value: 5 }, 
                      { week: 3, value: 4 }, { week: 4, value: 5 }, 
                      { week: 5, value: 4 }
                    ]} />
                  </div>
                </td>
              </tr>

              {/* Other regions as before */}
              {/* ... */}

            </tbody>
          </table>
        </div>
      </div>

      {/* Key Developments */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Key Developments
        </h2>
        <ul className="space-y-4">
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-red-600">●</span>
            <span className="ml-2 text-gray-700">
              Red Sea: Multiple missile attacks reported on commercial vessels in Bab el-Mandeb strait. 
              Two vessels sustained damage, leading to major carriers rerouting around Cape of Good Hope.
            </span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-orange-600">●</span>
            <span className="ml-2 text-gray-700">
              Singapore Strait: Coordinated robberies targeting three bulk carriers within 2 hours on Oct 17. 
              Two incidents involved armed perpetrators, indicating organized criminal activity.
            </span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-orange-600">●</span>
            <span className="ml-2 text-gray-700">
              Gulf of Mexico: Armed robbery reported near FPSO MIAMTE. Crew held at gunpoint and forced to 
              transfer funds. First incident of 2024 involving forced banking transfers in the region.
            </span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-blue-600">●</span>
            <span className="ml-2 text-gray-700">
              Black Sea: Russian missile strike on Port of Odesa damaged two cargo vessels and port infrastructure. 
              One port worker killed, insurance rates rising following repeated attacks.
            </span>
          </li>
        </ul>
      </div>

      {/* 7-Day Forecast */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          7-Day Forecast
        </h2>
        <ul className="space-y-4">
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-red-600">↗</span>
            <span className="ml-2 text-gray-700">
              Red Sea: High likelihood of continued attacks on commercial shipping. 
              Vessels advised to maintain maximum distance from Yemen coastline or consider Cape routing.
            </span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-orange-600">↗</span>
            <span className="ml-2 text-gray-700">
              Singapore Strait: Elevated risk of night-time robbery attempts. 
              Enhanced vigilance recommended during hours of darkness.
            </span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-blue-600">→</span>
            <span className="ml-2 text-gray-700">
              Black Sea: Sustained threat to shipping in Ukrainian ports from missile strikes. 
              Further insurance rate increases expected.
            </span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 h-5 w-5 text-yellow-600">↘</span>
            <span className="ml-2 text-gray-700">
              Gulf of Guinea: Reduced activity expected due to weather conditions. 
              Standard precautions should be maintained.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
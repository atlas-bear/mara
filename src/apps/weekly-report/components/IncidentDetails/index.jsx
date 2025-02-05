import React from 'react';
import { MapPin, Anchor, Clock, Shield, AlertTriangle, Navigation, Users, Ship, ChevronLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import MaritimeMap from '../MaritimeMap';

// Sample historical data for the area
const areaIncidentData = [
  { month: 'May', incidents: 2 },
  { month: 'Jun', incidents: 3 },
  { month: 'Jul', incidents: 2 },
  { month: 'Aug', incidents: 4 },
  { month: 'Sep', incidents: 3 },
  { month: 'Oct', incidents: 5 }
];

const IncidentDetails = () => {
  // Sample data for a specific incident and nearby context
  const mainIncident = {
    latitude: 1.13,
    longitude: 103.5,
    title: "ASPASIA LUCK",
    description: "10 intruders armed with knives sighted in engine room. Engine spares stolen.",
    type: "robbery"
  };

  // Include nearby incidents for context
  const nearbyIncidents = [
    {
      latitude: 1.12,
      longitude: 103.8,
      title: "MARAN SPIRIT",
      description: "Previous incident (Oct 17)",
      type: "robbery"
    },
    {
      latitude: 1.13,
      longitude: 103.49,
      title: "NYON",
      description: "Related incident (Oct 17)",
      type: "robbery"
    }
  ];

  // Combine main incident with context
  const mapIncidents = [mainIncident, ...nearbyIncidents];

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      {/* Header with Alert Status */}
      <div className="bg-orange-50 p-6 rounded-t-lg border-b border-orange-100">
        <div className="flex items-center gap-2 text-gray-600 mb-4">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Back to Incidents</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Alert ID: 2024-2662
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                Armed Robbery
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              MV ASPASIA LUCK
            </h1>
            <p className="text-gray-600">
              Bulk Carrier | IMO: 9223485 | Flag: Liberia
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Reported</p>
            <p className="text-lg font-semibold text-gray-900">Oct 17, 2024 18:08 UTC</p>
          </div>
        </div>
      </div>

      {/* Quick Facts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-gray-200">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-semibold text-gray-900">Singapore Strait</p>
            <p className="text-sm text-gray-600">1° 7' 52.8" N, 103° 30' 19.8" E</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Ship className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Vessel Status</p>
            <p className="font-semibold text-gray-900">Underway</p>
            <p className="text-sm text-gray-600">En route to PEBGB</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-gray-400 mt-1" />
          <div>
            <p className="text-sm text-gray-600">Crew Status</p>
            <p className="font-semibold text-gray-900">All Safe</p>
            <p className="text-sm text-gray-600">No injuries reported</p>
          </div>
        </div>
      </div>

      {/* Incident Map */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
        <MaritimeMap 
          incidents={mapIncidents}
          center={[mainIncident.longitude, mainIncident.latitude]} // Center on main incident
          zoom={10} // Closer zoom for incident details
        />
        <div className="mt-2 text-xs text-gray-500">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> 
            Incident Location (and related incidents in past 24h)
          </span>
        </div>
      </div>

      {/* Incident Details */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Incident Details</h2>
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700">
              While underway in the Singapore Strait, the master reported to Singapore VTIS West 
              that 10 intruders armed with knives were sighted in the engine room. The alarm was 
              raised, and the crew mustered to conduct a search aboard the ship. No intruders 
              were found, but some engine spare parts were reported stolen.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Response Actions</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li>Alarm raised and crew mustered</li>
              <li>Incident reported to Singapore VTIS West</li>
              <li>Safety navigational broadcast initiated</li>
              <li>Republic of Singapore Navy's MSTF notified</li>
              <li>Police Coast Guard (PCG) notified</li>
              <li>Information shared with Indonesian authorities</li>
              <li>PCG conducted search at Singapore Anchorage</li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Stolen Items</h3>
            <ul className="list-disc list-inside text-gray-700">
              <li>Engine spare parts (detailed inventory pending)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis</h2>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Part of coordinated series of incidents on October 17</li>
              <li>Perpetrators were armed and well-organized</li>
              <li>Targeted approach to engine room suggests prior knowledge</li>
              <li>Quick response from authorities demonstrated</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Historical Context</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={areaIncidentData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="incidents" 
                    stroke="#f97316" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Incidents in Singapore Strait (Past 6 Months)
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Immediate Actions</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Enhance engine room security measures</li>
              <li>Increase watch rotations during night hours</li>
              <li>Review and update vessel security plan</li>
              <li>Conduct additional security drills</li>
            </ul>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Long-term Measures</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Install additional CCTV coverage</li>
              <li>Upgrade access control systems</li>
              <li>Enhance crew security training</li>
              <li>Implement new patrol procedures</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetails;
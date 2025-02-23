import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PreviewMode from '../../components/FlashReport/PreviewMode';

// For testing - will eventually come from API/database
const sampleIncidents = {
  '2024-2662': {
    id: '2024-2662',
    title: 'Armed Robbery aboard ASPASIA LUCK',
    type: 'robbery',
    date: '2024-10-17T18:08:00.000Z',
    location: 'Singapore Strait',
    coordinates: {
      latitude: 1.13,
      longitude: 103.5
    },
    vesselName: 'ASPASIA LUCK',
    vesselType: 'Bulk Carrier',
    vesselFlag: 'Liberia',
    vesselIMO: '9223485',
    status: 'Underway',
    destination: 'PEBGB',
    crewStatus: 'All Safe',
    description: 'Test incident description',
    responseActions: [
      'Action 1',
      'Action 2'
    ],
    analysis: [
      'Analysis point 1',
      'Analysis point 2'
    ]
  }
};

function FlashReportPage() {
  const { incidentId } = useParams();
  const incident = sampleIncidents[incidentId];

  useEffect(() => {
    document.title = 'MARA Flash Report';
  }, []);

  if (!incident) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Incident Not Found</h1>
          <p className="text-gray-600">The incident {incidentId} could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <PreviewMode incident={incident} />
      </div>
    </div>
  );
}

export default FlashReportPage;
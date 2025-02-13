import React from 'react'
import FlashReport from './index'

// Sample incident data for testing
const sampleIncident = {
  id: '2024-2662',
  title: 'Armed Robbery aboard ASPASIA LUCK',
  type: 'robbery',  // Added incident type
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

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <FlashReport incident={sampleIncident} />
    </div>
  )
}

export default App
import React from 'react'
import ExecutiveBrief from './components/ExecutiveBrief'
import RegionalBrief from './components/RegionalBrief'
import IncidentDetails from './components/IncidentDetails'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <ExecutiveBrief />
      <RegionalBrief />
      <IncidentDetails incidentId="2024-2662" />
    </div>
  )
}

export default App
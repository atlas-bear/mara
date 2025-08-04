import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WeeklyReportPage from './routes/weekly/WeeklyReportPage';
import FlashReportPage from './routes/flash/FlashReportPage';
import PublicFlashReportPage from './routes/flash/PublicFlashReportPage';
import HomePage from './routes/home/HomePage';
import IncidentPage from './routes/incident/IncidentPage';
import PreferencesPage from './routes/preferences/PreferencesPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/weekly-report/:yearWeek" element={<WeeklyReportPage />} />
        <Route path="/weekly-report" element={<WeeklyReportPage />} />
        <Route path="/flash/:incidentId" element={<FlashReportPage />} />
        <Route path="/flash-report/:incidentId" element={<FlashReportPage />} />
        <Route path="/public/flash-report/:incidentId/:token" element={<PublicFlashReportPage />} />
        <Route path="/incident/:incidentId" element={<IncidentPage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
      </Routes>
    </Router>
  )
}

export default App

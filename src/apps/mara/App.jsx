import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import WeeklyReportPage from './routes/weekly/WeeklyReportPage';
import FlashReportPage from './routes/flash/FlashReportPage';
import PublicFlashReportPage from './routes/flash/PublicFlashReportPage';
import HomePage from './routes/home/HomePage';
import IncidentPage from './routes/incident/IncidentPage';
import PreferencesPage from './routes/preferences/PreferencesPage';
import SystemHealthPage from './routes/system/SystemHealthPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes without layout */}
        <Route path="/public/flash-report/:incidentId/:token" element={<PublicFlashReportPage />} />
        
        {/* Routes with Linear-style layout */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/weekly-report/:yearWeek" element={<WeeklyReportPage />} />
              <Route path="/weekly-report" element={<WeeklyReportPage />} />
              <Route path="/flash/:incidentId" element={<FlashReportPage />} />
              <Route path="/flash-report/:incidentId" element={<FlashReportPage />} />
              <Route path="/incident/:incidentId" element={<IncidentPage />} />
              <Route path="/preferences" element={<PreferencesPage />} />
              <Route path="/system/health" element={<SystemHealthPage />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  )
}

export default App

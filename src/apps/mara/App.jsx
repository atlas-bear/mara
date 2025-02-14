import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WeeklyReportPage from './routes/weekly/WeeklyReportPage';
import FlashReportPage from './routes/flash/FlashReportPage';
import HomePage from './routes/home/HomePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/weekly-report/:yearWeek" element={<WeeklyReportPage />} />
        <Route path="/flash-report/:incidentId" element={<FlashReportPage />} />
      </Routes>
    </Router>
  )
}

export default App
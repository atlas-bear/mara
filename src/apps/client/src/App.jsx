import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout'
import WeeklyReport from './pages/weekly/WeeklyReport'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:yearWeek" element={<MainLayout />}>
          <Route index element={<WeeklyReport />} />
          {/* Future routes can be added here */}
          {/* <Route path="/analysis" element={<Analysis />} /> */}
          {/* <Route path="/custom-reports" element={<CustomReports />} /> */}
        </Route>
      </Routes>
    </Router>
  )
}

export default App
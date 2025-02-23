import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import WeeklyReport from './pages/weekly/WeeklyReport'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<WeeklyReport />} />
        {/* Future routes can be added here */}
        {/* <Route path="/analysis" element={<Analysis />} /> */}
        {/* <Route path="/custom-reports" element={<CustomReports />} /> */}
      </Route>
    </Routes>
  )
}
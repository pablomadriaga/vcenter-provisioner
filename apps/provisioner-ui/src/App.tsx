import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TypificationsPage from './pages/TypificationsPage'
import VMClassesPage from './pages/VMClassesPage'
import VcentersPage from './pages/VcentersPage'
import StatsPage from './pages/StatsPage'
import MonitorPage from './pages/MonitorPage'

function App() {
  return (
    <ToastProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <div className="app">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/typifications" element={<TypificationsPage />} />
            <Route path="/vm-classes" element={<VMClassesPage />} />
            <Route path="/vcenters" element={<VcentersPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </ToastProvider>
  )
}

export default App

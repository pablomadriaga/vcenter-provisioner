import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { setOnUnauthorizedCallback } from './utils/api'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TypificationsPage from './pages/TypificationsPage'
import VMClassesPage from './pages/VMClassesPage'
import VcentersPage from './pages/VcentersPage'
import StatsPage from './pages/StatsPage'
import MonitorPage from './pages/MonitorPage'

function AuthInterceptor() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      logout()
      navigate('/login', { replace: true })
    })
  }, [logout, navigate])

  return null
}

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <AuthInterceptor />
          <div className="app">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/typifications" element={<ProtectedRoute><TypificationsPage /></ProtectedRoute>} />
              <Route path="/vm-classes" element={<ProtectedRoute><VMClassesPage /></ProtectedRoute>} />
              <Route path="/vcenters" element={<ProtectedRoute><VcentersPage /></ProtectedRoute>} />
              <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
              <Route path="/monitor" element={<ProtectedRoute><MonitorPage /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AgentDashboard from './pages/AgentDashboard'
import PerformanceDashboard from './pages/PerformanceDashboard'
import LeadList from './pages/LeadList'
import LeadDetail from './pages/LeadDetail'
import ReminderCenter from './pages/ReminderCenter'
import PerformanceDashboardConnected from './pages/PerformanceDashboardConnected'
import TeamPerformance from './pages/TeamPerformance'
import TeamPerformanceDetail from './pages/TeamPerformanceDetail'
import ReportsConnected from './pages/ReportsConnected'
import AuditLogConnected from './pages/AuditLogConnected'
import Settings from './pages/Settings'
import Integrations from './pages/Integrations'
import AnalyticsConnected from './pages/AnalyticsConnected'
import CallLog from './pages/CallLog'
import Dialer from './pages/Dialer'
import LeadImport from './pages/LeadImport'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'

export type UserRole = 'manager' | 'representative'

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-10 h-10 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  const role = user.role

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={role === 'manager' ? <Navigate to="/dashboard" replace /> : <Navigate to="/agent" replace />} />
          <Route path="dashboard" element={role === 'manager' ? <Dashboard /> : <Navigate to="/agent" replace />} />
          <Route path="agent" element={role === 'representative' ? <AgentDashboard /> : <Navigate to="/dashboard" replace />} />
          <Route path="leads" element={<LeadList />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="reminders" element={<ReminderCenter />} />
          <Route path="performance" element={role === 'manager' ? <TeamPerformance /> : <PerformanceDashboard />} />
          {role === 'manager' && <Route path="performance/:id" element={<TeamPerformanceDetail />} />}
          <Route path="my-performance" element={role === 'manager' ? <PerformanceDashboardConnected /> : <PerformanceDashboard />} />
          <Route path="reports" element={<ReportsConnected />} />
          {role === 'manager' && <Route path="audit" element={<AuditLogConnected />} />}
          {role === 'manager' && <Route path="integrations" element={<Integrations />} />}
          {role === 'manager' && <Route path="analytics" element={<AnalyticsConnected />} />}
          <Route path="dialer" element={<Dialer />} />
          <Route path="call-log" element={<CallLog />} />
          <Route path="lead-import" element={<LeadImport />} />
          <Route path="settings" element={<Settings role={role} />} />
          <Route path="*" element={<Navigate to={role === 'manager' ? '/dashboard' : '/agent'} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  )
}

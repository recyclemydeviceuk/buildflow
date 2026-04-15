import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import FeatureGuard from './components/layout/FeatureGuard'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AgentDashboard from './pages/AgentDashboard'
import PerformanceDashboard from './pages/PerformanceDashboard'
import LeadList from './pages/LeadList'
import LeadDetail from './pages/LeadDetail'
import ReminderCenter from './pages/ReminderCenter'
import FollowUps from './pages/FollowUps'
import PerformanceDashboardConnected from './pages/PerformanceDashboardConnected'
import TeamPerformance from './pages/TeamPerformance'
import TeamPerformanceDetail from './pages/TeamPerformanceDetail'
import ReportsConnected from './pages/ReportsConnected'
import AuditLogConnected from './pages/AuditLogConnected'
import Settings from './pages/Settings'
import Integrations from './pages/IntegrationsConnected'
import AnalyticsConnected from './pages/AnalyticsConnected'
import CallLog from './pages/CallLog'
import Dialer from './pages/Dialer'
import LeadImport from './pages/LeadImport'
import EmiCalculator from './pages/EmiCalculator'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { FeatureControlsProvider } from './context/FeatureControlsContext'

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

          {/* Follow-up routes — gated by followUpReminders */}
          <Route
            path="reminders"
            element={<FeatureGuard feature="followUpReminders"><ReminderCenter /></FeatureGuard>}
          />
          <Route
            path="follow-ups"
            element={<FeatureGuard feature="followUpReminders"><FollowUps /></FeatureGuard>}
          />

          {/* Performance / Analytics routes — gated by analyticsAccess */}
          <Route
            path="performance"
            element={
              <FeatureGuard feature="analyticsAccess">
                {role === 'manager' ? <TeamPerformance /> : <PerformanceDashboard />}
              </FeatureGuard>
            }
          />
          {role === 'manager' && (
            <Route
              path="performance/:id"
              element={<FeatureGuard feature="analyticsAccess"><TeamPerformanceDetail /></FeatureGuard>}
            />
          )}
          <Route
            path="my-performance"
            element={
              <FeatureGuard feature="analyticsAccess">
                {role === 'manager' ? <PerformanceDashboardConnected /> : <PerformanceDashboard />}
              </FeatureGuard>
            }
          />
          <Route
            path="reports"
            element={<FeatureGuard feature="analyticsAccess"><ReportsConnected /></FeatureGuard>}
          />

          {/* Audit Log — manager only + gated by auditLog feature */}
          {role === 'manager' && (
            <Route
              path="audit"
              element={<FeatureGuard feature="auditLog"><AuditLogConnected /></FeatureGuard>}
            />
          )}

          {role === 'manager' && <Route path="integrations" element={<Integrations />} />}

          {/* Analytics — manager only + gated by analyticsAccess */}
          {role === 'manager' && (
            <Route
              path="analytics"
              element={<FeatureGuard feature="analyticsAccess"><AnalyticsConnected /></FeatureGuard>}
            />
          )}

          {/* Dialer — gated by dialer feature */}
          <Route
            path="dialer"
            element={<FeatureGuard feature="dialer"><Dialer /></FeatureGuard>}
          />

          <Route path="call-log" element={<CallLog />} />
          <Route path="lead-import" element={<LeadImport />} />
          <Route path="emi-calculator" element={<EmiCalculator />} />
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
        <FeatureControlsProvider>
          <AppRoutes />
        </FeatureControlsProvider>
      </SocketProvider>
    </AuthProvider>
  )
}

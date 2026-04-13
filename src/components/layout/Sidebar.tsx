import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Bell, BarChart2,
  FileText, Shield, Settings, Link2, BarChart3, Phone, LogOut, CalendarClock, Calculator,
  ChevronLeft, ChevronRight, Grid3x3
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { UserRole } from '../../App'
import { remindersAPI } from '../../api/reminders'
import { settingsAPI } from '../../api/settings'
import { callsAPI } from '../../api/calls'
import { useSocket } from '../../context/SocketContext'
import { useFeatureControls } from '../../context/FeatureControlsContext'

interface SidebarProps {
  role: UserRole
  collapsed: boolean
  onToggle: () => void
}

const managerNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Leads', icon: Users, path: '/leads' },
  { label: 'Dialer', icon: Grid3x3, path: '/dialer' },
  { label: 'Call Log', icon: Phone, path: '/call-log' },
  { label: 'Follow Ups', icon: CalendarClock, path: '/follow-ups' },
  { label: 'Call Reminders', icon: Bell, path: '/reminders' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Performance', icon: BarChart2, path: '/performance' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { label: 'Audit Log', icon: Shield, path: '/audit' },
  { label: 'Integrations', icon: Link2, path: '/integrations' },
]

const repNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/agent' },
  { label: 'My Leads', icon: Users, path: '/leads' },
  { label: 'Dialer', icon: Grid3x3, path: '/dialer' },
  { label: 'Call Log', icon: Phone, path: '/call-log' },
  { label: 'Follow Ups', icon: CalendarClock, path: '/follow-ups' },
  { label: 'Call Reminders', icon: Bell, path: '/reminders' },
  { label: 'Performance', icon: BarChart2, path: '/performance' },
]

type AvailStatus = 'available' | 'dialing' | 'in-call' | 'offline'

const statusMeta: Record<AvailStatus, { label: string; dot: string; text: string }> = {
  available: { label: 'Available', dot: '#16A34A', text: '#16A34A' },
  dialing: { label: 'Dialing', dot: '#F59E0B', text: '#D97706' },
  'in-call': { label: 'In Call', dot: '#F59E0B', text: '#D97706' },
  offline: { label: 'Offline', dot: '#94A3B8', text: '#64748B' },
}

const getDisplayAvailability = (input?: { callAvailabilityStatus?: string | null; activeCallSid?: string | null } | null): AvailStatus => {
  if (input?.callAvailabilityStatus === 'offline') return 'offline'
  if (input?.callAvailabilityStatus === 'in-call') return 'in-call'
  if (input?.activeCallSid) return 'dialing'
  return 'available'
}

export default function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, logout, refreshUser, updateUser } = useAuth()
  const { socket, connected } = useSocket()
  const featureControls = useFeatureControls()
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false)
  const [resettingCallStatus, setResettingCallStatus] = useState(false)
  const [reminderBadgeCount, setReminderBadgeCount] = useState(0)
  const navItems = (role === 'manager' ? managerNav : repNav).filter((item) => {
    if (item.path === '/dialer' && !featureControls.dialer) return false
    if (item.path === '/analytics' && !featureControls.analyticsAccess) return false
    if (item.path === '/performance' && !featureControls.analyticsAccess) return false
    if (item.path === '/reports' && !featureControls.analyticsAccess) return false
    if (item.path === '/audit' && !featureControls.auditLog) return false
    if (item.path === '/reminders' && !featureControls.followUpReminders) return false
    if (item.path === '/follow-ups' && !featureControls.followUpReminders) return false
    return true
  })

  // Initial refresh on socket connect (only once per connect)
  useEffect(() => {
    if (!socket || !connected || !user?.id) return

    // Only refresh once when socket first connects
    const timeoutId = window.setTimeout(() => {
      refreshUser().catch((error) => {
        console.error('Failed to refresh user after socket connect:', error)
      })
    }, 500)

    const handleAvailabilityUpdate = (payload: any) => {
      if (String(payload?.id) !== String(user.id)) return
      updateUser({
        phone: payload.phone ?? null,
        callAvailabilityStatus: payload.callAvailabilityStatus,
        callDeviceMode: payload.callDeviceMode,
        activeCallSid: payload.activeCallSid ?? null,
        isActive: payload.isActive,
      })
    }

    socket.on('user:availability_updated', handleAvailabilityUpdate)

    return () => {
      window.clearTimeout(timeoutId)
      socket.off('user:availability_updated', handleAvailabilityUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, user?.id])

  const intervalRef = useRef<number | null>(null)
  const reminderIntervalRef = useRef<number | null>(null)

  const refreshReminderBadge = async () => {
    try {
      const response = await remindersAPI.getReminders({ page: '1', limit: '100' })
      if (response.success) {
        const urgentCount = response.data.filter(
          (reminder) => reminder.status === 'overdue' || reminder.status === 'due_soon'
        ).length
        setReminderBadgeCount(urgentCount)
      }
    } catch (error) {
      console.error('Failed to refresh reminder badge:', error)
    }
  }

  useEffect(() => {
    refreshReminderBadge()

    if (reminderIntervalRef.current) {
      window.clearInterval(reminderIntervalRef.current)
    }

    reminderIntervalRef.current = window.setInterval(() => {
      refreshReminderBadge().catch((error) => {
        console.error('Failed to poll reminder badge:', error)
      })
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshReminderBadge().catch((error) => {
          console.error('Failed to refresh reminder badge on visibility change:', error)
        })
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (reminderIntervalRef.current) {
        window.clearInterval(reminderIntervalRef.current)
        reminderIntervalRef.current = null
      }
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [location.pathname, user?.id])

  // Poll for live call status updates when in active call
  useEffect(() => {
    const liveStatus = getDisplayAvailability(user)
    const shouldPoll = liveStatus === 'dialing' || liveStatus === 'in-call'

    if (shouldPoll && !intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        refreshUser().catch((error) => {
          console.error('Failed to refresh user live call state:', error)
        })
      }, 10000)
    } else if (!shouldPoll && intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [user?.callAvailabilityStatus, user?.activeCallSid, refreshUser])

  const handleToggle = async () => {
    if (!user) return

    const nextStatus: 'available' | 'offline' =
      user?.callAvailabilityStatus === 'offline' ? 'available' : 'offline'

    try {
      setAvailabilityUpdating(true)
      updateUser({ callAvailabilityStatus: nextStatus })
      const response = await settingsAPI.updateMyProfile({ callAvailabilityStatus: nextStatus })
      if (response.success) {
        updateUser(response.data)
      }
    } catch (error) {
      console.error('Failed to update calling availability:', error)
      updateUser({
        callAvailabilityStatus: user?.callAvailabilityStatus || 'available',
        activeCallSid: user?.activeCallSid || null,
      })
    } finally {
      setAvailabilityUpdating(false)
    }
  }

  const handleResetCallStatus = async () => {
    if (!user || resettingCallStatus) return
    try {
      setResettingCallStatus(true)
      // Immediately clear local state so UI responds right away
      updateUser({ callAvailabilityStatus: 'available', activeCallSid: null })
      // Update DB — also clears activeCallSid on backend
      const res = await settingsAPI.updateMyProfile({ callAvailabilityStatus: 'available' })
      if (res.success) {
        // Force activeCallSid null locally even if DB hasn't cleared it yet
        updateUser({ ...res.data, activeCallSid: null })
      }
      // Reconcile is best-effort (non-blocking — route may not exist yet if server not restarted)
      callsAPI.reconcileStatuses().catch(() => {})
    } catch (err) {
      console.error('Failed to reset call status:', err)
      await refreshUser()
    } finally {
      setResettingCallStatus(false)
    }
  }

  const status = getDisplayAvailability(user)
  const sm = statusMeta[status]

  const avatarInitials = user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || (role === 'manager' ? 'M' : 'R')

  // Shared label — fades + slides out when collapsing
  const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <span
      className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
        collapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[160px]'
      } ${className}`}
    >
      {children}
    </span>
  )

  const renderNavItem = (item: typeof navItems[0]) => {
    const isActive =
      location.pathname === item.path ||
      (item.path !== '/agent' && item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'))
    const hasBadge = item.path === '/reminders' && reminderBadgeCount > 0

    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
          isActive ? 'text-white' : 'text-[#94A3B8] hover:text-white'
        }`}
        style={isActive ? { background: 'rgba(59,130,246,0.12)' } : undefined}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#3B82F6] rounded-r-full" />
        )}
        <span className="relative shrink-0">
          <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className={`transition-colors duration-150 ${isActive ? 'text-[#3B82F6]' : 'text-[#94A3B8]'}`} />
          {hasBadge && collapsed && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#DC2626] border border-[#0B1120]" />
          )}
        </span>
        <Label className="flex-1">{item.label}</Label>
        {hasBadge && (
          <span className={`min-w-[20px] h-5 px-1.5 bg-[#DC2626] rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 transition-all duration-300 ${collapsed ? 'opacity-0 scale-0 w-0 px-0 overflow-hidden' : 'opacity-100 scale-100'}`}>
            {reminderBadgeCount}
          </span>
        )}
      </NavLink>
    )
  }

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col z-40 overflow-hidden"
      style={{
        background: '#0B1120',
        width: collapsed ? '56px' : '200px',
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Brand + Toggle */}
      <div className="flex items-center shrink-0 h-[52px] px-3 border-b border-white/[0.06]">
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? 'w-0 opacity-0' : 'w-[130px] opacity-100'}`}>
          <img
            src="https://res.cloudinary.com/desmurksp/image/upload/v1775226238/Buildflow_i2vkia.png"
            alt="BuildFlow"
            className="h-7 w-auto object-contain"
          />
        </div>
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#475569] hover:text-white hover:bg-white/10 transition-colors duration-150 shrink-0 ml-auto"
        >
          <span
            className="transition-transform duration-300 ease-in-out inline-flex"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          >
            <ChevronRight size={14} />
          </span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
        {navItems.map(renderNavItem)}
      </nav>

      {/* EMI Calculator */}
      <div className="border-t border-white/[0.06] pt-1.5 pb-1 px-2">
        <NavLink
          to="/emi-calculator"
          title={collapsed ? 'EMI Calculator' : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
            location.pathname === '/emi-calculator' ? 'text-white' : 'text-[#94A3B8] hover:text-white'
          }`}
          style={location.pathname === '/emi-calculator' ? { background: 'rgba(59,130,246,0.12)' } : undefined}
        >
          <div
            className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0"
            style={{ background: location.pathname === '/emi-calculator' ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.12)' }}
          >
            <Calculator size={11} className="text-[#3B82F6]" />
          </div>
          <Label className="flex-1">EMI Calculator</Label>
        </NavLink>
      </div>

      {/* Settings + Sign Out */}
      <div className="border-t border-white/[0.06] pt-1.5 pb-2 px-2">
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
            location.pathname === '/settings' ? 'text-white' : 'text-[#94A3B8] hover:text-white'
          }`}
          style={location.pathname === '/settings' ? { background: 'rgba(59,130,246,0.12)' } : undefined}
        >
          <Settings size={17} strokeWidth={location.pathname === '/settings' ? 2.2 : 1.8} className={`transition-colors duration-150 ${location.pathname === '/settings' ? 'text-[#3B82F6]' : 'text-[#94A3B8]'}`} />
          <Label>Settings</Label>
        </NavLink>
        <button
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-500/10 transition-colors duration-150 mt-0.5"
        >
          <LogOut size={17} strokeWidth={1.8} className="shrink-0" />
          <Label>Sign Out</Label>
        </button>
      </div>

      {/* User card */}
      <div className="border-t border-white/[0.06] px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)' }}>
                {avatarInitials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0B1120]" style={{ background: sm.dot }} />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
            <p className="text-white text-[11px] font-semibold truncate">{user?.name || (role === 'manager' ? 'Manager' : 'Representative')}</p>
            <p className="text-[#475569] text-[9px] truncate capitalize">{role}</p>
          </div>
        </div>

        {/* Availability — only in expanded */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? 'max-h-0 opacity-0 mt-0' : 'max-h-40 opacity-100 mt-2'}`}>
          {user?.phone && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#64748B]">Availability</span>
                <button
                  onClick={handleToggle}
                  disabled={status === 'dialing' || status === 'in-call' || availabilityUpdating}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    status === 'offline' ? 'bg-[#334155]' : status === 'available' ? 'bg-[#16A34A]' : 'bg-[#F59E0B]'
                  } ${status === 'dialing' || status === 'in-call' || availabilityUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${status === 'offline' ? 'left-0.5' : 'left-4'}`} />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sm.dot }} />
                <span className="text-[10px] font-semibold" style={{ color: sm.text }}>{sm.label}</span>
              </div>
              {(status === 'in-call' || status === 'dialing') && (
                <button
                  onClick={handleResetCallStatus}
                  disabled={resettingCallStatus}
                  className="w-full text-[9px] font-bold px-2 py-1 rounded-md bg-[#1e2d45] border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resettingCallStatus ? 'Resetting...' : 'Reset to Available'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

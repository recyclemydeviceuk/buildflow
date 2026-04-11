import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Bell, BarChart2,
  FileText, Shield, Settings, Link2, BarChart3, Phone, LogOut, CalendarClock, Calculator
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { UserRole } from '../../App'
import { remindersAPI } from '../../api/reminders'
import { settingsAPI } from '../../api/settings'
import { useSocket } from '../../context/SocketContext'
import { useFeatureControls } from '../../context/FeatureControlsContext'

interface SidebarProps {
  role: UserRole
}

const managerNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Leads', icon: Users, path: '/leads' },
  { label: 'Dialer', icon: Phone, path: '/dialer' },
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
  { label: 'Dialer', icon: Phone, path: '/dialer' },
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

export default function Sidebar({ role }: SidebarProps) {
  const location = useLocation()
  const { user, logout, refreshUser, updateUser } = useAuth()
  const { socket, connected } = useSocket()
  const featureControls = useFeatureControls()
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false)
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

  const status = getDisplayAvailability(user)
  const sm = statusMeta[status]

  return (
    <aside className="fixed left-0 top-0 h-full w-[200px] flex flex-col z-40" style={{ background: '#0B1120' }}>
      {/* Brand */}
      <div className="px-4 pt-4 pb-3">
        <img src="https://res.cloudinary.com/desmurksp/image/upload/v1775226238/Buildflow_i2vkia.png" alt="BuildFlow" className="h-8 w-auto" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/agent' && item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'))
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative ${
                isActive ? 'text-white' : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
              style={isActive ? { background: 'rgba(255,255,255,0.08)' } : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#3B82F6] rounded-r-full" />
              )}
              <item.icon size={14} className={isActive ? 'text-[#3B82F6]' : 'text-[#475569] group-hover:text-[#64748B]'} />
              <span className="flex-1">{item.label}</span>
              {item.path === '/reminders' && reminderBadgeCount > 0 ? (
                <span className="min-w-[20px] h-5 px-1.5 bg-[#DC2626] rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {reminderBadgeCount}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      {/* EMI Calculator shortcut */}
      <div className="px-2 pb-1 border-t border-white/[0.06] pt-2">
        <NavLink
          to="/emi-calculator"
          className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative ${
            location.pathname === '/emi-calculator' ? 'text-white' : 'text-[#64748B] hover:text-[#94A3B8]'
          }`}
          style={location.pathname === '/emi-calculator' ? { background: 'rgba(255,255,255,0.08)' } : undefined}
        >
          {location.pathname === '/emi-calculator' && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#3B82F6] rounded-r-full" />
          )}
          <div
            className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0"
            style={{ background: location.pathname === '/emi-calculator' ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.12)' }}
          >
            <Calculator size={11} className="text-[#3B82F6]" />
          </div>
          <span className="flex-1">EMI Calculator</span>
        </NavLink>
      </div>

      {/* Settings */}
      <div className="px-2 pb-1.5 border-t border-white/[0.06] pt-2">
        <NavLink
          to="/settings"
          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            location.pathname === '/settings' ? 'text-white bg-white/[0.08]' : 'text-[#64748B] hover:text-[#94A3B8]'
          }`}
        >
          <Settings size={14} className={location.pathname === '/settings' ? 'text-[#3B82F6]' : 'text-[#475569]'} />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#DC2626] hover:bg-red-500/10 transition-all duration-150 mt-0.5"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* User card */}
      <div className="px-3 pt-2.5 pb-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)' }}>
                {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || (role === 'manager' ? 'M' : 'R')}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[11px] font-semibold truncate">{user?.name || (role === 'manager' ? 'Manager' : 'Representative')}</p>
            <p className="text-[#475569] text-[9px] truncate capitalize">{role}</p>
          </div>
        </div>

        {/* Availability toggle — representative only */}
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
          </div>
        )}
      </div>
    </aside>
  )
}

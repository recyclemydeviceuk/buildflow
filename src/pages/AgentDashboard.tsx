import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  Bell,
  ChevronRight,
  Star,
  MapPin,
  Clock3,
  RefreshCw,
} from 'lucide-react'
import { analyticsAPI, type RepDashboardResponse } from '../api/analytics'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const dispositionConfig: Record<string, { color: string; bg: string }> = {
  New: { color: '#1D4ED8', bg: '#EFF6FF' },
  'Contacted/Open': { color: '#0284C7', bg: '#F0F9FF' },
  Qualified: { color: '#059669', bg: '#ECFDF5' },
  'Visit Done': { color: '#7C3AED', bg: '#F5F3FF' },
  'Meeting Done': { color: '#9333EA', bg: '#FDF4FF' },
  'Negotiation Done': { color: '#D97706', bg: '#FFFBEB' },
  'Booking Done': { color: '#EA580C', bg: '#FFF7ED' },
  'Agreement Done': { color: '#15803D', bg: '#F0FDF4' },
  Failed: { color: '#DC2626', bg: '#FEF2F2' },
}

const formatDueLabel = (dueAt: string) => {
  const dueDate = new Date(dueAt)
  return dueDate.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AgentDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [dashboard, setDashboard] = useState<RepDashboardResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboardData = async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await analyticsAPI.getRepDashboard()
      if (response.success) {
        setDashboard(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch representative dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      void fetchDashboardData()
    }
  }, [user?.id])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchDashboardData(true)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!socket || !connected || !user) return

    const handleRefresh = () => {
      void fetchDashboardData(true)
    }

    socket.on('lead:assigned_to_you', handleRefresh)
    socket.on('lead:assigned', handleRefresh)
    socket.on('call:new', handleRefresh)
    socket.on('call:status_updated', handleRefresh)
    socket.on('reminder:due', handleRefresh)

    return () => {
      socket.off('lead:assigned_to_you', handleRefresh)
      socket.off('lead:assigned', handleRefresh)
      socket.off('call:new', handleRefresh)
      socket.off('call:status_updated', handleRefresh)
      socket.off('reminder:due', handleRefresh)
    }
  }, [socket, connected, user?.id])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const summary = dashboard?.summary
  const callsTarget = dashboard?.callsTarget || 20
  const callsToday = summary?.callsToday || 0
  const leadsAssigned = summary?.leadsAssigned || 0
  const leadsContacted = summary?.leadsContacted || 0
  const qualifiedThisWeek = summary?.qualifiedThisWeek || 0
  const overdueReminders = summary?.overdueReminders || 0
  const score = summary?.score || 0
  const rank = summary?.rank || 0

  const initials = useMemo(
    () => user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'BF',
    [user?.name]
  )

  const callPct = Math.min(100, Math.round((callsToday / Math.max(callsTarget, 1)) * 100))
  const leadPct =
    leadsAssigned > 0 ? Math.min(100, Math.round((leadsContacted / leadsAssigned) * 100)) : 0

  const cards = [
    { label: 'My Leads', value: leadsAssigned, sub: 'Assigned to you', icon: Users, color: '#1D4ED8' },
    { label: 'Calls Today', value: callsToday, sub: `Target: ${callsTarget}`, icon: Phone, color: '#16A34A' },
    { label: 'Qualified', value: qualifiedThisWeek, sub: 'This week', icon: CheckCircle2, color: '#7C3AED' },
    { label: 'Overdue', value: overdueReminders, sub: 'Needs attention', icon: AlertTriangle, color: '#DC2626' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shrink-0"
              style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)' }}
            >
              {initials}
            </div>
            <div>
              <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-0.5">{dateStr}</p>
              <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">
                {greeting}, {user?.name?.split(' ')[0] || 'Representative'}
              </h1>
              <p className="text-xs text-[#475569] mt-0.5 font-medium">
                {overdueReminders > 0
                  ? `${overdueReminders} overdue follow-up${overdueReminders > 1 ? 's' : ''} · ${callsToday} of ${callsTarget} calls done`
                  : `${callsToday} of ${callsTarget} calls done · You're on track!`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="text-right">
              <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wider">Score</p>
              <p className="text-lg font-extrabold text-[#0F172A] leading-none mt-0.5">
                {score}
                <span className="text-xs text-[#94A3B8]">/100</span>
              </p>
            </div>
            <div className="w-px h-8 bg-[#E2E8F0]" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl">
              <Star size={13} className="text-[#D97706]" fill="#D97706" />
              <span className="text-xs font-bold text-[#D97706]">
                {rank > 0 ? `Rank #${rank}` : 'Team rank pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {[
            {
              label: 'Calls Today',
              value: callsToday,
              max: callsTarget,
              pct: callPct,
              color: '#1D4ED8',
              pastel: '#EFF6FF',
            },
            {
              label: 'Leads Contacted',
              value: leadsContacted,
              max: leadsAssigned,
              pct: leadPct,
              color: '#16A34A',
              pastel: '#F0FDF4',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl p-3 border border-[#F1F5F9]"
              style={{ background: item.pastel }}
            >
              <div className="flex justify-between mb-2">
                <p className="text-[#475569] text-xs font-semibold">{item.label}</p>
                <p className="text-[#0F172A] text-xs font-bold">
                  {item.value}/{item.max}
                </p>
              </div>
              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${item.pct}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5"
            >
              <div className="h-1 w-full" style={{ background: card.color }} />
              <div className="p-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${card.color}14` }}
                >
                  <card.icon size={14} style={{ color: card.color }} />
                </div>
                <p className="text-xl font-extrabold text-[#0F172A]">{card.value}</p>
                <p className="text-xs font-semibold text-[#475569] mt-0.5">{card.label}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3 bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">My Leads</h2>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Your active pipeline</p>
              </div>
              <button
                onClick={() => navigate('/leads')}
                className="flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline"
              >
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div>
              {loading ? (
                <div className="p-10 text-center text-[#94A3B8] text-sm italic">Loading leads...</div>
              ) : !dashboard?.leads?.length ? (
                <div className="p-10 text-center text-[#94A3B8] text-sm">No leads assigned to you yet.</div>
              ) : (
                dashboard.leads.map((lead, index) => {
                  const config = dispositionConfig[lead.disposition] || { color: '#94A3B8', bg: '#F8FAFC' }
                  return (
                    <div
                      key={lead._id}
                      className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-[#F8FAFC] transition-colors group ${
                        index < dashboard.leads.length - 1 ? 'border-b border-[#F8FAFC]' : ''
                      }`}
                      onClick={() => navigate(`/leads/${lead._id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{lead.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin size={8} className="text-[#CBD5E1] shrink-0" />
                          <p className="text-[10px] text-[#94A3B8] truncate">
                            {lead.city} · {lead.source} · {lead.budget || 'No budget'}
                          </p>
                        </div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ background: config.bg, color: config.color }}
                      >
                        {lead.disposition}
                      </span>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ background: config.bg, color: config.color }}
                      >
                        {lead.name
                          .split(' ')
                          .map((part: string) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="col-span-2 space-y-3">
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div
                className="h-1 w-full"
                style={{ background: dashboard?.manualAssignmentEnabled ? 'linear-gradient(90deg, #1D4ED8, #3B82F6)' : 'linear-gradient(90deg, #16A34A, #22C55E)' }}
              />
              <div className="p-3 space-y-1.5">
                <p className="text-xs font-bold text-[#0F172A]">
                  {dashboard?.manualAssignmentEnabled ? 'Manual lead assignment' : 'Auto lead routing'}
                </p>
                <p className="text-[10px] text-[#64748B] leading-relaxed">
                  {dashboard?.manualAssignmentEnabled
                    ? 'Managers now route all new leads manually. You will only see leads after they are assigned to you.'
                    : 'New leads are routed automatically. Your dashboard reflects every assigned lead in real time.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-3 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-[#475569]" />
                  <p className="text-xs font-bold text-[#0F172A]">My Reminders</p>
                </div>
                <button
                  onClick={() => navigate('/reminders')}
                  className="text-[11px] text-[#1D4ED8] font-semibold hover:underline"
                >
                  View all
                </button>
              </div>
              <div>
                {loading ? (
                  <div className="p-8 text-center text-[#94A3B8] text-sm italic">Loading reminders...</div>
                ) : !dashboard?.reminders?.length ? (
                  <div className="p-10 text-center text-[#94A3B8] text-sm">
                    No active reminders right now.
                  </div>
                ) : (
                  dashboard.reminders.map((reminder, index) => {
                    const statusColor =
                      reminder.status === 'overdue'
                        ? 'text-[#DC2626] bg-[#FEF2F2]'
                        : reminder.status === 'due_soon'
                          ? 'text-[#D97706] bg-[#FFFBEB]'
                          : 'text-[#1D4ED8] bg-[#EFF6FF]'

                    return (
                      <button
                        key={reminder._id}
                        type="button"
                        onClick={() => navigate('/reminders')}
                        className={`w-full text-left px-3 py-2 hover:bg-[#F8FAFC] transition-colors ${
                          index < dashboard.reminders.length - 1 ? 'border-b border-[#F8FAFC]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#0F172A] truncate">{reminder.title}</p>
                            <p className="text-[10px] text-[#94A3B8] truncate mt-0.5">{reminder.leadName}</p>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-[#64748B]">
                              <Clock3 size={11} />
                              <span>{formatDueLabel(reminder.dueAt)}</span>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize shrink-0 ${statusColor}`}>
                            {reminder.status.replace('_', ' ')}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-3 py-2.5 border-b border-[#F1F5F9] flex items-center gap-2">
                <TrendingUp size={13} className="text-[#475569]" />
                <p className="text-xs font-bold text-[#0F172A]">Team Leaderboard</p>
              </div>
              <div className="p-3 space-y-2">
                {dashboard?.leaderboard?.length ? (
                  dashboard.leaderboard.map((agent) => {
                    const isCurrentUser = agent.id === user?.id
                    return (
                      <div
                        key={agent.id}
                        className={`flex items-center gap-3 p-2 rounded-xl ${
                          isCurrentUser ? 'bg-[#EFF6FF] border border-[#BFDBFE]' : ''
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                            agent.rank === 1 ? 'bg-[#FEF9C3] text-[#D97706]' : 'bg-[#F1F5F9] text-[#475569]'
                          }`}
                        >
                          {agent.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isCurrentUser ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>
                            {isCurrentUser ? 'You' : agent.name}
                          </p>
                          <p className="text-[10px] text-[#94A3B8]">
                            {agent.callsToday} calls · {agent.qualifiedThisWeek} qualified
                          </p>
                        </div>
                        <p className="text-xs font-bold text-[#0F172A] shrink-0">{agent.score}</p>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-6 text-center text-[#94A3B8] text-sm">Leaderboard will appear once calls start flowing.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Award, Clock, Phone, RefreshCw, Target, TrendingUp, Users } from 'lucide-react'
import { analyticsAPI } from '../api/analytics'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

type DateRangeKey = 'Today' | 'This Week' | 'This Month' | 'Last Month'

function computeDateRange(range: DateRangeKey): { dateFrom?: string; dateTo?: string } {
  const now = new Date()
  const toISO = (value: Date) => value.toISOString()

  if (range === 'Today') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    return { dateFrom: toISO(from), dateTo: toISO(now) }
  }

  if (range === 'This Week') {
    const from = new Date(now)
    const day = from.getDay()
    const diff = (day + 6) % 7
    from.setDate(from.getDate() - diff)
    from.setHours(0, 0, 0, 0)
    return { dateFrom: toISO(from), dateTo: toISO(now) }
  }

  if (range === 'This Month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dateFrom: toISO(from), dateTo: toISO(now) }
  }

  if (range === 'Last Month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return { dateFrom: toISO(from), dateTo: toISO(to) }
  }

  return {}
}

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins}m ${secs}s`
}

export default function PerformanceDashboard() {
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [period, setPeriod] = useState<DateRangeKey>('This Week')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof analyticsAPI.getRepPerformanceDashboard>>['data'] | null>(null)

  const params = useMemo(() => computeDateRange(period), [period])

  const load = async (background = false) => {
    try {
      if (background) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await analyticsAPI.getRepPerformanceDashboard(params)
      if (response.success) {
        setData(response.data)
      }
    } catch (err) {
      console.error('Failed to load representative performance dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [period])

  useEffect(() => {
    if (!socket || !connected || !user) return

    const handleRefresh = () => {
      void load(true)
    }

    socket.on('call:new', handleRefresh)
    socket.on('call:status_updated', handleRefresh)
    socket.on('lead:assigned_to_you', handleRefresh)

    return () => {
      socket.off('call:new', handleRefresh)
      socket.off('call:status_updated', handleRefresh)
      socket.off('lead:assigned_to_you', handleRefresh)
    }
  }, [socket, connected, user?.id, period])

  const kpis = [
    {
      label: 'Total Calls',
      value: data?.summary.totalCalls ?? 0,
      icon: Phone,
      color: '#1D4ED8',
      bg: '#EFF6FF',
    },
    {
      label: 'Qualified Leads',
      value: data?.summary.qualifiedLeads ?? 0,
      icon: Users,
      color: '#16A34A',
      bg: '#F0FDF4',
    },
    {
      label: 'Conversion Rate',
      value:
        data?.summary.conversionRate != null
          ? `${Number(data.summary.conversionRate).toFixed(1)}%`
          : '0.0%',
      icon: Target,
      color: '#D97706',
      bg: '#FFFBEB',
    },
    {
      label: 'Avg Call Duration',
      value: formatDuration(data?.summary.avgCallDuration ?? 0),
      icon: Clock,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Performance Dashboard</h1>
            <p className="text-xs text-[#475569] mt-0.5">Representative performance — live metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] shadow-sm"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="flex items-center gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5">
              {(['Today', 'This Week', 'This Month', 'Last Month'] as DateRangeKey[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    period === value ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {kpis.map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: item.bg }}>
                  <item.icon size={13} style={{ color: item.color }} />
                </div>
              </div>
              <p className="text-[10px] text-[#64748B] font-semibold">{item.label}</p>
              <p className="text-lg font-extrabold text-[#0F172A] mt-0.5">
                {loading ? '…' : item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target size={13} className="text-[#1D4ED8]" />
              <p className="text-sm font-bold text-[#0F172A]">Source Performance</p>
            </div>

            {loading ? (
              <p className="text-sm text-[#94A3B8]">Loading source performance...</p>
            ) : !data?.sourcePerformance?.length ? (
              <p className="text-sm text-[#94A3B8]">No source data for this range.</p>
            ) : (
              <div className="space-y-2">
                {data.sourcePerformance.map((source) => (
                  <div key={source.source} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A]">{source.source}</p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {source.qualifiedLeads} qual · {source.wonLeads} won
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#0F172A]">{source.totalLeads} leads</p>
                      <p className="text-[10px] font-bold text-[#1D4ED8]">
                        {Number(source.conversionRate ?? 0).toFixed(1)}% conv
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award size={13} className="text-[#1D4ED8]" />
                <p className="text-sm font-bold text-[#0F172A]">Rep Leaderboard</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                <TrendingUp size={11} />
                <span>Sorted by calls</span>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-[#94A3B8]">Loading leaderboard...</p>
            ) : !data?.leaderboard?.length ? (
              <p className="text-sm text-[#94A3B8]">No rep performance data for this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      {['#', 'Rep', 'Calls', 'Conn.', 'Qual.', 'Conv.', 'Avg Dur.', 'Score'].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-2 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((rep) => {
                      const isCurrentUser = rep.id === user?.id
                      return (
                        <tr key={rep.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="px-3 py-2.5">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                rep.rank === 1
                                  ? 'bg-[#FFFBEB] text-[#F59E0B]'
                                  : rep.rank === 2
                                    ? 'bg-[#F8FAFC] text-[#94A3B8]'
                                    : rep.rank === 3
                                      ? 'bg-[#FEF2F2] text-[#DC2626]'
                                      : 'bg-[#F8FAFC] text-[#94A3B8]'
                              }`}
                            >
                              {rep.rank}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${isCurrentUser ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F8FAFC] text-[#475569]'}`}>
                                {String(rep.representativeName || '?').split(' ').map((part) => part[0]).join('').slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-semibold truncate max-w-[90px] ${isCurrentUser ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>
                                  {isCurrentUser ? 'You' : rep.representativeName}
                                </p>
                                <p className="text-[9px] text-[#94A3B8]">{rep.phone || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-bold text-[#0F172A]">{rep.totalCalls}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-[#16A34A]">{rep.connectedCalls}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-[#7C3AED]">{rep.qualifiedLeads}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-[#1D4ED8]">
                            {Number(rep.conversionRate ?? 0).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#475569]">{formatDuration(rep.avgDuration)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className="h-full bg-[#1D4ED8] rounded-full" style={{ width: `${Math.min(rep.score, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-[#0F172A]">{rep.score}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Award, BarChart2, Phone, Target, TrendingUp, Users, Clock } from 'lucide-react'
import { analyticsAPI } from '../api/analytics'

type DateRangeKey = 'Today' | 'This Week' | 'This Month' | 'Last Month'

function computeDateRange(range: DateRangeKey): { dateFrom?: string; dateTo?: string } {
  const now = new Date()
  const toISO = (d: Date) => d.toISOString()

  if (range === 'Today') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    return { dateFrom: toISO(from), dateTo: toISO(now) }
  }
  if (range === 'This Week') {
    const from = new Date(now)
    const day = from.getDay() // 0..6
    const diff = (day + 6) % 7 // Monday start
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
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { dateFrom: toISO(from), dateTo: toISO(to) }
  }
  return {}
}

export default function PerformanceDashboardConnected() {
  const [period, setPeriod] = useState<DateRangeKey>('This Week')
  const [kpis, setKpis] = useState<any>(null)
  const [repPerformance, setRepPerformance] = useState<any[]>([])
  const [sourcePerformance, setSourcePerformance] = useState<any[]>([])

  const params = useMemo(() => computeDateRange(period), [period])

  useEffect(() => {
    const load = async () => {
      try {
        const [kpiRes, repRes, srcRes] = await Promise.all([
          analyticsAPI.getKPIs(params),
          analyticsAPI.getRepPerformance(params),
          analyticsAPI.getSourcePerformance(params),
        ])
        if (kpiRes.success) setKpis(kpiRes.data)
        if (repRes.success) setRepPerformance(repRes.data || [])
        if (srcRes.success) setSourcePerformance(srcRes.data || [])
      } catch (err) {
        console.error('Failed to load performance:', err)
      }
    }
    load()
  }, [params])

  const overallAvgDurationSeconds = useMemo(() => {
    if (!repPerformance.length) return 0
    const totalDuration = repPerformance.reduce((acc, r) => acc + (r.totalDuration ?? 0), 0)
    const totalCalls = repPerformance.reduce((acc, r) => acc + (r.totalCalls ?? 0), 0)
    if (!totalCalls) return 0
    return Math.floor(totalDuration / totalCalls)
  }, [repPerformance])

  const fmtDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
    const m = Math.floor(safeSeconds / 60)
    const s = safeSeconds % 60
    return `${m}m ${s}s`
  }

  const sortedRep = useMemo(() => {
    return [...repPerformance].sort((a, b) => (b.totalCalls ?? 0) - (a.totalCalls ?? 0))
  }, [repPerformance])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Performance Dashboard</h1>
            <p className="text-sm text-[#475569] mt-0.5">Team-wide performance (backend-driven)</p>
          </div>
          <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(['Today', 'This Week', 'This Month', 'Last Month'] as DateRangeKey[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  period === p ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Calls', value: kpis?.totalCalls ?? 0, icon: Phone, color: '#1D4ED8', bg: '#EFF6FF' },
            { label: 'Qualified Leads', value: kpis?.qualifiedLeads ?? 0, icon: Users, color: '#16A34A', bg: '#F0FDF4' },
            { label: 'Conversion Rate', value: kpis?.conversionRate != null ? `${Number(kpis.conversionRate).toFixed(1)}%` : '0.0%', icon: Target, color: '#D97706', bg: '#FFFBEB' },
            { label: 'Avg Call Duration', value: fmtDuration(overallAvgDurationSeconds), icon: Clock, color: '#7C3AED', bg: '#F5F3FF' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                  <k.icon size={20} style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-xs text-[#64748B] font-semibold">{k.label}</p>
              <p className="text-2xl font-extrabold text-[#0F172A] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={15} className="text-[#1D4ED8]" />
              <p className="text-sm font-bold text-[#0F172A]">Source Performance</p>
            </div>
            {sourcePerformance.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No source data.</p>
            ) : (
              <div className="space-y-3">
                {sourcePerformance.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{s.source}</p>
                      <p className="text-xs text-[#94A3B8]">{s.wonLeads} won · {s.qualifiedLeads} qualified</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0F172A]">{s.totalLeads} leads</p>
                      <p className="text-xs font-bold text-[#1D4ED8]">{Number(s.conversionRate ?? 0).toFixed(1)}% conv</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award size={15} className="text-[#1D4ED8]" />
                <p className="text-sm font-bold text-[#0F172A]">Rep Leaderboard</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <TrendingUp size={14} />
                <span>Sorted by calls</span>
              </div>
            </div>

            {sortedRep.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No rep performance data for this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      {['Rep', 'Calls Made', 'Connected', 'Avg Duration'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRep.map((r: any) => {
                      const connectedCalls = r.connectedCalls ?? 0
                      const totalCalls = r.totalCalls ?? 0
                      const conv = totalCalls ? (connectedCalls / totalCalls) * 100 : 0
                      return (
                        <tr key={r._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 text-sm font-semibold text-[#0F172A]">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-bold text-[#1D4ED8]">
                                {String(r.representativeName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold">{r.representativeName}</p>
                                <p className="text-xs text-[#94A3B8]">{conv.toFixed(1)}% connect</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">{totalCalls}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{connectedCalls}</td>
                          <td className="px-4 py-3 text-sm text-[#475569]">{fmtDuration(r.avgDuration ?? 0)}</td>
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


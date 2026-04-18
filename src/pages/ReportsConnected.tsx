import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Phone,
  CheckCircle2,
  XCircle,
  Trophy,
  Medal,
  Target,
} from 'lucide-react'
import { analyticsAPI } from '../api/analytics'
import { reportsAPI } from '../api/reports'

type ReportKey = 'leads' | 'calls' | 'conversion' | 'rep'
type DateRangeKey = 'This Week' | 'This Month' | 'Last Month' | 'Last 3 Months' | 'Custom'

// ───────────────────────── palette + helpers ─────────────────────────

const DISPOSITION_COLORS: Record<string, string> = {
  New: '#64748B',
  'Contacted/Open': '#3B82F6',
  Qualified: '#8B5CF6',
  'Visit Done': '#06B6D4',
  'Meeting Done': '#0EA5E9',
  'Negotiation Done': '#F59E0B',
  'Booking Done': '#16A34A',
  'Agreement Done': '#059669',
  Failed: '#DC2626',
}

const SOURCE_COLORS: Record<string, string> = {
  Meta: '#1877F2',
  Website: '#0EA5E9',
  Direct: '#F59E0B',
  Manual: '#64748B',
  Whatsapp: '#25D366',
  WhatsApp: '#25D366',
  'Google ADS': '#EA4335',
  'Google Ads': '#EA4335',
  Instagram: '#E1306C',
  'Instagram DM': '#E1306C',
  Referral: '#8B5CF6',
  Budigere: '#94A3B8',
}

const FUNNEL_ORDER = [
  'New',
  'Contacted/Open',
  'Qualified',
  'Visit Done',
  'Meeting Done',
  'Negotiation Done',
  'Booking Done',
  'Agreement Done',
]

const colorFor = (map: Record<string, string>, key: string, fallback = '#64748B') =>
  map[key] || fallback

function computeDateRange(range: DateRangeKey): { dateFrom?: string; dateTo?: string } {
  const now = new Date()
  const toISO = (d: Date) => d.toISOString()
  if (range === 'Custom') return {}
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
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { dateFrom: toISO(from), dateTo: toISO(to) }
  }
  if (range === 'Last 3 Months') {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 3)
    return { dateFrom: toISO(from), dateTo: toISO(now) }
  }
  return {}
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ───────────────────────── chart components ─────────────────────────

type BarDatum = { label: string; value: number; color?: string }

function HorizontalBars({ data, max }: { data: BarDatum[]; max?: number }) {
  const cap = max ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = Math.max((d.value / cap) * 100, d.value > 0 ? 2 : 0)
        const color = d.color || '#1D4ED8'
        return (
          <div key={d.label} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#334155] truncate pr-2">{d.label}</span>
              <span className="text-xs font-bold text-[#0F172A] tabular-nums">{d.value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-90"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                  boxShadow: `0 1px 2px ${color}40`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Donut({ data, total, label }: { data: BarDatum[]; total: number; label: string }) {
  const size = 180
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  let offset = 0
  const segments = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0
    const len = pct * circumference
    const seg = {
      ...d,
      dashArray: `${len} ${circumference - len}`,
      dashOffset: -offset,
    }
    offset += len
    return seg
  })

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color || '#1D4ED8'}
            strokeWidth={stroke}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
          />
        ))}
        <g transform={`rotate(90 ${cx} ${cy})`}>
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="24" fontWeight="800" fill="#0F172A">
            {total.toLocaleString()}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#94A3B8" fontWeight="600">
            {label}
          </text>
        </g>
      </svg>
      <div className="flex-1 space-y-2 min-w-0">
        {data.map((d) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
          return (
            <div key={d.label} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: d.color || '#1D4ED8' }}
              />
              <span className="text-xs font-semibold text-[#334155] flex-1 truncate">{d.label}</span>
              <span className="text-xs font-bold text-[#0F172A] tabular-nums">{d.value}</span>
              <span className="text-[10px] text-[#94A3B8] w-10 text-right tabular-nums">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Funnel({ stages }: { stages: { stage: string; count: number }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const pct = (s.count / max) * 100
        const prev = i > 0 ? stages[i - 1].count : null
        const drop = prev !== null && prev > 0 ? (((prev - s.count) / prev) * 100).toFixed(0) : null
        const color = colorFor(DISPOSITION_COLORS, s.stage, '#3B82F6')
        return (
          <div key={s.stage} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs font-semibold text-[#334155]">{s.stage}</div>
            <div className="flex-1 relative h-10 rounded-lg bg-[#F8FAFC] overflow-hidden">
              <div
                className="h-full flex items-center px-3 transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 6)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}DD)`,
                  boxShadow: `0 2px 8px ${color}30`,
                }}
              >
                <span className="text-xs font-bold text-white tabular-nums">{s.count}</span>
              </div>
            </div>
            <div className="w-16 text-right shrink-0">
              {drop !== null && Number(drop) > 0 ? (
                <span className="text-[10px] font-bold text-[#DC2626]">−{drop}%</span>
              ) : drop !== null && Number(drop) === 0 ? (
                <span className="text-[10px] font-bold text-[#16A34A]">0%</span>
              ) : (
                <span className="text-[10px] text-[#94A3B8]">—</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: any
  label: string
  value: string | number
  accent: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}CC)` }}
        >
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-[#0F172A] tabular-nums leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-[11px] text-[#64748B] font-semibold mt-1.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  accent = '#1D4ED8',
  children,
}: {
  title: string
  subtitle?: string
  icon?: any
  accent?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-3">
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent}14` }}
          >
            <Icon size={14} style={{ color: accent }} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[#0F172A]">{title}</p>
          {subtitle && <p className="text-[11px] text-[#94A3B8] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-xs text-[#94A3B8] italic py-6 text-center">{message}</p>
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10 text-[#94A3B8] text-sm">
      <div className="w-4 h-4 border-2 border-[#CBD5E1] border-t-[#1D4ED8] rounded-full animate-spin mr-2" />
      Loading…
    </div>
  )
}

// ───────────────────────── main component ─────────────────────────

export default function ReportsConnected() {
  const [activeReport, setActiveReport] = useState<ReportKey>('leads')
  const [dateRange, setDateRange] = useState<DateRangeKey>('This Month')
  const params = useMemo(() => computeDateRange(dateRange), [dateRange])

  const [leadPipeline, setLeadPipeline] = useState<any>(null)
  const [callActivity, setCallActivity] = useState<any>(null)
  const [conversionFunnel, setConversionFunnel] = useState<any>(null)
  const [repPerformance, setRepPerformance] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [leadRes, callRes, funnelRes, repRes] = await Promise.all([
          reportsAPI.getLeadPipelineReport(params),
          reportsAPI.getCallActivityReport(params),
          analyticsAPI.getConversionFunnel(params),
          analyticsAPI.getRepPerformance(params),
        ])
        if (leadRes.success) setLeadPipeline(leadRes.data)
        if (callRes.success) setCallActivity(callRes.data)
        if (funnelRes.success) setConversionFunnel(funnelRes.data)
        if (repRes.success) setRepPerformance(repRes.data)
      } catch (err) {
        console.error('Failed to load reports:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params])

  const exportCSV = async () => {
    try {
      if (activeReport === 'calls') {
        const blob = await reportsAPI.exportCallsCSV(params)
        downloadBlob(blob, 'calls_export.csv')
      } else {
        const blob = await reportsAPI.exportLeadsCSV(params)
        downloadBlob(blob, 'leads_export.csv')
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const reportTypes: { id: ReportKey; label: string; icon: any; desc: string; accent: string }[] = [
    { id: 'leads', label: 'Lead Pipeline', icon: TrendingUp, desc: 'By disposition, source, city', accent: '#1D4ED8' },
    { id: 'calls', label: 'Call Activity', icon: BarChart3, desc: 'Call outcome & rep activity', accent: '#7C3AED' },
    { id: 'conversion', label: 'Conversion Funnel', icon: PieChart, desc: 'Stage-by-stage drop-off', accent: '#16A34A' },
    { id: 'rep', label: 'Rep Performance', icon: FileText, desc: 'Leaderboard + connect counts', accent: '#F59E0B' },
  ]

  // ─── derived data for Lead Pipeline ───
  const dispositionBars: BarDatum[] =
    leadPipeline?.byDisposition?.map((d: any) => ({
      label: d._id || 'Unknown',
      value: d.count,
      color: colorFor(DISPOSITION_COLORS, d._id, '#64748B'),
    })) || []

  const sourceBars: BarDatum[] =
    leadPipeline?.bySource?.map((d: any) => ({
      label: d._id || 'Unknown',
      value: d.count,
      color: colorFor(SOURCE_COLORS, d._id, '#64748B'),
    })) || []

  const cityBars: BarDatum[] =
    leadPipeline?.byCity?.slice(0, 8).map((d: any, i: number) => ({
      label: d._id || 'Unknown',
      value: d.count,
      color: ['#1D4ED8', '#3B82F6', '#0EA5E9', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B', '#16A34A'][i % 8],
    })) || []

  const totalLeads = dispositionBars.reduce((sum, b) => sum + b.value, 0)
  const totalSourceLeads = sourceBars.reduce((sum, b) => sum + b.value, 0)

  // ─── derived data for Call Activity ───
  const outcomeMap: Record<string, number> = {}
  ;(callActivity?.byOutcome || []).forEach((d: any) => {
    outcomeMap[d._id || 'Unknown'] = d.count
  })
  const totalCalls = Object.values(outcomeMap).reduce((a, b) => a + b, 0)
  const connected = outcomeMap['Connected'] || 0
  const notAnswered = outcomeMap['Not Answered'] || outcomeMap['No Answer'] || 0
  const busy = outcomeMap['Busy'] || 0
  const connectRate = totalCalls > 0 ? ((connected / totalCalls) * 100).toFixed(1) : '0'

  const outcomeBars: BarDatum[] = Object.entries(outcomeMap).map(([label, value]) => ({
    label,
    value,
    color:
      label === 'Connected'
        ? '#16A34A'
        : label === 'Busy'
        ? '#F59E0B'
        : label.toLowerCase().includes('not')
        ? '#DC2626'
        : '#64748B',
  }))

  // ─── derived data for Conversion Funnel ───
  const funnelData = (conversionFunnel || [])
    .filter((f: any) => FUNNEL_ORDER.includes(f.stage))
    .sort((a: any, b: any) => FUNNEL_ORDER.indexOf(a.stage) - FUNNEL_ORDER.indexOf(b.stage))
  const newCount = funnelData[0]?.count || 0
  const wonCount = funnelData[funnelData.length - 1]?.count || 0
  const winRate = newCount > 0 ? ((wonCount / newCount) * 100).toFixed(1) : '0'

  // ─── derived data for Rep Performance ───
  const sortedReps = (repPerformance || []).slice().sort((a: any, b: any) => (b.totalCalls || 0) - (a.totalCalls || 0))
  const topReps = sortedReps.slice(0, 3)
  const maxCalls = Math.max(...sortedReps.map((r: any) => r.totalCalls || 0), 1)

  // ─────────────────── render ───────────────────

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg font-extrabold text-[#0F172A] tracking-tight">Reports</h1>
            <p className="text-xs text-[#64748B] mt-0.5">Backend-driven analytics with CSV exports</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              className="h-9 px-3 pr-8 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#475569] appearance-none bg-no-repeat bg-[right_10px_center] bg-[length:10px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50 hover:border-[#CBD5E1] transition-colors"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
              }}
            >
              {(['This Week', 'This Month', 'Last Month', 'Last 3 Months', 'Custom'] as DateRangeKey[]).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white text-xs font-bold rounded-lg hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.97] transition-all"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto flex gap-5">
        {/* Sidebar — report type tabs */}
        <div className="w-60 shrink-0 space-y-1.5">
          <p className="text-[9px] font-extrabold text-[#94A3B8] uppercase tracking-widest px-2 mb-2">Report Type</p>
          {reportTypes.map((r) => {
            const active = activeReport === r.id
            return (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                  active
                    ? 'bg-white border-[#BFDBFE] shadow-sm ring-2 ring-[#1D4ED8]/10'
                    : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{ background: active ? r.accent : `${r.accent}14` }}
                  >
                    <r.icon size={13} style={{ color: active ? 'white' : r.accent }} />
                  </div>
                  <p className={`text-xs font-bold ${active ? 'text-[#0F172A]' : 'text-[#334155]'}`}>{r.label}</p>
                </div>
                <p className="text-[10px] text-[#94A3B8] leading-relaxed pl-[38px]">{r.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* ─── LEAD PIPELINE ─── */}
          {activeReport === 'leads' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Users} label="Total Leads" value={totalLeads} accent="#1D4ED8" />
                <StatCard
                  icon={CheckCircle2}
                  label="Active Pipeline"
                  value={totalLeads - (dispositionBars.find((d) => d.label === 'Failed')?.value || 0)}
                  accent="#16A34A"
                />
                <StatCard
                  icon={XCircle}
                  label="Failed"
                  value={dispositionBars.find((d) => d.label === 'Failed')?.value || 0}
                  accent="#DC2626"
                />
              </div>

              <SectionCard
                title="Leads by Disposition"
                subtitle="Distribution across pipeline stages"
                icon={TrendingUp}
                accent="#1D4ED8"
              >
                {loading ? (
                  <LoadingState />
                ) : dispositionBars.length === 0 ? (
                  <EmptyState message="No disposition data for this period." />
                ) : (
                  <HorizontalBars data={dispositionBars} />
                )}
              </SectionCard>

              <div className="grid grid-cols-2 gap-5">
                <SectionCard
                  title="Leads by Source"
                  subtitle={`${totalSourceLeads.toLocaleString()} leads across sources`}
                  icon={PieChart}
                  accent="#7C3AED"
                >
                  {loading ? (
                    <LoadingState />
                  ) : sourceBars.length === 0 ? (
                    <EmptyState message="No source data for this period." />
                  ) : (
                    <Donut data={sourceBars} total={totalSourceLeads} label="leads" />
                  )}
                </SectionCard>

                <SectionCard title="Top Cities" subtitle="Top 8 by lead count" icon={Target} accent="#F59E0B">
                  {loading ? (
                    <LoadingState />
                  ) : cityBars.length === 0 ? (
                    <EmptyState message="No city data for this period." />
                  ) : (
                    <HorizontalBars data={cityBars} />
                  )}
                </SectionCard>
              </div>
            </>
          )}

          {/* ─── CALL ACTIVITY ─── */}
          {activeReport === 'calls' && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <StatCard icon={Phone} label="Total Calls" value={totalCalls} accent="#1D4ED8" />
                <StatCard
                  icon={CheckCircle2}
                  label="Connected"
                  value={connected}
                  accent="#16A34A"
                  sub={`${connectRate}% connect rate`}
                />
                <StatCard icon={XCircle} label="Not Answered" value={notAnswered} accent="#DC2626" />
                <StatCard icon={Phone} label="Busy" value={busy} accent="#F59E0B" />
              </div>

              <SectionCard
                title="Calls by Outcome"
                subtitle="Breakdown of every dialed call"
                icon={BarChart3}
                accent="#7C3AED"
              >
                {loading ? (
                  <LoadingState />
                ) : outcomeBars.length === 0 ? (
                  <EmptyState message="No call data for this period." />
                ) : (
                  <HorizontalBars data={outcomeBars} />
                )}
              </SectionCard>

              <SectionCard
                title="Calls by Representative"
                subtitle="Who's making the most contact"
                icon={Users}
                accent="#1D4ED8"
              >
                {loading ? (
                  <LoadingState />
                ) : !callActivity?.byRep?.length ? (
                  <EmptyState message="No rep activity recorded." />
                ) : (
                  <div className="space-y-3">
                    {callActivity.byRep.map((r: any) => {
                      const rate = r.total > 0 ? (r.connected / r.total) * 100 : 0
                      const avg = r.total ? Math.round((r.totalDuration ?? 0) / r.total) : 0
                      return (
                        <div
                          key={r._id}
                          className="flex items-center gap-4 p-3 rounded-xl border border-[#F1F5F9] hover:border-[#E2E8F0] hover:bg-[#FAFCFF] transition-all"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] text-[#1D4ED8] text-xs font-extrabold flex items-center justify-center shrink-0 ring-1 ring-[#BFDBFE]/60">
                            {String(r.name || '?')
                              .split(' ')
                              .map((p: string) => p[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-bold text-[#0F172A] truncate">{r.name}</p>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] text-[#94A3B8] font-semibold">
                                  <span className="text-[#16A34A] font-bold">{r.connected}</span> / {r.total}
                                </span>
                                <span className="text-[10px] text-[#64748B]">{avg}s avg</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${rate}%`,
                                  background: 'linear-gradient(90deg, #16A34A, #22C55E)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ─── CONVERSION FUNNEL ─── */}
          {activeReport === 'conversion' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Users} label="Entered Funnel" value={newCount} accent="#3B82F6" />
                <StatCard icon={Trophy} label="Reached Final Stage" value={wonCount} accent="#16A34A" />
                <StatCard
                  icon={Target}
                  label="Win Rate"
                  value={`${winRate}%`}
                  accent="#F59E0B"
                  sub={`${wonCount} of ${newCount}`}
                />
              </div>

              <SectionCard
                title="Stage-by-Stage Drop-off"
                subtitle="How many leads move through each stage"
                icon={PieChart}
                accent="#16A34A"
              >
                {loading ? (
                  <LoadingState />
                ) : funnelData.length === 0 ? (
                  <EmptyState message="No funnel data for this period." />
                ) : (
                  <Funnel stages={funnelData} />
                )}
              </SectionCard>
            </>
          )}

          {/* ─── REP PERFORMANCE ─── */}
          {activeReport === 'rep' && (
            <>
              {topReps.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {topReps.map((r: any, i: number) => {
                    const medals = [
                      { icon: Trophy, accent: '#F59E0B', label: '1st' },
                      { icon: Medal, accent: '#94A3B8', label: '2nd' },
                      { icon: Medal, accent: '#D97706', label: '3rd' },
                    ]
                    const m = medals[i]
                    return (
                      <div
                        key={r._id}
                        className="bg-white rounded-2xl border border-[#E2E8F0] p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${m.accent}, ${m.accent}CC)` }}
                          >
                            <m.icon size={16} className="text-white" />
                          </div>
                          <span
                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                            style={{ background: `${m.accent}14`, color: m.accent }}
                          >
                            {m.label}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[#0F172A] truncate">{r.representativeName}</p>
                        <div className="flex items-end gap-2 mt-2">
                          <p className="text-2xl font-extrabold text-[#0F172A] tabular-nums leading-none">{r.totalCalls}</p>
                          <p className="text-[10px] text-[#94A3B8] font-semibold pb-0.5">calls</p>
                        </div>
                        <p className="text-[10px] text-[#16A34A] font-bold mt-1">
                          {r.connectedCalls} connected
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              <SectionCard
                title="Full Leaderboard"
                subtitle="Every rep ranked by call volume"
                icon={Users}
                accent="#F59E0B"
              >
                {loading ? (
                  <LoadingState />
                ) : sortedReps.length === 0 ? (
                  <EmptyState message="No rep performance data." />
                ) : (
                  <div className="space-y-3">
                    {sortedReps.map((r: any, i: number) => {
                      const pct = ((r.totalCalls || 0) / maxCalls) * 100
                      const connRate = r.totalCalls > 0 ? ((r.connectedCalls / r.totalCalls) * 100).toFixed(0) : '0'
                      return (
                        <div
                          key={r._id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-[#F1F5F9] hover:bg-[#FAFCFF] transition-colors"
                        >
                          <span className="w-5 text-[11px] font-extrabold text-[#94A3B8] text-right tabular-nums shrink-0">
                            {i + 1}
                          </span>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] text-[#B45309] text-xs font-extrabold flex items-center justify-center shrink-0 ring-1 ring-[#FDE68A]">
                            {String(r.representativeName || '?')
                              .split(' ')
                              .map((p: string) => p[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-bold text-[#0F172A] truncate">{r.representativeName}</p>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] text-[#94A3B8] font-semibold">
                                  <span className="text-[#0F172A] font-bold">{r.totalCalls}</span> calls
                                </span>
                                <span className="text-[10px] text-[#16A34A] font-bold">{connRate}%</span>
                                <span className="text-[10px] text-[#64748B]">{Math.round(r.avgDuration ?? 0)}s</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pct}%`,
                                  background: 'linear-gradient(90deg, #F59E0B, #F97316)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

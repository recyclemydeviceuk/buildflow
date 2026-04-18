import { useEffect, useMemo, useState } from 'react'
import {
  Link2,
  PieChart,
  ListFilter,
  BarChart3,
  Users,
  Phone,
  CheckCircle2,
  Trophy,
  Target,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { analyticsAPI } from '../api/analytics'

type TabKey = 'utm' | 'sources' | 'funnel' | 'visual'
type DateRangeKey = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'This Month' | 'Last Month' | 'Custom'

// ───────────────────────── palette + helpers ─────────────────────────

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
  if (range === 'This Month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dateFrom: toISO(from), dateTo: toISO(now) }
  }
  if (range === 'Last Month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { dateFrom: toISO(from), dateTo: toISO(to) }
  }
  const days = range === 'Last 7 days' ? 7 : range === 'Last 30 days' ? 30 : 90
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { dateFrom: toISO(from), dateTo: toISO(now) }
}

// ───────────────────────── shared components ─────────────────────────

type BarDatum = { label: string; value: number; color?: string; sublabel?: string }

function HorizontalBars({ data, max, showSublabel = false }: { data: BarDatum[]; max?: number; showSublabel?: boolean }) {
  const cap = max ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = Math.max((d.value / cap) * 100, d.value > 0 ? 2 : 0)
        const color = d.color || '#1D4ED8'
        return (
          <div key={d.label} className="group">
            <div className="flex items-center justify-between mb-1 gap-3">
              <span className="text-xs font-semibold text-[#334155] truncate">{d.label}</span>
              <div className="flex items-center gap-2 shrink-0">
                {showSublabel && d.sublabel && (
                  <span className="text-[10px] text-[#94A3B8] tabular-nums">{d.sublabel}</span>
                )}
                <span className="text-xs font-bold text-[#0F172A] tabular-nums">{d.value.toLocaleString()}</span>
              </div>
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
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color || '#1D4ED8' }} />
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
      <p className="text-2xl font-extrabold text-[#0F172A] tabular-nums leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
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

function EmptyState({ message, icon: Icon = Sparkles }: { message: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
        <Icon size={18} className="text-[#94A3B8]" />
      </div>
      <p className="text-xs text-[#94A3B8]">{message}</p>
    </div>
  )
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

export default function AnalyticsConnected() {
  const [activeTab, setActiveTab] = useState<TabKey>('utm')
  const [dateRange, setDateRange] = useState<DateRangeKey>('Last 30 days')

  const [kpis, setKpis] = useState<any>(null)
  const [utm, setUtm] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const params = useMemo(() => computeDateRange(dateRange), [dateRange])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [kpiRes, utmRes, srcRes, funnelRes] = await Promise.all([
          analyticsAPI.getKPIs(params),
          analyticsAPI.getUtmPerformance(params),
          analyticsAPI.getSourcePerformance(params),
          analyticsAPI.getConversionFunnel(params),
        ])
        if (kpiRes.success) setKpis(kpiRes.data)
        if (utmRes.success) setUtm(utmRes.data || [])
        if (srcRes.success) setSources(srcRes.data || [])
        if (funnelRes.success) setFunnel(funnelRes.data || [])
      } catch (err) {
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params])

  // ── UTM derived data ──
  const utmRows = useMemo(() => {
    return utm.map((r) => {
      const totalLeads = r.totalLeads ?? 0
      const wonLeads = r.wonLeads ?? 0
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0
      return {
        id: JSON.stringify(r._id ?? {}),
        utmSource: r._id?.utmSource || 'Unknown',
        utmMedium: r._id?.utmMedium || 'Unknown',
        utmCampaign: r._id?.utmCampaign || 'Unknown',
        leads: totalLeads,
        won: wonLeads,
        conversionRate,
      }
    })
  }, [utm])

  const utmTotalLeads = utmRows.reduce((sum, r) => sum + r.leads, 0)
  const utmTotalWon = utmRows.reduce((sum, r) => sum + r.won, 0)
  const utmAvgConv = utmTotalLeads > 0 ? ((utmTotalWon / utmTotalLeads) * 100).toFixed(1) : '0'
  const topUtmCampaign = utmRows.slice().sort((a, b) => b.leads - a.leads)[0]

  // ── Source derived data ──
  const sourceBars: BarDatum[] = sources
    .slice()
    .sort((a, b) => (b.totalLeads || 0) - (a.totalLeads || 0))
    .map((s) => ({
      label: s.source || 'Unknown',
      value: s.totalLeads || 0,
      color: colorFor(SOURCE_COLORS, s.source, '#64748B'),
    }))

  const sourceConvBars: BarDatum[] = sources
    .slice()
    .filter((s) => (s.totalLeads || 0) > 0)
    .sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))
    .map((s) => ({
      label: s.source || 'Unknown',
      value: Number(((s.conversionRate || 0) * 1).toFixed(1)),
      color: colorFor(SOURCE_COLORS, s.source, '#64748B'),
      sublabel: `${s.wonLeads || 0}/${s.totalLeads || 0}`,
    }))

  const totalSourceLeads = sourceBars.reduce((sum, b) => sum + b.value, 0)
  const bestSource = sources
    .slice()
    .filter((s) => (s.totalLeads || 0) > 0)
    .sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0))[0]
  const worstSource = sources
    .slice()
    .filter((s) => (s.totalLeads || 0) > 0)
    .sort((a, b) => (a.conversionRate || 0) - (b.conversionRate || 0))[0]

  // ── Funnel derived data ──
  const funnelData = funnel
    .filter((f: any) => FUNNEL_ORDER.includes(f.stage))
    .sort((a: any, b: any) => FUNNEL_ORDER.indexOf(a.stage) - FUNNEL_ORDER.indexOf(b.stage))
  const funnelNew = funnelData[0]?.count || 0
  const funnelWon = funnelData[funnelData.length - 1]?.count || 0
  const funnelWinRate = funnelNew > 0 ? ((funnelWon / funnelNew) * 100).toFixed(1) : '0'
  const biggestDropStage = (() => {
    let maxDrop = 0
    let maxStage = ''
    for (let i = 1; i < funnelData.length; i++) {
      const prev = funnelData[i - 1].count
      const curr = funnelData[i].count
      if (prev > 0) {
        const drop = ((prev - curr) / prev) * 100
        if (drop > maxDrop) {
          maxDrop = drop
          maxStage = funnelData[i].stage
        }
      }
    }
    return maxStage ? `${maxStage} (−${maxDrop.toFixed(0)}%)` : '—'
  })()

  // ─────────────────── render ───────────────────

  const tabs: { id: TabKey; label: string; icon: any; accent: string }[] = [
    { id: 'utm', label: 'UTM Tracking', icon: Link2, accent: '#1D4ED8' },
    { id: 'sources', label: 'Source Performance', icon: PieChart, accent: '#7C3AED' },
    { id: 'funnel', label: 'Conversion Funnel', icon: ListFilter, accent: '#16A34A' },
    { id: 'visual', label: 'Lead Visualization', icon: BarChart3, accent: '#F59E0B' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-extrabold text-[#0F172A] tracking-tight">Analytics & Tracking</h1>
              <p className="text-xs text-[#64748B] mt-0.5">Live metrics straight from your backend</p>
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              className="h-9 px-3 pr-8 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#475569] appearance-none bg-no-repeat bg-[right_10px_center] bg-[length:10px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50 hover:border-[#CBD5E1] transition-colors"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
              }}
            >
              {(['Last 7 days', 'Last 30 days', 'Last 90 days', 'This Month', 'Last Month', 'Custom'] as DateRangeKey[]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* KPI stat cards — always visible */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              icon={Users}
              label="Total Leads"
              value={kpis?.totalLeads ?? 0}
              accent="#1D4ED8"
              sub={kpis ? `${Number(kpis.conversionRate ?? 0).toFixed(1)}% overall conversion` : undefined}
            />
            <StatCard
              icon={CheckCircle2}
              label="Qualified Leads"
              value={kpis?.qualifiedLeads ?? 0}
              accent="#7C3AED"
            />
            <StatCard icon={Trophy} label="Won Leads" value={kpis?.wonLeads ?? 0} accent="#16A34A" />
            <StatCard icon={Phone} label="Connected Calls" value={kpis?.connectedCalls ?? 0} accent="#F59E0B" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 pt-5 max-w-7xl mx-auto">
        <div className="flex gap-1 bg-white rounded-xl p-1 w-fit border border-[#E2E8F0] shadow-sm">
          {tabs.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  active ? 'text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
                style={
                  active
                    ? { background: `linear-gradient(135deg, ${t.accent}, ${t.accent}DD)` }
                    : undefined
                }
              >
                <t.icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-5">
        {/* ─── UTM TRACKING ─── */}
        {activeTab === 'utm' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={Link2}
                label="UTM-Tagged Leads"
                value={utmTotalLeads}
                accent="#1D4ED8"
                sub={`${utmRows.length} unique campaigns`}
              />
              <StatCard icon={Trophy} label="Won via UTM" value={utmTotalWon} accent="#16A34A" />
              <StatCard
                icon={Target}
                label="Avg Conversion"
                value={`${utmAvgConv}%`}
                accent="#F59E0B"
                sub={topUtmCampaign ? `Top: ${topUtmCampaign.utmCampaign}` : undefined}
              />
            </div>

            <SectionCard
              title="Campaign Performance"
              subtitle={`${utmRows.length} campaigns tracked in this period`}
              icon={Link2}
              accent="#1D4ED8"
            >
              {loading ? (
                <LoadingState />
              ) : utmRows.length === 0 ? (
                <EmptyState
                  message="No UTM data for this range. Tag your campaign URLs with ?utm_source=…&utm_campaign=… to see attribution here."
                  icon={Link2}
                />
              ) : (
                <div className="space-y-3">
                  {utmRows
                    .slice()
                    .sort((a, b) => b.leads - a.leads)
                    .map((r) => {
                      const convColor =
                        r.conversionRate >= 20
                          ? '#16A34A'
                          : r.conversionRate >= 10
                          ? '#F59E0B'
                          : '#64748B'
                      return (
                        <div
                          key={r.id}
                          className="p-4 rounded-xl border border-[#F1F5F9] hover:border-[#E2E8F0] hover:bg-[#FAFCFF] transition-all"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[#0F172A] truncate">{r.utmCampaign}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE]">
                                  {r.utmSource}
                                </span>
                                <span className="text-[10px] text-[#94A3B8]">·</span>
                                <span className="text-[10px] font-medium text-[#64748B]">{r.utmMedium}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-[#94A3B8] font-semibold">Leads</p>
                                <p className="text-sm font-extrabold text-[#0F172A] tabular-nums">{r.leads}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-[#94A3B8] font-semibold">Won</p>
                                <p className="text-sm font-extrabold text-[#16A34A] tabular-nums">{r.won}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-[#94A3B8] font-semibold">Conv</p>
                                <p className="text-sm font-extrabold tabular-nums" style={{ color: convColor }}>
                                  {r.conversionRate.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(r.conversionRate, 100)}%`,
                                background: `linear-gradient(90deg, ${convColor}, ${convColor}CC)`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {/* ─── SOURCE PERFORMANCE ─── */}
        {activeTab === 'sources' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={PieChart}
                label="Total Sources"
                value={sources.length}
                accent="#7C3AED"
                sub={`${totalSourceLeads} leads total`}
              />
              <StatCard
                icon={Trophy}
                label="Best Converting"
                value={bestSource?.source || '—'}
                accent="#16A34A"
                sub={bestSource ? `${Number(bestSource.conversionRate ?? 0).toFixed(1)}% conv rate` : undefined}
              />
              <StatCard
                icon={ArrowUpRight}
                label="Needs Attention"
                value={worstSource?.source || '—'}
                accent="#DC2626"
                sub={worstSource ? `${Number(worstSource.conversionRate ?? 0).toFixed(1)}% conv rate` : undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <SectionCard
                title="Lead Volume by Source"
                subtitle="Where your leads come from"
                icon={PieChart}
                accent="#7C3AED"
              >
                {loading ? (
                  <LoadingState />
                ) : sourceBars.length === 0 ? (
                  <EmptyState message="No source data for this range." icon={PieChart} />
                ) : (
                  <Donut data={sourceBars} total={totalSourceLeads} label="leads" />
                )}
              </SectionCard>

              <SectionCard
                title="Conversion Rate by Source"
                subtitle="Higher % = better quality traffic"
                icon={Target}
                accent="#16A34A"
              >
                {loading ? (
                  <LoadingState />
                ) : sourceConvBars.length === 0 ? (
                  <EmptyState message="No conversion data yet." icon={Target} />
                ) : (
                  <HorizontalBars data={sourceConvBars} max={Math.max(...sourceConvBars.map((b) => b.value), 100)} showSublabel />
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Source Breakdown"
              subtitle="Detailed stats per source"
              icon={BarChart3}
              accent="#1D4ED8"
            >
              {loading ? (
                <LoadingState />
              ) : sources.length === 0 ? (
                <EmptyState message="No source data for this range." icon={BarChart3} />
              ) : (
                <div className="space-y-2.5">
                  {sources
                    .slice()
                    .sort((a, b) => (b.totalLeads || 0) - (a.totalLeads || 0))
                    .map((s) => {
                      const color = colorFor(SOURCE_COLORS, s.source, '#64748B')
                      const conv = Number(s.conversionRate ?? 0)
                      return (
                        <div
                          key={s.source}
                          className="flex items-center gap-3 p-3 rounded-xl border border-[#F1F5F9] hover:border-[#E2E8F0] hover:bg-[#FAFCFF] transition-all"
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
                          >
                            <span className="text-xs font-extrabold text-white">
                              {String(s.source || '?').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#0F172A] truncate">{s.source}</p>
                            <p className="text-[10px] text-[#94A3B8]">
                              {s.qualifiedLeads || 0} qualified · {s.wonLeads || 0} won
                            </p>
                          </div>
                          <div className="flex items-center gap-5 shrink-0">
                            <div className="text-right">
                              <p className="text-[10px] text-[#94A3B8] font-semibold">Leads</p>
                              <p className="text-sm font-extrabold text-[#0F172A] tabular-nums">{s.totalLeads || 0}</p>
                            </div>
                            <div
                              className="text-right px-3 py-1 rounded-lg"
                              style={{ background: `${color}14` }}
                            >
                              <p className="text-[10px] font-semibold" style={{ color }}>
                                Conv
                              </p>
                              <p className="text-sm font-extrabold tabular-nums" style={{ color }}>
                                {conv.toFixed(1)}%
                              </p>
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
        {activeTab === 'funnel' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Users} label="Entered Funnel" value={funnelNew} accent="#3B82F6" />
              <StatCard
                icon={Trophy}
                label="Reached Final Stage"
                value={funnelWon}
                accent="#16A34A"
                sub={`${funnelWinRate}% win rate`}
              />
              <StatCard
                icon={TrendingUp}
                label="Biggest Drop"
                value={biggestDropStage.split(' (')[0] || '—'}
                accent="#DC2626"
                sub={biggestDropStage.match(/\(([^)]+)\)/)?.[1]}
              />
            </div>

            <SectionCard
              title="Stage-by-Stage Drop-off"
              subtitle="How many leads make it through each stage"
              icon={ListFilter}
              accent="#16A34A"
            >
              {loading ? (
                <LoadingState />
              ) : funnelData.length === 0 ? (
                <EmptyState message="No funnel data for this range." icon={ListFilter} />
              ) : (
                <Funnel stages={funnelData} />
              )}
            </SectionCard>
          </>
        )}

        {/* ─── LEAD VISUALIZATION ─── */}
        {activeTab === 'visual' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={BarChart3}
                label="Channels Tracked"
                value={sources.length}
                accent="#F59E0B"
              />
              <StatCard
                icon={Users}
                label="Total Lead Volume"
                value={totalSourceLeads}
                accent="#1D4ED8"
              />
              <StatCard
                icon={Target}
                label="Overall Win Rate"
                value={`${kpis ? Number(kpis.conversionRate ?? 0).toFixed(1) : '0'}%`}
                accent="#16A34A"
              />
            </div>

            <SectionCard
              title="Volume vs Conversion"
              subtitle="Compare how each channel performs on both axes"
              icon={BarChart3}
              accent="#F59E0B"
            >
              {loading ? (
                <LoadingState />
              ) : sources.length === 0 ? (
                <EmptyState message="No visualization data available." icon={BarChart3} />
              ) : (
                <div className="space-y-4">
                  {sources
                    .slice()
                    .sort((a, b) => (b.totalLeads || 0) - (a.totalLeads || 0))
                    .map((s) => {
                      const color = colorFor(SOURCE_COLORS, s.source, '#64748B')
                      const volMax = Math.max(...sources.map((x) => x.totalLeads || 0), 1)
                      const volPct = ((s.totalLeads || 0) / volMax) * 100
                      const conv = Number(s.conversionRate ?? 0)
                      const convPct = Math.min(conv, 100)
                      return (
                        <div key={s.source} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ background: color }}
                              />
                              <span className="text-sm font-bold text-[#0F172A]">{s.source}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px]">
                              <span className="font-semibold text-[#64748B]">
                                <span className="text-[#0F172A] font-bold tabular-nums">{s.totalLeads || 0}</span> leads
                              </span>
                              <span className="font-bold tabular-nums" style={{ color }}>
                                {conv.toFixed(1)}% conv
                              </span>
                            </div>
                          </div>

                          {/* Dual-bar row: volume on top (thicker, brand color), conversion on bottom (thinner, green) */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-[#94A3B8] w-8">VOL</span>
                              <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${volPct}%`,
                                    background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-[#94A3B8] w-8">CONV</span>
                              <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${convPct}%`,
                                    background: 'linear-gradient(90deg, #16A34A, #22C55E)',
                                  }}
                                />
                              </div>
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
  )
}

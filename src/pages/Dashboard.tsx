import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Phone, TrendingUp, ChevronRight, MapPin, CheckCircle2,
  ArrowUpRight, ArrowDownRight, RefreshCw, Zap, Award,
  AlertTriangle, Star, Activity, PhoneCall, UserCheck,
  Flame, Trophy, Medal, BarChart3, Target
} from 'lucide-react'
import { analyticsAPI, type ManagerDashboardResponse } from '../api/analytics'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const dispositionConfig: Record<string, { color: string; bg: string }> = {
  New: { color: '#1D4ED8', bg: '#DBEAFE' },
  'Contacted/Open': { color: '#2563EB', bg: '#DBEAFE' },
  Qualified: { color: '#0EA5E9', bg: '#E0F2FE' },
  'Visit Done': { color: '#3B82F6', bg: '#EFF6FF' },
  'Meeting Done': { color: '#38BDF8', bg: '#E0F2FE' },
  'Negotiation Done': { color: '#0284C7', bg: '#E0F2FE' },
  'Booking Done': { color: '#60A5FA', bg: '#EFF6FF' },
  'Agreement Done': { color: '#0369A1', bg: '#E0F2FE' },
  Failed: { color: '#64748B', bg: '#F1F5F9' },
}

const FUNNEL_COLORS = ['#1D4ED8','#2563EB','#0EA5E9','#38BDF8','#60A5FA','#93C5FD','#0284C7','#0369A1']
const SOURCE_COLORS = ['#1D4ED8','#2563EB','#0EA5E9','#38BDF8','#60A5FA','#93C5FD']

/* ─── SVG Area Chart — responsive + hover tooltip ─── */
const AreaChart = ({ data }: { data: Array<{ total: number; connected: number; label: string }> }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setW(w)
    })
    ro.observe(el)
    setW(el.clientWidth || 600)
    return () => ro.disconnect()
  }, [])

  const H = 120
  const PAD = { t: 10, r: 12, b: 28, l: 32 }
  const maxVal = Math.max(...data.map(d => d.total), 1)
  const xs = data.map((_, i) => PAD.l + (i / Math.max(data.length - 1, 1)) * (W - PAD.l - PAD.r))
  const yOf = (v: number) => PAD.t + (1 - v / maxVal) * (H - PAD.t - PAD.b)

  const smoothPath = (vals: number[]) => {
    if (vals.length < 2) return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${yOf(v)}`).join(' ')
    return vals.map((v, i) => {
      if (i === 0) return `M${xs[i]},${yOf(v)}`
      const cpx = (xs[i - 1] + xs[i]) / 2
      return `C${cpx},${yOf(vals[i - 1])} ${cpx},${yOf(v)} ${xs[i]},${yOf(v)}`
    }).join(' ')
  }

  const areaPath = (vals: number[]) =>
    `${smoothPath(vals)} L${xs[xs.length - 1]},${H - PAD.b} L${xs[0]},${H - PAD.b} Z`

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxVal))
  const activeD = tooltip !== null ? data[tooltip.i] : null

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg
        width={W} height={H}
        style={{ display: 'block', width: '100%', height: H, overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
        onMouseMove={e => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const mx = e.clientX - rect.left
          let closest = 0
          let minDist = Infinity
          xs.forEach((x, i) => { const d = Math.abs(mx - x); if (d < minDist) { minDist = d; closest = i } })
          setTooltip({ i: closest, x: xs[closest], y: yOf(data[closest].total) })
        }}
      >
        <defs>
          <linearGradient id="gT2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridVals.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(v)} y2={yOf(v)} stroke="#F1F5F9" strokeWidth="1" />
            <text x={PAD.l - 6} y={yOf(v) + 4} textAnchor="end" fontSize="8" fill="#CBD5E1" fontFamily="sans-serif">{v}</text>
          </g>
        ))}

        {/* Area fills */}
        <path d={areaPath(data.map(d => d.total))} fill="url(#gT2)" />
        <path d={areaPath(data.map(d => d.connected))} fill="url(#gC2)" />

        {/* Lines */}
        <path d={smoothPath(data.map(d => d.total))} fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothPath(data.map(d => d.connected))} fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Day labels + dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={yOf(d.total)} r={tooltip?.i === i ? 4 : 2.5} fill="#1D4ED8" stroke="white" strokeWidth={tooltip?.i === i ? 1.5 : 0} />
            {d.connected > 0 && (
              <circle cx={xs[i]} cy={yOf(d.connected)} r={tooltip?.i === i ? 4 : 2.5} fill="#38BDF8" stroke="white" strokeWidth={tooltip?.i === i ? 1.5 : 0} />
            )}
            <text x={xs[i]} y={H - PAD.b + 12} textAnchor="middle" fontSize="8" fill={tooltip?.i === i ? '#475569' : '#94A3B8'} fontFamily="sans-serif" fontWeight={tooltip?.i === i ? 'bold' : 'normal'}>
              {d.label}
            </text>
          </g>
        ))}

        {/* Hover vertical guide line */}
        {tooltip !== null && (
          <line x1={tooltip.x} x2={tooltip.x} y1={PAD.t} y2={H - PAD.b} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 2" />
        )}
      </svg>

      {/* Tooltip card */}
      {tooltip !== null && activeD !== null && (() => {
        const tipW = 120
        const leftPos = Math.min(tooltip.x, W - tipW - 8)
        return (
          <div
            className="absolute pointer-events-none z-20 bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2"
            style={{ top: 4, left: leftPos, width: tipW }}
          >
            <p className="text-[10px] font-bold text-slate-500 mb-1">{activeD.label}</p>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
              <span className="text-[10px] text-slate-600 font-medium">Total</span>
              <span className="text-[10px] font-bold text-slate-900 ml-auto">{activeD.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#38BDF8]" />
              <span className="text-[10px] text-slate-600 font-medium">Connected</span>
              <span className="text-[10px] font-bold text-sky-600 ml-auto">{activeD.connected}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ─── Donut Chart ─── */
const DonutChart = ({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const R = 36; const r = 22; const cx = 48; const cy = 48
  let angle = -Math.PI / 2
  const arcs = segments.map(s => {
    const sweep = (s.value / total) * 2 * Math.PI
    const x1 = cx + R * Math.cos(angle); const y1 = cy + R * Math.sin(angle)
    angle += sweep
    const x2 = cx + R * Math.cos(angle); const y2 = cy + R * Math.sin(angle)
    const ix1 = cx + r * Math.cos(angle - sweep); const iy1 = cy + r * Math.sin(angle - sweep)
    const ix2 = cx + r * Math.cos(angle); const iy2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return { ...s, d: `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large},0 ${ix1},${iy1} Z` }
  })
  return (
    <svg viewBox="0 0 96 96" className="w-24 h-24">
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity={0.85} />)}
      <circle cx={cx} cy={cy} r={r - 2} fill="white" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0F172A" fontFamily="sans-serif">
        {total}
      </text>
    </svg>
  )
}

/* ─── Mini progress bar ─── */
const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

/* ─── Source Donut Chart with hover tooltip + legend ─── */
type DonutSlice = {
  source: string; count: number; won: number;
  color: string; pct: number; midAngle: number; d: string;
}
const SourceDonut = ({
  slices, total, cx, cy, innerR,
}: {
  slices: DonutSlice[]; total: number; cx: number; cy: number; innerR: number;
}) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const SIZE = 160
  const active = hovered !== null ? slices[hovered] : null

  return (
    <div className="flex flex-col gap-4">
      {/* Donut */}
      <div className="flex justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
          {slices.map((s, i) => {
            const isHov = hovered === i
            /* nudge hovered slice outward */
            const nudge = isHov ? 5 : 0
            const tx = nudge * Math.cos(s.midAngle)
            const ty = nudge * Math.sin(s.midAngle)
            return (
              <path
                key={i}
                d={s.d}
                fill={s.color}
                opacity={hovered !== null && !isHov ? 0.45 : 0.9}
                transform={isHov ? `translate(${tx},${ty})` : undefined}
                style={{ cursor: 'pointer', transition: 'opacity 0.18s, transform 0.18s' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}
          {/* Inner white circle */}
          <circle cx={cx} cy={cy} r={innerR - 2} fill="white" />
          {/* Center label */}
          {active ? (
            <>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0F172A" fontFamily="sans-serif">
                {active.count}
              </text>
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="sans-serif">
                {active.pct}%
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7" fill={active.color} fontFamily="sans-serif" fontWeight="600">
                {active.source.length > 10 ? active.source.slice(0, 10) + '…' : active.source}
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#0F172A" fontFamily="sans-serif">
                {total}
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="sans-serif">
                Total
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${hovered === i ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] font-semibold text-slate-700 flex-1 truncate">{s.source}</span>
            <span className="text-[10px] font-bold text-slate-800 shrink-0">{s.count}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${s.color}18`, color: s.color }}
            >
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [data, setData] = useState<ManagerDashboardResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const fetchData = useCallback(async (background = false) => {
    try {
      background ? setRefreshing(true) : setLoading(true)
      const res = await analyticsAPI.getManagerDashboard()
      if (res.success) setData(res.data)
    } catch (err) {
      console.error('Failed to fetch manager dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [])
  useEffect(() => {
    const id = window.setInterval(() => void fetchData(true), 30000)
    return () => window.clearInterval(id)
  }, [fetchData])
  useEffect(() => {
    if (!socket || !connected) return
    const refresh = () => void fetchData(true)
    socket.on('lead:created', refresh); socket.on('lead:updated', refresh)
    socket.on('call:new', refresh); socket.on('call:status_updated', refresh)
    return () => {
      socket.off('lead:created', refresh); socket.off('lead:updated', refresh)
      socket.off('call:new', refresh); socket.off('call:status_updated', refresh)
    }
  }, [socket, connected, fetchData])

  const kpis = data?.kpis
  const funnel = data?.funnel || []
  const callTrend = data?.callTrend || []
  const sourceBreakdown = data?.sourceBreakdown || []
  const repLeaderboard = data?.repLeaderboard || []
  const recentLeads = data?.recentLeads || []
  const funnelMax = Math.max(...funnel.map(f => f.count), 1)

  const kpiCards = [
    { label: 'Total Leads', value: kpis?.totalLeads ?? 0, sub: `+${kpis?.newLeadsToday ?? 0} today`, delta: kpis?.monthGrowth ?? null, icon: Users, grad: 'from-[#1D4ED8] to-[#3B82F6]', path: '/leads' },
    { label: 'Qualified', value: kpis?.qualifiedLeads ?? 0, sub: `${kpis?.conversionRate ?? 0}% conv.`, delta: null, icon: CheckCircle2, grad: 'from-[#2563EB] to-[#60A5FA]', path: '/leads' },
    { label: 'Deals Won', value: kpis?.wonLeads ?? 0, sub: `${kpis?.failedLeads ?? 0} failed`, delta: null, icon: Trophy, grad: 'from-[#0EA5E9] to-[#38BDF8]', path: '/leads' },
    { label: 'Calls Today', value: kpis?.callsToday ?? 0, sub: `${kpis?.connectedToday ?? 0} conn · ${kpis?.todayConnectRate ?? 0}%`, delta: null, icon: PhoneCall, grad: 'from-[#1E40AF] to-[#3B82F6]', path: '/call-log' },
    { label: 'Total Calls', value: kpis?.totalCalls ?? 0, sub: `${kpis?.callConnectRate ?? 0}% connect rate`, delta: null, icon: Phone, grad: 'from-[#0EA5E9] to-[#60A5FA]', path: '/call-log' },
    { label: 'Ignored', value: kpis?.overdueRemindersTotal ?? 0, sub: 'Need attention', delta: null, icon: AlertTriangle, grad: 'from-[#2563EB] to-[#93C5FD]', path: '/reminders' },
    { label: 'Active Reps', value: kpis?.totalReps ?? 0, sub: 'On the team', delta: null, icon: UserCheck, grad: 'from-[#1D4ED8] to-[#60A5FA]', path: '/performance' },
    { label: 'New This Month', value: kpis?.newLeadsThisMonth ?? 0, sub: `${(kpis?.monthGrowth ?? 0) >= 0 ? '+' : ''}${kpis?.monthGrowth ?? 0}% vs last mo`, delta: kpis?.monthGrowth ?? null, icon: Flame, grad: 'from-[#0284C7] to-[#38BDF8]', path: '/leads' },
  ]

  const teamStats = [
    { label: 'Total Calls', value: repLeaderboard.reduce((a, r) => a + r.callsToday, 0), color: '#1D4ED8', icon: Phone },
    { label: 'Connected', value: repLeaderboard.reduce((a, r) => a + r.connectedCallsToday, 0), color: '#2563EB', icon: PhoneCall },
    { label: 'Leads Assigned', value: repLeaderboard.reduce((a, r) => a + r.leadsAssigned, 0), color: '#0EA5E9', icon: Users },
    { label: 'Leads Contacted', value: repLeaderboard.reduce((a, r) => a + r.leadsContacted, 0), color: '#38BDF8', icon: UserCheck },
    { label: 'Qualified/Wk', value: repLeaderboard.reduce((a, r) => a + r.qualifiedThisWeek, 0), color: '#0284C7', icon: CheckCircle2 },
    { label: 'Won Total', value: repLeaderboard.reduce((a, r) => a + r.wonLeads, 0), color: '#0369A1', icon: Trophy },
    { label: 'Ignored', value: repLeaderboard.reduce((a, r) => a + r.overdueReminders, 0), color: '#60A5FA', icon: AlertTriangle },
    { label: 'Avg Score', value: repLeaderboard.length > 0 ? Math.round(repLeaderboard.reduce((a, r) => a + r.score, 0) / repLeaderboard.length) : 0, color: '#93C5FD', icon: Star },
  ]

  const donutSegments = funnel.slice(0, 6).map((f, i) => ({ label: f.stage, value: f.count, color: FUNNEL_COLORS[i] }))

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{dateStr}</p>
          <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight">
            {greeting}, {user?.name?.split(' ')[0] || 'Manager'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {data?.manualAssignmentEnabled && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
              Manual Assignment
            </span>
          )}
          <button onClick={() => void fetchData(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-all">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#1D4ED8,#38BDF8)' }}>
            <Users size={11} /> Open Leads
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Row 1: KPI Cards (gradient style) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpiCards.map((card) => (
            <div key={card.label} onClick={() => navigate(card.path)}
              className="rounded-2xl p-4 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-200 group relative overflow-hidden"
              style={{ background: 'white', border: '1px solid #E2E8F0' }}>
              {/* Gradient accent strip */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-gradient-to-r ${card.grad}`} />
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br ${card.grad}`}>
                <card.icon size={14} className="text-white" />
              </div>
              <p className="text-2xl font-black text-slate-900 leading-none tabular-nums">
                {loading ? <span className="text-slate-300">—</span> : card.value.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold text-slate-500 mt-1 truncate">{card.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5 truncate">{card.sub}</p>
              {card.delta != null && (
                <div className={`inline-flex items-center gap-0.5 mt-1.5 text-[9px] font-bold rounded-full px-1.5 py-0.5 ${card.delta >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                  {card.delta >= 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                  {Math.abs(card.delta)}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Row 2: Team Health — 8 metric tiles ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#38BDF8]">
              <TrendingUp size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Team Health</h2>
              <p className="text-[10px] text-slate-400">Aggregated metrics for all reps today</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            {teamStats.map((item) => (
              <div key={item.label}
                className="rounded-xl p-3 flex flex-col gap-2 border border-slate-100"
                style={{ background: `${item.color}08` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${item.color}18` }}>
                  <item.icon size={13} style={{ color: item.color }} />
                </div>
                <p className="text-xl font-black text-slate-900 leading-none tabular-nums">{loading ? '—' : item.value}</p>
                <p className="text-[9px] font-semibold text-slate-500 leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 3: Area Chart + Funnel (3 equal cols) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* SVG Area Chart */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#38BDF8]">
                  <Activity size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">7-Day Call Activity</h2>
                  <p className="text-[10px] text-slate-400">Total vs connected calls</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
                  <span className="text-[10px] text-slate-500 font-medium">Total</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                  <span className="text-[10px] text-slate-500 font-medium">Connected</span>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="h-28 flex items-center justify-center text-slate-400 text-sm">Loading chart…</div>
            ) : callTrend.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-slate-400 text-sm">No call data yet</div>
            ) : (
              <>
                <AreaChart data={callTrend} />
                <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${callTrend.length},1fr)` }}>
                  {callTrend.map((d, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[9px] font-bold text-slate-700">{d.total}</p>
                      <p className="text-[8px] text-sky-600 font-semibold">{d.connected}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pipeline Funnel with Donut */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#2563EB] to-[#60A5FA]">
                <BarChart3 size={14} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Pipeline Funnel</h2>
                <p className="text-[10px] text-slate-400">Leads at each stage</p>
              </div>
            </div>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <div className="flex gap-4">
                <DonutChart segments={donutSegments} />
                <div className="flex-1 space-y-1.5 min-w-0">
                  {funnel.map((item, i) => (
                    <div key={item.stage} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: FUNNEL_COLORS[i] || '#94A3B8' }} />
                      <span className="text-[9px] font-medium text-slate-500 truncate flex-1">{item.stage}</span>
                      <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(8, (item.count / funnelMax) * 100)}%`, background: FUNNEL_COLORS[i] }} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-700 w-4 text-right shrink-0">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Rep Leaderboard + Source Breakdown + Recent Leads (3 cols) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Rep Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#60A5FA]">
                  <Award size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Rep Leaderboard</h2>
                  <p className="text-[10px] text-slate-400">Ranked by performance</p>
                </div>
              </div>
              <button onClick={() => navigate('/performance')}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline">
                Full view <ChevronRight size={11} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : !repLeaderboard.length ? (
                <div className="p-8 text-center text-slate-400 text-sm">No rep data yet.</div>
              ) : repLeaderboard.map((rep) => {
                const scoreColor = rep.score >= 70 ? '#1D4ED8' : rep.score >= 40 ? '#0EA5E9' : '#93C5FD'
                return (
                  <div key={rep.id} onClick={() => navigate(`/performance/${rep.id}`)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                      ${rep.rank === 1 ? 'bg-blue-100 text-blue-700' : rep.rank === 2 ? 'bg-sky-100 text-sky-700' : rep.rank === 3 ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-50 text-slate-400'}`}>
                      {rep.rank === 1 ? <Trophy size={10} /> : rep.rank === 2 ? <Medal size={10} /> : rep.rank === 3 ? <Award size={10} /> : rep.rank}
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 text-white"
                      style={{ background: 'linear-gradient(135deg,#1D4ED8,#38BDF8)' }}>
                      {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{rep.name}</p>
                      <p className="text-[9px] text-slate-400">{rep.callsToday} calls · {rep.qualifiedThisWeek} qual · {rep.wonLeads} won</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-extrabold" style={{ color: scoreColor }}>{rep.score}</span>
                      <div className="w-14">
                        <MiniBar value={rep.score} max={100} color={scoreColor} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lead Sources — Donut Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#2563EB] to-[#60A5FA]">
                <Target size={14} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Lead Sources</h2>
                <p className="text-[10px] text-slate-400">Distribution by volume</p>
              </div>
            </div>
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 rounded-full bg-slate-100 animate-pulse" />
                <div className="space-y-2 w-full">
                  {[1,2,3,4].map(i => <div key={i} className="h-5 bg-slate-100 rounded-lg animate-pulse" />)}
                </div>
              </div>
            ) : !sourceBreakdown.length ? (
              <p className="text-sm text-slate-400 text-center py-8">No source data yet.</p>
            ) : (() => {
              const totalAll = sourceBreakdown.reduce((a, x) => a + x.count, 0) || 1
              const cx = 80; const cy = 80; const R = 64; const innerR = 42
              let angle = -Math.PI / 2
              const slices = sourceBreakdown.map((s, i) => {
                const sweep = (s.count / totalAll) * 2 * Math.PI
                const x1 = cx + R * Math.cos(angle)
                const y1 = cy + R * Math.sin(angle)
                angle += sweep
                const x2 = cx + R * Math.cos(angle)
                const y2 = cy + R * Math.sin(angle)
                const ix1 = cx + innerR * Math.cos(angle - sweep)
                const iy1 = cy + innerR * Math.sin(angle - sweep)
                const ix2 = cx + innerR * Math.cos(angle)
                const iy2 = cy + innerR * Math.sin(angle)
                const large = sweep > Math.PI ? 1 : 0
                const midAngle = angle - sweep / 2
                return {
                  ...s,
                  color: SOURCE_COLORS[i % SOURCE_COLORS.length],
                  pct: Math.round((s.count / totalAll) * 100),
                  midAngle,
                  d: `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large},0 ${ix1},${iy1} Z`,
                }
              })
              return (
                <SourceDonut slices={slices} total={totalAll} cx={cx} cy={cy} innerR={innerR} />
              )
            })()}
          </div>

          {/* Recent Leads */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#38BDF8]">
                  <Zap size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Leads</h2>
                  <p className="text-[10px] text-slate-400">Latest activity</p>
                </div>
              </div>
              <button onClick={() => navigate('/leads')}
                className="flex items-center gap-0.5 text-[11px] font-semibold text-[#2563EB] hover:underline">
                All <ChevronRight size={11} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : !recentLeads.length ? (
                <div className="p-8 text-center text-slate-400 text-sm">No leads yet.</div>
              ) : recentLeads.map((lead: any, idx: number) => {
                const dc = dispositionConfig[lead.disposition] || { color: '#94A3B8', bg: '#F8FAFC' }
                return (
                  <div key={lead._id || idx} onClick={() => navigate(`/leads/${lead._id}`)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: dc.bg, color: dc.color }}>
                      {lead.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{lead.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={7} className="text-slate-300 shrink-0" />
                        <p className="text-[9px] text-slate-400 truncate">{lead.city} · {lead.source}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
                      style={{ background: dc.bg, color: dc.color }}>
                      {lead.disposition}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

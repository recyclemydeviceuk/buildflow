import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, CheckCircle2, AlertTriangle, TrendingUp, Users, Bell,
  ChevronRight, MapPin, Clock3, RefreshCw, Zap,
  Award, Trophy, PhoneCall, UserCheck, Activity, ArrowRight, Medal, Star
} from 'lucide-react'

import { analyticsAPI, type RepDashboardResponse } from '../api/analytics'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const dispositionConfig: Record<string, { color: string; bg: string }> = {
  New: { color: '#2563EB', bg: '#DBEAFE' },
  'Contacted/Open': { color: '#0EA5E9', bg: '#E0F2FE' },
  Qualified: { color: '#1D4ED8', bg: '#DBEAFE' },
  'Visit Done': { color: '#3B82F6', bg: '#EFF6FF' },
  'Meeting Done': { color: '#38BDF8', bg: '#E0F2FE' },
  'Negotiation Done': { color: '#0284C7', bg: '#E0F2FE' },
  'Booking Done': { color: '#60A5FA', bg: '#EFF6FF' },
  'Agreement Done': { color: '#0369A1', bg: '#E0F2FE' },
  Failed: { color: '#64748B', bg: '#F1F5F9' },
}

const BLUE_SCALE = ['#1D4ED8', '#2563EB', '#0EA5E9', '#38BDF8', '#60A5FA', '#93C5FD']

const formatDueLabel = (dueAt: string) => {
  const d = new Date(dueAt)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/* Modern score ring matching new design language */
const ScoreRing = ({ score }: { score: number }) => {
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ
  const color = score >= 70 ? '#1D4ED8' : score >= 40 ? '#0EA5E9' : '#93C5FD'
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#F1F5F9" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-black text-slate-900 leading-none">{score}</span>
        <span className="text-[7px] text-slate-400 font-semibold">/100</span>
      </div>
    </div>
  )
}

/* Thin progress bar */
const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

const PerformanceChart = ({ data }: { data: Array<{ label: string; value: number; detail: string }> }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const defaultActive = data.reduce((best, item, index, arr) => item.value >= arr[best].value ? index : best, 0)
  const [active, setActive] = useState(defaultActive)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setActive(defaultActive)
  }, [defaultActive, data])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth || 0)
    update()
    const observer = new ResizeObserver(() => update())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const W = Math.max(width, 320)
  const H = 188
  const PAD = { t: 20, r: 18, b: 34, l: 34 }
  const xs = data.map((_, i) => PAD.l + (i / Math.max(data.length - 1, 1)) * (W - PAD.l - PAD.r))
  const yOf = (v: number) => PAD.t + (1 - Math.min(v, 100) / 100) * (H - PAD.t - PAD.b)
  const smoothPath = (vals: number[]) => {
    if (vals.length < 2) return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${yOf(v)}`).join(' ')
    return vals.map((v, i) => {
      if (i === 0) return `M${xs[i]},${yOf(v)}`
      const cpx = (xs[i - 1] + xs[i]) / 2
      return `C${cpx},${yOf(vals[i - 1])} ${cpx},${yOf(v)} ${xs[i]},${yOf(v)}`
    }).join(' ')
  }
  const areaPath = (vals: number[]) => `${smoothPath(vals)} L${xs[xs.length - 1]},${H - PAD.b} L${xs[0]},${H - PAD.b} Z`
  const activePoint = data[active]
  const tooltipWidth = 170
  const tooltipLeft = Math.min(Math.max(xs[active] - tooltipWidth / 2, 8), W - tooltipWidth - 8)
  const tooltipTop = Math.max(8, yOf(activePoint.value) - 66)

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        width={W}
        height={H}
        className="block w-full"
        style={{ height: H }}
        onMouseMove={(event) => {
          const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
          const mx = event.clientX - rect.left
          let next = 0
          let minDist = Infinity
          xs.forEach((x, index) => {
            const dist = Math.abs(mx - x)
            if (dist < minDist) {
              minDist = dist
              next = index
            }
          })
          if (next !== active) setActive(next)
        }}
      >
        <defs>
          <linearGradient id="agentPerfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(v)} y2={yOf(v)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={PAD.l - 6} y={yOf(v) + 3} textAnchor="end" fontSize="8" fill="#94A3B8" fontFamily="sans-serif">{v}</text>
          </g>
        ))}
        <path d={areaPath(data.map(item => item.value))} fill="url(#agentPerfFill)" />
        <path d={smoothPath(data.map(item => item.value))} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {activePoint && (
          <>
            <line x1={xs[active]} x2={xs[active]} y1={PAD.t} y2={H - PAD.b} stroke="#93C5FD" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(activePoint.value)} y2={yOf(activePoint.value)} stroke="#DBEAFE" strokeWidth="1" strokeDasharray="4 4" />
          </>
        )}
        {data.map((item, i) => (
          <g key={item.label} onMouseEnter={() => setActive(i)} style={{ cursor: 'pointer' }}>
            <circle cx={xs[i]} cy={yOf(item.value)} r="16" fill="transparent" />
            {active === i && <circle cx={xs[i]} cy={yOf(item.value)} r="10" fill="#BFDBFE" opacity="0.7" />}
            <circle cx={xs[i]} cy={yOf(item.value)} r={active === i ? 5.5 : 4} fill="#2563EB" stroke="white" strokeWidth="2.5" />
            <text x={xs[i]} y={H - PAD.b + 16} textAnchor="middle" fontSize="8" fill={active === i ? '#1E3A8A' : '#94A3B8'} fontFamily="sans-serif" fontWeight={active === i ? '700' : '500'}>
              {item.label}
            </text>
          </g>
        ))}
      </svg>

      <div
        className="absolute pointer-events-none z-10 rounded-xl border border-blue-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm"
        style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipTop }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold text-slate-900">{activePoint.label}</p>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
            {activePoint.value}%
          </span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">{activePoint.detail}</p>
      </div>
    </div>
  )
}

const ActivityDonut = ({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) => {
  const [active, setActive] = useState(0)
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1
  const R = 42
  const r = 24
  const cx = 56
  const cy = 56
  let angle = -Math.PI / 2
  const arcs = segments.map((segment) => {
    const sweep = (segment.value / total) * 2 * Math.PI
    const x1 = cx + R * Math.cos(angle)
    const y1 = cy + R * Math.sin(angle)
    angle += sweep
    const x2 = cx + R * Math.cos(angle)
    const y2 = cy + R * Math.sin(angle)
    const ix1 = cx + r * Math.cos(angle - sweep)
    const iy1 = cy + r * Math.sin(angle - sweep)
    const ix2 = cx + r * Math.cos(angle)
    const iy2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const midAngle = angle - sweep / 2
    return {
      ...segment,
      midAngle,
      d: `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large},0 ${ix1},${iy1} Z`,
    }
  })
  const current = arcs[active] || arcs[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <svg viewBox="0 0 112 112" className="w-40 h-40">
          {arcs.map((segment, index) => {
            const isActive = index === active
            const shift = isActive ? 4 : 0
            const tx = shift * Math.cos(segment.midAngle)
            const ty = shift * Math.sin(segment.midAngle)
            return (
              <path
                key={segment.label}
                d={segment.d}
                fill={segment.color}
                opacity={isActive ? 1 : 0.72}
                transform={isActive ? `translate(${tx},${ty})` : undefined}
                style={{ cursor: 'pointer', transition: 'all 0.18s ease' }}
                onMouseEnter={() => setActive(index)}
              />
            )
          })}
          <circle cx={cx} cy={cy} r={r - 2} fill="white" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0F172A" fontFamily="sans-serif">
            {current?.value ?? total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#64748B" fontFamily="sans-serif">
            {current ? current.label : 'Total'}
          </text>
        </svg>
      </div>
      <div className="space-y-1.5">
        {segments.map((segment, index) => {
          const pct = Math.round((segment.value / total) * 100)
          return (
            <div
              key={segment.label}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${active === index ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              onMouseEnter={() => setActive(index)}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: segment.color }} />
              <span className="text-[10px] font-semibold text-slate-700 flex-1 truncate">{segment.label}</span>
              <span className="text-[10px] font-bold text-slate-800">{segment.value}</span>
              <span className="text-[9px] font-bold text-blue-600">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AgentDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [dashboard, setDashboard] = useState<RepDashboardResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboardData = async (bg = false) => {
    try {
      bg ? setRefreshing(true) : setLoading(true)
      const res = await analyticsAPI.getRepDashboard()
      if (res.success) setDashboard(res.data)
    } catch (err) {
      console.error('Failed to fetch representative dashboard:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { if (user) void fetchDashboardData() }, [user?.id])
  useEffect(() => {
    const id = window.setInterval(() => void fetchDashboardData(true), 30000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (!socket || !connected || !user) return
    const refresh = () => void fetchDashboardData(true)
    socket.on('lead:assigned_to_you', refresh); socket.on('lead:assigned', refresh)
    socket.on('call:new', refresh); socket.on('call:status_updated', refresh)
    socket.on('reminder:due', refresh)
    return () => {
      socket.off('lead:assigned_to_you', refresh); socket.off('lead:assigned', refresh)
      socket.off('call:new', refresh); socket.off('call:status_updated', refresh)
      socket.off('reminder:due', refresh)
    }
  }, [socket, connected, user?.id])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const summary = dashboard?.summary
  const callsTarget = dashboard?.callsTarget || 20
  const callsToday = summary?.callsToday || 0
  const connectedCallsToday = summary?.connectedCallsToday || 0
  const leadsAssigned = summary?.leadsAssigned || 0
  const leadsContacted = summary?.leadsContacted || 0
  const qualifiedThisWeek = summary?.qualifiedThisWeek || 0
  const overdueReminders = summary?.overdueReminders || 0
  const dueSoonReminders = summary?.dueSoonReminders || 0
  const activeReminders = summary?.activeReminders || 0
  const score = summary?.score || 0
  const rank = summary?.rank || 0

  const callPct = Math.min(100, Math.round((callsToday / Math.max(callsTarget, 1)) * 100))
  const leadPct = leadsAssigned > 0 ? Math.min(100, Math.round((leadsContacted / leadsAssigned) * 100)) : 0
  const connectRate = callsToday > 0 ? Math.round((connectedCallsToday / callsToday) * 100) : 0

  const missions = [
    { id: 'calls', label: `Make ${callsTarget} calls today`, current: callsToday, target: callsTarget, icon: Phone, color: '#2563EB', done: callsToday >= callsTarget, xp: 30 },
    { id: 'contact', label: 'Contact 80% of your leads', current: leadPct, target: 100, icon: UserCheck, color: '#0EA5E9', done: leadPct >= 80, xp: 25 },
    { id: 'qualify', label: 'Qualify 2 leads this week', current: Math.min(qualifiedThisWeek, 2), target: 2, icon: CheckCircle2, color: '#1D4ED8', done: qualifiedThisWeek >= 2, xp: 20 },
    { id: 'reminders', label: 'Clear all overdue reminders', current: overdueReminders === 0 ? 1 : 0, target: 1, icon: Bell, color: overdueReminders > 0 ? '#60A5FA' : '#0EA5E9', done: overdueReminders === 0, xp: 15 },
  ]
  const missionsCompleted = missions.filter(m => m.done).length
  const totalXP = missions.filter(m => m.done).reduce((a, m) => a + m.xp, 0)

  const statCards = [
    { label: 'My Leads', value: leadsAssigned, sub: 'Assigned to you', icon: Users, grad: 'from-[#1D4ED8] to-[#3B82F6]', path: '/leads' },
    { label: 'Calls Today', value: callsToday, sub: `Target: ${callsTarget}`, icon: Phone, grad: 'from-[#2563EB] to-[#60A5FA]', path: '/call-log' },
    { label: 'Connected', value: connectedCallsToday, sub: `${connectRate}% connect rate`, icon: PhoneCall, grad: 'from-[#0EA5E9] to-[#38BDF8]', path: '/call-log' },
    { label: 'Qualified', value: qualifiedThisWeek, sub: 'This week', icon: CheckCircle2, grad: 'from-[#0284C7] to-[#0EA5E9]', path: '/leads' },
    { label: 'Overdue', value: overdueReminders, sub: dueSoonReminders > 0 ? `+${dueSoonReminders} due soon` : 'All clear!', icon: AlertTriangle, grad: 'from-[#1E40AF] to-[#60A5FA]', path: '/reminders' },
  ]

  const performanceSeries = [
    { label: 'Calls', value: callPct, detail: `${callsToday}/${callsTarget} target reached` },
    { label: 'Contact', value: leadPct, detail: `${leadsContacted}/${leadsAssigned || 0} leads contacted` },
    { label: 'Connect', value: connectRate, detail: `${connectedCallsToday}/${callsToday || 0} calls connected` },
    { label: 'Score', value: score, detail: rank > 0 ? `Current rank #${rank}` : 'Build momentum to climb the leaderboard' },
  ]

  const personalHealth = [
    { label: 'Active Reminders', value: activeReminders, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'Due Soon', value: dueSoonReminders, tone: 'bg-sky-50 text-sky-700 border-sky-100' },
    { label: 'Connected Calls', value: connectedCallsToday, tone: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    { label: 'Rank', value: rank > 0 ? `#${rank}` : '—', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
  ]

  const dispositionSegments = useMemo(() => {
    if (!dashboard?.leads?.length) return [] as Array<{ label: string; value: number; color: string }>
    const counts = dashboard.leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.disposition] = (acc[lead.disposition] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], index) => ({ label, value, color: BLUE_SCALE[index % BLUE_SCALE.length] }))
  }, [dashboard?.leads])

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">{dateStr}</p>
            <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight">
              {greeting}, {user?.name?.split(' ')[0] || 'Representative'}
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {overdueReminders > 0
                ? `${overdueReminders} overdue reminder${overdueReminders > 1 ? 's' : ''} · ${callsToday}/${callsTarget} calls`
                : `${callsToday}/${callsTarget} calls done · Keep it up!`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchDashboardData(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-all">
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            {rank > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
                <Star size={11} className="text-blue-500" />
                <span className="text-[11px] font-bold text-blue-600">Rank #{rank}</span>
              </div>
            )}
            <ScoreRing score={score} />
          </div>
        </div>

        {/* Progress bars row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: 'Calls Today', val: `${callsToday}/${callsTarget}`, pct: callPct, color: '#2563EB' },
            { label: 'Leads Contacted', val: `${leadsContacted}/${leadsAssigned}`, pct: leadPct, color: '#0EA5E9' },
            { label: 'Connect Rate', val: `${connectRate}%`, pct: connectRate, color: '#1D4ED8' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-2.5 bg-slate-50 border border-slate-100">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-slate-500">{item.label}</span>
                <span className="text-[10px] font-bold text-slate-800">{item.val}</span>
              </div>
              <ProgressBar value={item.pct} max={100} color={item.color} />
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Row 1: KPI Cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          {statCards.map(card => (
            <div key={card.label} onClick={() => navigate(card.path)}
              className="bg-white rounded-2xl border border-slate-200 p-4 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-200 group relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-gradient-to-r ${card.grad}`} />
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br ${card.grad}`}>
                <card.icon size={14} className="text-white" />
              </div>
              <p className="text-2xl font-black text-slate-900 leading-none tabular-nums">
                {loading ? <span className="text-slate-300">—</span> : card.value}
              </p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">{card.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#38BDF8]">
                  <Activity size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Performance Snapshot</h2>
                  <p className="text-[10px] text-slate-400">Your goal completion across core metrics</p>
                </div>
              </div>
              <button onClick={() => navigate('/performance')}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline">
                View all <ChevronRight size={11} />
              </button>
            </div>
            <PerformanceChart data={performanceSeries} />
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
              {personalHealth.map(item => (
                <div key={item.label} className={`rounded-xl border p-3 ${item.tone}`}>
                  <p className="text-[9px] font-semibold opacity-80">{item.label}</p>
                  <p className="text-lg font-black mt-1 text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#2563EB] to-[#60A5FA]">
                <Users size={14} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Lead Mix</h2>
                <p className="text-[10px] text-slate-400">Disposition breakdown of your assigned leads</p>
              </div>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading chart…</div>
            ) : !dispositionSegments.length ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <Users size={18} className="text-blue-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">No assigned leads yet.</p>
                <p className="text-[10px] text-slate-400 mt-1">Once leads are assigned, the mix chart will appear here.</p>
              </div>
            ) : (
              <ActivityDonut segments={dispositionSegments} />
            )}
          </div>
        </div>

        {/* ── Row 2: Daily Missions + My Leads (3 col symmetry: missions takes 1, leads takes 2) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Daily Missions */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,#1D4ED8,#38BDF8)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-white" />
                  <p className="text-sm font-bold text-white">Daily Missions</p>
                </div>
                <span className="text-[10px] font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
                  {missionsCompleted}/{missions.length} done
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/25 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-700"
                    style={{ width: `${(missionsCompleted / missions.length) * 100}%` }} />
                </div>
                <span className="text-[10px] text-white font-bold shrink-0">+{totalXP}XP</span>
              </div>
            </div>
            <div className="p-4 space-y-2.5">
              {missions.map(mission => {
                const pct = Math.min(100, Math.round((mission.current / mission.target) * 100))
                return (
                  <div key={mission.id}
                    className={`p-3 rounded-xl border transition-all ${mission.done ? 'border-blue-100 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: mission.done ? '#DBEAFE' : `${mission.color}18` }}>
                        {mission.done
                          ? <CheckCircle2 size={12} className="text-blue-600" />
                          : <mission.icon size={12} style={{ color: mission.color }} />}
                      </div>
                      <p className={`text-[11px] font-semibold flex-1 leading-tight ${mission.done ? 'text-blue-600 line-through' : 'text-slate-800'}`}>
                        {mission.label}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${mission.done ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                        +{mission.xp}XP
                      </span>
                    </div>
                    {!mission.done && (
                      <>
                        <ProgressBar value={mission.current} max={mission.target} color={mission.color} />
                        <p className="text-[8px] text-slate-400 mt-1">
                          {mission.id === 'contact' ? `${mission.current}%` : `${mission.current}/${mission.target}`}
                        </p>
                      </>
                    )}
                  </div>
                )
              })}
              <button onClick={() => navigate('/dialer')}
                className="w-full py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity mt-1"
                style={{ background: 'linear-gradient(135deg,#1D4ED8,#38BDF8)' }}>
                <Phone size={12} /> Open Dialer
              </button>
            </div>
          </div>

          {/* My Leads — spans 2 cols */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#38BDF8]">
                  <Users size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">My Leads</h2>
                  <p className="text-[10px] text-slate-400">Your active pipeline</p>
                </div>
              </div>
              <button onClick={() => navigate('/leads')}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline">
                View all <ChevronRight size={11} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-10 text-center text-slate-400 text-sm">Loading leads…</div>
              ) : !dashboard?.leads?.length ? (
                <div className="p-10 text-center">
                  <p className="text-slate-400 text-sm">No leads assigned to you yet.</p>
                  <p className="text-[10px] text-slate-300 mt-1">
                    {dashboard?.manualAssignmentEnabled ? 'Wait for manager to assign.' : 'Leads route automatically.'}
                  </p>
                </div>
              ) : dashboard.leads.map(lead => {
                const cfg = dispositionConfig[lead.disposition] || { color: '#94A3B8', bg: '#F8FAFC' }
                return (
                  <div key={lead._id} onClick={() => navigate(`/leads/${lead._id}`)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {lead.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate">{lead.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={7} className="text-slate-300 shrink-0" />
                        <p className="text-[9px] text-slate-400 truncate">{lead.city} · {lead.source} · {lead.budget || 'No budget'}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {lead.disposition}
                    </span>
                    <ChevronRight size={10} className="text-slate-300 group-hover:text-[#2563EB] transition-colors" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Row 3: Reminders + Leaderboard + Quick Actions (3 equal cols) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* My Reminders */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#2563EB] to-[#60A5FA]">
                  <Bell size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">My Reminders</h2>
                  {(overdueReminders > 0 || dueSoonReminders > 0) && (
                    <p className="text-[10px] text-blue-600 font-semibold">{overdueReminders + dueSoonReminders} need attention</p>
                  )}
                </div>
              </div>
              <button onClick={() => navigate('/reminders')}
                className="text-[11px] font-semibold text-[#2563EB] hover:underline">View all</button>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : !dashboard?.reminders?.length ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={18} className="text-blue-500" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">All clear!</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">No active reminders.</p>
                </div>
              ) : dashboard.reminders.map(reminder => {
                const isOverdue = reminder.status === 'overdue'
                const isDueSoon = reminder.status === 'due_soon'
                const badgeCls = isOverdue ? 'bg-blue-100 text-blue-700' : isDueSoon ? 'bg-sky-50 text-sky-600' : 'bg-cyan-50 text-cyan-600'
                return (
                  <button key={reminder._id} type="button" onClick={() => navigate('/reminders')}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{reminder.title}</p>
                        <p className="text-[9px] text-slate-400 truncate mt-0.5">{reminder.leadName}</p>
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-500">
                          <Clock3 size={9} />
                          <span>{formatDueLabel(reminder.dueAt)}</span>
                        </div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold capitalize shrink-0 ${badgeCls}`}>
                        {reminder.status.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Team Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#60A5FA]">
                  <Trophy size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Team Leaderboard</h2>
                  <p className="text-[10px] text-slate-400">Performance scores</p>
                </div>
              </div>
              <button onClick={() => navigate('/performance')}
                className="text-[11px] font-semibold text-[#2563EB] hover:underline">Full view</button>
            </div>
            <div className="divide-y divide-slate-50">
              {!dashboard?.leaderboard?.length ? (
                <div className="p-8 text-center text-slate-400 text-sm">Leaderboard appears once calls start.</div>
              ) : dashboard.leaderboard.map(agent => {
                const isMe = agent.id === user?.id
                const scoreColor = agent.score >= 70 ? '#1D4ED8' : agent.score >= 40 ? '#0EA5E9' : '#93C5FD'
                return (
                  <div key={agent.id}
                    className={`flex items-center gap-3 px-5 py-3 transition-all ${isMe ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                      ${agent.rank === 1 ? 'bg-blue-100 text-blue-700' : agent.rank === 2 ? 'bg-sky-100 text-sky-700' : agent.rank === 3 ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-50 text-slate-400'}`}>
                      {agent.rank === 1 ? <Trophy size={10} /> : agent.rank === 2 ? <Medal size={10} /> : agent.rank === 3 ? <Award size={10} /> : agent.rank}
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 text-white"
                      style={{ background: isMe ? 'linear-gradient(135deg,#1D4ED8,#38BDF8)' : 'linear-gradient(135deg,#94A3B8,#CBD5E1)' }}>
                      {agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isMe ? 'text-blue-600' : 'text-slate-800'}`}>
                        {isMe ? 'You' : agent.name}
                      </p>
                      <p className="text-[9px] text-slate-400">{agent.callsToday} calls · {agent.qualifiedThisWeek} qual</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-extrabold" style={{ color: scoreColor }}>{agent.score}</span>
                      <div className="w-12">
                        <ProgressBar value={agent.score} max={100} color={scoreColor} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Actions + Routing Info */}
          <div className="space-y-4">
            {/* Routing pill */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: dashboard?.manualAssignmentEnabled ? 'linear-gradient(135deg,#1D4ED8,#38BDF8)' : 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                  {dashboard?.manualAssignmentEnabled ? <Users size={14} className="text-white" /> : <Zap size={14} className="text-white" />}
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {dashboard?.manualAssignmentEnabled ? 'Manual Assignment' : 'Auto Routing'}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {dashboard?.manualAssignmentEnabled
                  ? 'Managers assign leads manually. You only see leads once assigned.'
                  : 'New leads route automatically in real-time. Pipeline updates instantly.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-800 mb-3">Quick Actions</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Open Dialer', icon: Phone, path: '/dialer', grad: 'from-[#1D4ED8] to-[#38BDF8]' },
                  { label: 'View My Leads', icon: Users, path: '/leads', grad: 'from-[#2563EB] to-[#60A5FA]' },
                  { label: 'Reminders', icon: Bell, path: '/reminders', grad: 'from-[#0EA5E9] to-[#38BDF8]' },
                  { label: 'Call Log', icon: Activity, path: '/call-log', grad: 'from-[#0284C7] to-[#38BDF8]' },
                  { label: 'My Performance', icon: TrendingUp, path: '/performance', grad: 'from-[#1E40AF] to-[#60A5FA]' },
                ].map(action => (
                  <button key={action.path} onClick={() => navigate(action.path)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all group">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${action.grad}`}>
                      <action.icon size={11} className="text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 group-hover:text-[#2563EB] transition-colors">{action.label}</span>
                    <ArrowRight size={10} className="text-slate-300 group-hover:text-[#2563EB] ml-auto transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

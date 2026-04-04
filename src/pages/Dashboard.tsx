import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Clock, AlertTriangle, Phone, TrendingUp, ChevronRight,
  Bell, MapPin, CheckCircle2, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { leadsAPI, type Lead } from '../api/leads'
import { analyticsAPI } from '../api/analytics'

const activityColors: Record<string, string> = {
  blue: '#1D4ED8', green: '#16A34A', amber: '#F59E0B',
  purple: '#7C3AED', red: '#DC2626', slate: '#475569',
}

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

export default function Dashboard() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [kpis, setKPIs] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [leadsRes, kpiRes] = await Promise.all([
        leadsAPI.getLeads({ limit: '5' }),
        analyticsAPI.getKPIs().catch(() => null)
      ])

      if (leadsRes.success) setLeads(leadsRes.data)
      if (kpiRes?.success) setKPIs(kpiRes.data)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const kpiCards = [
    { label: 'Total Leads', value: kpis?.totalLeads || 0, delta: `Won ${kpis?.wonLeads || 0} · ${kpis?.conversionRate ? `${kpis.conversionRate}%` : '0.0%'} conv.`, icon: Users, color: '#1D4ED8', accent: '#1D4ED8', pastel: '#EFF6FF', trend: 'up' },
    { label: 'Qualified Leads', value: kpis?.qualifiedLeads || 0, delta: `Won ${kpis?.wonLeads || 0}`, icon: Clock, color: '#16A34A', accent: '#16A34A', pastel: '#F0FDF4', trend: 'up' },
    { label: 'Won Leads', value: kpis?.wonLeads || 0, delta: `Conversion ${kpis?.conversionRate ? `${kpis.conversionRate}%` : '0.0%'}`, icon: AlertTriangle, color: '#7C3AED', accent: '#7C3AED', pastel: '#F5F3FF', trend: 'up' },
    { label: 'Connected Calls', value: kpis?.connectedCalls || 0, delta: `Call connect ${kpis?.callConnectRate ? `${kpis.callConnectRate}%` : '0.0%'}`, icon: Phone, color: '#16A34A', accent: '#16A34A', pastel: '#F0FDF4', trend: 'up' },
  ]

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-0.5">{dateStr}</p>
            <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">{greeting}, Manager</h1>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1D4ED8] text-white hover:bg-blue-700 transition-all"
          >
            <Users size={12} />
            Open Leads
          </button>
        </div>
      </div>

      <div className="flex">
        {/* ── Main workspace ── */}
        <div className="flex-1 p-4 space-y-3 min-w-0">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {kpiCards.map((card, i) => (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden cursor-pointer group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 relative"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => {
                  if (card.label.includes('Follow-up')) navigate('/reminders')
                  else if (card.label.includes('Leads')) navigate('/leads')
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: card.accent }} />
                <div className="p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: card.pastel }}>
                      <card.icon size={13} style={{ color: card.color }} />
                    </div>
                  </div>
                  <p className="text-xl font-extrabold text-[#0F172A] tracking-tight group-hover:text-[#1D4ED8] transition-colors">{card.value}</p>
                  <p className="text-xs font-semibold text-[#475569] mt-0.5">{card.label}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{card.delta}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Lead Queue */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Recent Leads</h2>
              </div>
              <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline">
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div>
              {loading ? (
                <div className="p-10 text-center text-[#94A3B8] text-sm italic">Loading leads...</div>
              ) : leads.length === 0 ? (
                <div className="p-10 text-center text-[#94A3B8] text-sm">No recent leads.</div>
              ) : leads.map((lead, idx) => {
                const dc = dispositionConfig[lead.disposition] || { color: '#94A3B8', bg: '#F8FAFC' }
                return (
                  <div
                    key={lead._id}
                    className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all duration-150 hover:bg-[#F8FAFC] group ${idx < leads.length - 1 ? 'border-b border-[#F8FAFC]' : ''}`}
                    onClick={() => navigate(`/leads/${lead._id}`)}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: dc.bg, color: dc.color }}>
                      {lead.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{lead.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={8} className="text-[#CBD5E1] shrink-0" />
                        <p className="text-[10px] text-[#94A3B8] truncate">{lead.city} · {lead.source}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: dc.bg, color: dc.color }}>
                        {lead.disposition}
                      </span>
                      <p className="text-[9px] text-[#CBD5E1] mt-0.5">{new Date(lead.createdAt).toLocaleDateString()}</p>
                    </div>
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

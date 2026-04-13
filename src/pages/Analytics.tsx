import { useState } from 'react'
import {
  BarChart3, TrendingUp, Users, DollarSign, Link2, MousePointerClick,
  Filter, PieChart, Calendar, ArrowUpRight, ArrowDownRight,
  ChevronRight, Globe, Smartphone, Share2, ListFilter
} from 'lucide-react'

interface UTMRecord {
  id: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  leads: number
  qualified: number
  won: number
  cost: number
  cpl: number
  conversionRate: number
}

interface SourceRecord {
  source: string
  leads: number
  cost: number
  cpl: number
  qualified: number
  won: number
  conversionRate: number
  color: string
}

const utmData: UTMRecord[] = [
  { id: '1', utmSource: 'facebook', utmMedium: 'cpc', utmCampaign: 'premium_villas_march', leads: 156, qualified: 42, won: 8, cost: 250000, cpl: 1602, conversionRate: 5.1 },
  { id: '2', utmSource: 'facebook', utmMedium: 'lead_gen', utmCampaign: 'dream_homes_2026', leads: 203, qualified: 67, won: 12, cost: 180000, cpl: 886, conversionRate: 5.9 },
  { id: '3', utmSource: 'google', utmMedium: 'search', utmCampaign: 'luxury_apartments_delhi', leads: 89, qualified: 31, won: 6, cost: 120000, cpl: 1348, conversionRate: 6.7 },
  { id: '4', utmSource: 'google', utmMedium: 'display', utmCampaign: 'brand_awareness', leads: 67, qualified: 18, won: 2, cost: 80000, cpl: 1194, conversionRate: 3.0 },
  { id: '5', utmSource: 'instagram', utmMedium: 'cpc', utmCampaign: 'reels_promo', leads: 134, qualified: 38, won: 5, cost: 150000, cpl: 1119, conversionRate: 3.7 },
  { id: '6', utmSource: 'linkedin', utmMedium: 'sponsored', utmCampaign: 'b2b_commercial', leads: 34, qualified: 15, won: 4, cost: 90000, cpl: 2647, conversionRate: 11.8 },
  { id: '7', utmSource: 'website', utmMedium: 'organic', utmCampaign: 'direct', leads: 89, qualified: 28, won: 7, cost: 0, cpl: 0, conversionRate: 7.9 },
  { id: '8', utmSource: 'whatsapp', utmMedium: 'broadcast', utmCampaign: 'referral_program', leads: 45, qualified: 19, won: 6, cost: 15000, cpl: 333, conversionRate: 13.3 },
]

const sourceData: SourceRecord[] = [
  { source: 'Meta', leads: 493, cost: 580000, cpl: 1176, qualified: 147, won: 25, conversionRate: 5.1, color: '#1877F2' },
  { source: 'Google', leads: 156, cost: 200000, cpl: 1282, qualified: 49, won: 8, conversionRate: 5.1, color: '#EA4335' },
  { source: 'Website', leads: 89, cost: 0, cpl: 0, qualified: 28, won: 7, conversionRate: 7.9, color: '#16A34A' },
  { source: 'Referral', leads: 45, cost: 15000, cpl: 333, qualified: 19, won: 6, conversionRate: 13.3, color: '#7C3AED' },
  { source: 'LinkedIn', leads: 34, cost: 90000, cpl: 2647, qualified: 15, won: 4, conversionRate: 11.8, color: '#0A66C2' },
  { source: 'Manual', leads: 67, cost: 0, cpl: 0, qualified: 22, won: 5, conversionRate: 7.5, color: '#94A3B8' },
]

const funnelData = [
  { stage: 'New Leads', count: 884, dropOff: 0 },
  { stage: 'Contacted', count: 562, dropOff: 36 },
  { stage: 'Qualified', count: 280, dropOff: 50 },
  { stage: 'Proposal', count: 142, dropOff: 49 },
  { stage: 'Negotiation', count: 89, dropOff: 37 },
  { stage: 'Won', count: 55, dropOff: 38 },
]

const dateRanges = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This Month', 'Last Month', 'Custom']

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('utm')
  const [dateRange, setDateRange] = useState('Last 30 days')
  const [filterSource, setFilterSource] = useState('All')

  const totalLeads = utmData.reduce((acc, r) => acc + r.leads, 0)
  const totalCost = utmData.reduce((acc, r) => acc + r.cost, 0)
  const avgCpl = Math.round(totalCost / totalLeads)
  const totalWon = utmData.reduce((acc, r) => acc + r.won, 0)

  const tabs = [
    { id: 'utm', label: 'UTM Tracking', icon: Link2 },
    { id: 'sources', label: 'Source Performance', icon: PieChart },
    { id: 'funnel', label: 'Conversion Funnel', icon: ListFilter },
    { id: 'visualization', label: 'Lead Visualization', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Analytics & Tracking</h1>
            <p className="text-xs text-[#64748B]">Track UTM parameters, source performance, and conversion metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-[#94A3B8]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] cursor-pointer"
            >
              {dateRanges.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: 'Total Leads', value: totalLeads, icon: Users, color: '#1D4ED8', bg: '#EFF6FF', change: '+12.5%' },
            { label: 'Total Ad Spend', value: `₹${(totalCost / 1000).toFixed(0)}K`, icon: DollarSign, color: '#16A34A', bg: '#F0FDF4', change: '+8.2%' },
            { label: 'Avg. Cost/Lead', value: `₹${avgCpl}`, icon: TrendingUp, color: '#D97706', bg: '#FFFBEB', change: '-5.3%' },
            { label: 'Deals Won', value: totalWon, icon: Globe, color: '#7C3AED', bg: '#F5F3FF', change: '+15.1%' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-lg border border-[#E2E8F0] px-2.5 py-2 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: kpi.bg }}>
                <kpi.icon size={13} style={{ color: kpi.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[#64748B] font-medium">{kpi.label}</p>
                <p className="text-sm font-bold text-[#0F172A] leading-tight">{kpi.value}</p>
                <div className="flex items-center gap-1 text-[9px]">
                  {kpi.change.startsWith('+') ? (
                    <ArrowUpRight size={9} className="text-[#16A34A]" />
                  ) : (
                    <ArrowDownRight size={9} className="text-[#DC2626]" />
                  )}
                  <span className={kpi.change.startsWith('+') ? 'text-[#16A34A]' : 'text-[#DC2626]'}>{kpi.change}</span>
                  <span className="text-[#94A3B8]">vs last</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-3">
        <div className="flex gap-0.5 bg-[#F1F5F9] p-0.5 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* UTM Tracking Tab */}
        {activeTab === 'utm' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-2 mb-3">
              <div className="flex items-center gap-2 px-3 h-8 bg-white border border-[#E2E8F0] rounded-lg shadow-sm">
                <Filter size={12} className="text-[#94A3B8]" />
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="text-xs text-[#475569] focus:outline-none bg-transparent cursor-pointer"
                >
                  <option value="All">All Sources</option>
                  <option value="facebook">Facebook</option>
                  <option value="google">Google</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
            </div>

            {/* UTM Table */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    {['UTM Source', 'Medium', 'Campaign', 'Leads', 'Cost', 'CPL', 'Conv.', 'Won'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-[#64748B] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {utmData
                    .filter((r) => filterSource === 'All' || r.utmSource === filterSource)
                    .map((row) => (
                      <tr key={row.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Share2 size={12} className="text-[#1D4ED8]" />
                            <span className="text-xs font-medium text-[#0F172A] capitalize">{row.utmSource}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-medium rounded-full">
                            {row.utmMedium}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#475569] max-w-[140px] truncate">{row.utmCampaign}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-bold text-[#0F172A]">{row.leads}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#475569]">₹{row.cost.toLocaleString()}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[11px] font-semibold ${row.cpl === 0 ? 'text-[#16A34A]' : row.cpl < 1000 ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
                            {row.cpl === 0 ? 'Free' : `₹${row.cpl}`}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                              <div className="h-full bg-[#16A34A] rounded-full" style={{ width: `${Math.min(row.conversionRate * 5, 100)}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold text-[#16A34A]">{row.conversionRate}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 bg-[#F0FDF4] text-[#16A34A] text-[10px] font-bold rounded-full">
                            {row.won}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Source Performance Tab */}
        {activeTab === 'sources' && (
          <div className="grid grid-cols-2 gap-4">
            {/* Source Breakdown */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Leads by Source</h3>
              <div className="space-y-3">
                {sourceData.map((source) => (
                  <div key={source.source}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: source.color }} />
                        <span className="text-sm font-semibold text-[#0F172A]">{source.source}</span>
                      </div>
                      <span className="text-sm font-bold text-[#0F172A]">{source.leads}</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(source.leads / 884) * 100}%`, background: source.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-[#64748B]">{((source.leads / 884) * 100).toFixed(1)}%</span>
                      <span className="text-[#94A3B8]">CPL: {source.cpl === 0 ? 'Free' : `₹${source.cpl}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Comparison */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Cost Per Lead Comparison</h3>
              <div className="space-y-3">
                {sourceData
                  .filter((s) => s.cpl > 0)
                  .sort((a, b) => a.cpl - b.cpl)
                  .map((source) => (
                    <div key={source.source} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-[#475569]">{source.source}</div>
                      <div className="flex-1">
                        <div className="h-6 bg-[#EFF6FF] rounded-lg relative overflow-hidden">
                          <div
                            className="h-full rounded-lg flex items-center justify-end px-2"
                            style={{
                              width: `${Math.min((source.cpl / 3000) * 100, 100)}%`,
                              background: source.color + '30',
                              borderRight: `3px solid ${source.color}`,
                            }}
                          >
                            <span className="text-xs font-bold" style={{ color: source.color }}>
                              ₹{source.cpl}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="text-xs font-bold text-[#16A34A]">{source.conversionRate}%</span>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="mt-4 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <h4 className="text-xs font-bold text-[#64748B] mb-2">Best Performing Source</h4>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                    <TrendingUp size={15} className="text-[#7C3AED]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">Referral Program</p>
                    <p className="text-xs text-[#64748B]">13.3% conversion · ₹333 CPL</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversion Funnel Tab */}
        {activeTab === 'funnel' && (
          <div className="flex gap-4">
            {/* Funnel Visualization */}
            <div className="flex-1 bg-white rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Lead Conversion Funnel</h3>
              <div className="space-y-2">
                {funnelData.map((stage, idx) => {
                  const width = idx === 0 ? 100 : (stage.count / funnelData[0].count) * 100
                  const colors = [
                    'from-[#1D4ED8] to-[#3B82F6]',
                    'from-[#3B82F6] to-[#60A5FA]',
                    'from-[#60A5FA] to-[#93C5FD]',
                    'from-[#93C5FD] to-[#BFDBFE]',
                    'from-[#BFDBFE] to-[#DBEAFE]',
                    'from-[#16A34A] to-[#22C55E]',
                  ]

                  return (
                    <div key={stage.stage} className="relative">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-right shrink-0">
                          <p className="text-xs font-medium text-[#0F172A]">{stage.stage}</p>
                          <p className="text-[10px] text-[#64748B]">{stage.count} leads</p>
                        </div>
                        <div className="flex-1">
                          <div
                            className={`h-7 rounded-lg bg-gradient-to-r ${colors[idx]} flex items-center justify-between px-2.5 transition-all hover:opacity-90`}
                            style={{ width: `${width}%` }}
                          >
                            <span className="text-white font-bold text-xs">{stage.count}</span>
                            {idx > 0 && stage.dropOff > 0 && (
                              <span className="text-white/80 text-[10px]">-{stage.dropOff}%</span>
                            )}
                          </div>
                        </div>
                        <div className="w-12 text-right shrink-0">
                          <span className="text-[10px] font-semibold text-[#64748B]">
                            {((stage.count / funnelData[0].count) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Funnel Metrics */}
            <div className="w-64 space-y-3">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-3">
                <h4 className="text-xs font-bold text-[#64748B] mb-2">Key Metrics</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Lead → Contact', value: '63.6%' },
                    { label: 'Contact → Qualified', value: '49.8%' },
                    { label: 'Qualified → Won', value: '19.6%' },
                    { label: 'Overall Conversion', value: '6.2%' },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between">
                      <span className="text-sm text-[#475569]">{m.label}</span>
                      <span className="text-sm font-bold text-[#0F172A]">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <h4 className="text-xs font-bold text-[#64748B] mb-3">Drop-off Points</h4>
                <div className="space-y-2">
                  {[
                    { stage: 'Contacted → Qualified', drop: '50%', color: '#DC2626' },
                    { stage: 'Proposal → Negotiation', drop: '37%', color: '#F59E0B' },
                    { stage: 'New → Contacted', drop: '36%', color: '#F59E0B' },
                  ].map((d) => (
                    <div key={d.stage} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-[#475569] flex-1">{d.stage}</span>
                      <span className="text-xs font-bold" style={{ color: d.color }}>
                        {d.drop}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lead Visualization Tab */}
        {activeTab === 'visualization' && (
          <div className="space-y-4">
            {/* Platform Cards */}
            <div className="grid grid-cols-3 gap-3">
              {sourceData.map((source) => (
                <div
                  key={source.source}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: source.color + '10' }}
                      >
                        <Smartphone size={15} style={{ color: source.color }} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#0F172A]">{source.source}</h3>
                        <p className="text-[10px] text-[#64748B]">{source.leads} leads</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[#94A3B8]" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#F8FAFC] rounded-lg p-2">
                      <p className="text-[10px] text-[#64748B]">CPL</p>
                      <p className="text-sm font-bold" style={{ color: source.cpl === 0 ? '#16A34A' : source.cpl < 1000 ? '#16A34A' : '#D97706' }}>
                        {source.cpl === 0 ? 'Free' : `₹${source.cpl}`}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-2">
                      <p className="text-[10px] text-[#64748B]">Conversion</p>
                      <p className="text-sm font-bold text-[#16A34A]">{source.conversionRate}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B]">{source.qualified} qualified</span>
                    <span className="px-2 py-0.5 bg-[#F0FDF4] text-[#16A34A] font-bold rounded-full">
                      {source.won} won
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quality vs Volume Matrix */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Lead Quality vs Volume Matrix</h3>
              <div className="relative h-64 bg-[#F8FAFC] rounded-xl p-4">
                {/* Grid lines */}
                <div className="absolute inset-4 border-l border-b border-[#E2E8F0]">
                  {/* Y-axis: Volume */}
                  <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[10px] text-[#94A3B8]">
                    <span>500</span>
                    <span>250</span>
                    <span>0</span>
                  </div>
                  {/* X-axis: Quality (Conversion Rate) */}
                  <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-[#94A3B8]">
                    <span>0%</span>
                    <span>7.5%</span>
                    <span>15%</span>
                  </div>
                </div>

                {/* Data points */}
                {sourceData.map((source) => {
                  const x = (source.conversionRate / 15) * 100
                  const y = (source.leads / 500) * 100
                  return (
                    <div
                      key={source.source}
                      className="absolute flex flex-col items-center group cursor-pointer"
                      style={{
                        left: `calc(16px + (${x}% * 0.85))`,
                        bottom: `calc(16px + (${y}% * 0.85))`,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 border-white shadow-md group-hover:scale-125 transition-transform"
                        style={{ background: source.color }}
                      />
                      <span className="text-[10px] font-medium text-[#475569] mt-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {source.source}
                      </span>
                    </div>
                  )
                })}

                {/* Labels */}
                <div className="absolute top-2 right-2 text-[10px] text-[#94A3B8]">
                  High Volume →
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] text-[#94A3B8]">
                  Low Quality →
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

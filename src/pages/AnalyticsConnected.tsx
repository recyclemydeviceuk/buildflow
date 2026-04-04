import { useEffect, useMemo, useState } from 'react'
import { Calendar, Link2, PieChart, ListFilter, BarChart3, Users, Phone, Clock, AlertTriangle } from 'lucide-react'
import { analyticsAPI } from '../api/analytics'

type TabKey = 'utm' | 'sources' | 'funnel' | 'visual'
type DateRangeKey = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'This Month' | 'Last Month' | 'Custom'

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

export default function AnalyticsConnected() {
  const [activeTab, setActiveTab] = useState<TabKey>('utm')
  const [dateRange, setDateRange] = useState<DateRangeKey>('Last 30 days')

  const [kpis, setKpis] = useState<any>(null)
  const [utm, setUtm] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any[]>([])

  const params = useMemo(() => computeDateRange(dateRange), [dateRange])

  useEffect(() => {
    const load = async () => {
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
      }
    }
    load()
  }, [params])

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

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Analytics & Tracking</h1>
            <p className="text-sm text-[#64748B]">Live metrics from your backend</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[#94A3B8]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            >
              {(['Last 7 days', 'Last 30 days', 'Last 90 days', 'This Month', 'Last Month', 'Custom'] as DateRangeKey[]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: kpis?.totalLeads ?? 0, icon: Users, color: '#1D4ED8', bg: '#EFF6FF' },
            { label: 'Qualified Leads', value: kpis?.qualifiedLeads ?? 0, icon: Clock, color: '#16A34A', bg: '#F0FDF4' },
            { label: 'Won Leads', value: kpis?.wonLeads ?? 0, icon: AlertTriangle, color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Connected Calls', value: kpis?.connectedCalls ?? 0, icon: Phone, color: '#16A34A', bg: '#F0FDF4' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={22} style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-xs text-[#64748B] font-medium">{k.label}</p>
                <p className="text-xl font-bold text-[#0F172A]">{k.value}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                  {kpis ? `Conv ${Number(kpis.conversionRate ?? 0).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 pt-6">
        <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-xl w-fit">
          {[
            { id: 'utm' as const, label: 'UTM Tracking', icon: Link2 },
            { id: 'sources' as const, label: 'Source Performance', icon: PieChart },
            { id: 'funnel' as const, label: 'Conversion Funnel', icon: ListFilter },
            { id: 'visual' as const, label: 'Lead Visualization', icon: BarChart3 },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.id ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {activeTab === 'utm' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  {['UTM Source', 'Medium', 'Campaign', 'Leads', 'Won', 'Conversion'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-bold text-[#64748B] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {utmRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-[#94A3B8] text-sm">
                      No UTM data for this range.
                    </td>
                  </tr>
                ) : (
                  utmRows.map((r) => (
                    <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">{r.utmSource}</td>
                      <td className="px-4 py-3 text-sm text-[#475569]">{r.utmMedium}</td>
                      <td className="px-4 py-3 text-sm text-[#475569]">{r.utmCampaign}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">{r.leads}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{r.won}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#1D4ED8]">
                        {r.conversionRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="space-y-4">
            {sources.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-[#94A3B8]">
                No source data for this range.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
                <h3 className="text-sm font-bold text-[#0F172A] mb-4">Leads by Source</h3>
                <div className="space-y-3">
                  {sources.map((s) => (
                    <div key={s.source} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{s.source}</p>
                        <p className="text-xs text-[#94A3B8]">{s.qualifiedLeads} qualified · {s.wonLeads} won</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#0F172A]">{s.totalLeads} leads</p>
                        <p className="text-xs text-[#1D4ED8] font-semibold">{Number(s.conversionRate ?? 0).toFixed(1)}% conversion</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'funnel' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">Conversion Funnel</h3>
            {funnel.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No funnel data for this range.</p>
            ) : (
              <div className="space-y-3">
                {funnel.map((f) => (
                  <div key={f.stage} className="flex items-center gap-4">
                    <span className="w-36 text-sm text-[#475569] font-medium">{f.stage}</span>
                    <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1D4ED8] rounded-full"
                        style={{ width: `${funnel[0]?.count ? (f.count / funnel[0].count) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm font-bold text-[#0F172A]">{f.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'visual' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">Lead Visualization</h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Backend-driven: each source is shown with volume (leads) vs conversion (won/total).
            </p>
            {sources.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No data.</p>
            ) : (
              <div className="space-y-3">
                {sources.map((s) => (
                  <div key={s.source} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#1D4ED8' }} />
                      <span className="text-sm font-semibold text-[#0F172A]">{s.source}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#475569]">{s.totalLeads} leads</span>
                      <span className="ml-3 text-xs font-bold text-[#1D4ED8]">{Number(s.conversionRate ?? 0).toFixed(1)}% conv</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


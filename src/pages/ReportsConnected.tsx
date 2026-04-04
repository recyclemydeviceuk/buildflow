import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, BarChart3, PieChart, TrendingUp, DownloadCloud } from 'lucide-react'
import { analyticsAPI } from '../api/analytics'
import { reportsAPI } from '../api/reports'

type ReportKey = 'leads' | 'calls' | 'conversion' | 'rep'
type DateRangeKey = 'This Week' | 'This Month' | 'Last Month' | 'Last 3 Months' | 'Custom'

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

export default function ReportsConnected() {
  const [activeReport, setActiveReport] = useState<ReportKey>('leads')
  const [dateRange, setDateRange] = useState<DateRangeKey>('This Month')

  const params = useMemo(() => computeDateRange(dateRange), [dateRange])

  const [leadPipeline, setLeadPipeline] = useState<any>(null)
  const [callActivity, setCallActivity] = useState<any>(null)
  const [conversionFunnel, setConversionFunnel] = useState<any>(null)
  const [repPerformance, setRepPerformance] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
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

  const reportTypes: { id: ReportKey; label: string; icon: any; desc: string }[] = [
    { id: 'leads', label: 'Lead Pipeline', icon: TrendingUp, desc: 'Leads by disposition, source and city' },
    { id: 'calls', label: 'Call Activity', icon: BarChart3, desc: 'Call outcome and rep activity' },
    { id: 'conversion', label: 'Conversion Funnel', icon: PieChart, desc: 'Stage-by-stage funnel from New to Won' },
    { id: 'rep', label: 'Rep Performance', icon: FileText, desc: 'Leaderboard + connect counts' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Reports</h1>
            <p className="text-sm text-[#475569] mt-0.5">Backend-driven analytics with CSV exports</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            >
              {(['This Week', 'This Month', 'Last Month', 'Last 3 Months', 'Custom'] as DateRangeKey[]).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 flex gap-6">
        <div className="w-72 shrink-0 space-y-2">
          <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider px-1 mb-3">Report Type</p>
          {reportTypes.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                activeReport === r.id ? 'bg-[#EFF6FF] border-[#BFDBFE] shadow-sm' : 'bg-white border-[#E2E8F0] hover:border-[#BFDBFE]'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-1">
                <r.icon size={14} className={activeReport === r.id ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'} />
                <p className={`text-sm font-semibold ${activeReport === r.id ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>{r.label}</p>
              </div>
              <p className="text-[10px] text-[#94A3B8] leading-relaxed">{r.desc}</p>
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-6">
          {activeReport === 'leads' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4">Lead Pipeline</h3>
              {!leadPipeline ? (
                <p className="text-sm text-[#94A3B8]">Loading...</p>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">By Disposition</p>
                    {leadPipeline.byDisposition?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {leadPipeline.byDisposition.map((d: any) => (
                          <span key={d._id} className="px-3 py-1 rounded-full bg-[#F1F5F9] text-[#0F172A] text-xs font-bold">
                            {d._id}: {d.count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#94A3B8]">No disposition data.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">By Source</p>
                    {leadPipeline.bySource?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {leadPipeline.bySource.map((d: any) => (
                          <span key={d._id} className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-xs font-bold">
                            {d._id}: {d.count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#94A3B8]">No source data.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">By City</p>
                    {leadPipeline.byCity?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {leadPipeline.byCity.map((d: any) => (
                          <span key={d._id} className="px-3 py-1 rounded-full bg-[#F8FAFC] text-[#0F172A] text-xs font-bold">
                            {d._id}: {d.count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#94A3B8]">No city data.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeReport === 'calls' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4">Call Activity</h3>
              {!callActivity ? (
                <p className="text-sm text-[#94A3B8]">Loading...</p>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">By Outcome</p>
                    <div className="flex flex-wrap gap-2">
                      {callActivity.byOutcome?.map((d: any) => (
                        <span key={d._id} className="px-3 py-1 rounded-full bg-[#F1F5F9] text-[#0F172A] text-xs font-bold">
                          {d._id}: {d.count}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">By Representative</p>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC]">
                            {['Rep', 'Calls', 'Connected', 'Avg Duration'].map((h) => (
                              <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {callActivity.byRep?.map((r: any) => (
                            <tr key={r._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                              <td className="px-4 py-3 text-sm font-semibold text-[#0F172A]">{r.name}</td>
                              <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">{r.total}</td>
                              <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{r.connected}</td>
                              <td className="px-4 py-3 text-sm text-[#475569]">
                                {r.total ? Math.round((r.totalDuration ?? 0) / r.total) : 0}s
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeReport === 'conversion' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4">Conversion Funnel</h3>
              {!conversionFunnel ? (
                <p className="text-sm text-[#94A3B8]">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {conversionFunnel.map((f: any) => (
                    <div key={f.stage} className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#0F172A]">{f.stage}</span>
                      <span className="text-sm font-bold text-[#1D4ED8]">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeReport === 'rep' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4">Rep Performance</h3>
              {!repPerformance ? (
                <p className="text-sm text-[#94A3B8]">Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FAFC]">
                        {['Rep', 'Calls', 'Connected', 'Avg Duration'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {repPerformance.map((r: any) => (
                        <tr key={r._id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 text-sm font-semibold text-[#0F172A]">{r.representativeName}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#0F172A]">{r.totalCalls}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{r.connectedCalls}</td>
                          <td className="px-4 py-3 text-sm text-[#475569]">{Math.round(r.avgDuration ?? 0)}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


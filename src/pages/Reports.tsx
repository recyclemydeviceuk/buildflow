import { useState } from 'react'
import { Download, FileText, TrendingUp, BarChart3, PieChart } from 'lucide-react'
import { sourceData } from '../data/mockData'

const reportTypes = [
  { id: 'leads', label: 'Lead Pipeline', icon: TrendingUp, desc: 'Full breakdown of leads by source, disposition, and owner' },
  { id: 'calls', label: 'Call Activity', icon: BarChart3, desc: 'Call volume, duration, and outcome trends over time' },
  { id: 'conversion', label: 'Conversion Funnel', icon: PieChart, desc: 'Stage-by-stage funnel from New to Won' },
  { id: 'rep', label: 'Rep Performance', icon: FileText, desc: 'Individual rep metrics, scores, and ignored rates' },
]

const months = ['Jan', 'Feb', 'Mar']
const sources = ['Meta', 'Google', 'Website', 'Referral', 'Manual'] as const
const sourceColors: Record<string, string> = {
  Meta: '#1877F2', Google: '#EA4335', Website: '#16A34A', Referral: '#7C3AED', Manual: '#94A3B8'
}

const maxVal = Math.max(...sourceData.flatMap(m => sources.map(s => m[s])))

export default function Reports() {
  const [activeReport, setActiveReport] = useState('leads')
  const [dateRange, setDateRange] = useState('This Month')

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Reports</h1>
            <p className="text-xs text-[#475569] mt-0.5">Export and analyze historical data</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 cursor-pointer"
            >
              {['This Week', 'This Month', 'Last Month', 'Last 3 Months', 'Custom'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 flex gap-4">
        {/* Report type selector */}
        <div className="w-44 shrink-0 space-y-1.5">
          <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider px-1 mb-2">Report Type</p>
          {reportTypes.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                activeReport === r.id
                  ? 'bg-[#EFF6FF] border-[#BFDBFE] shadow-sm'
                  : 'bg-white border-[#E2E8F0] hover:border-[#BFDBFE]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <r.icon size={12} className={activeReport === r.id ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'} />
                <p className={`text-xs font-semibold ${activeReport === r.id ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>{r.label}</p>
              </div>
              <p className="text-[9px] text-[#94A3B8] leading-relaxed">{r.desc}</p>
            </button>
          ))}
        </div>

        {/* Main report area */}
        <div className="flex-1 space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Leads', value: '348', sub: 'This month' },
              { label: 'New Leads', value: '89', sub: '+12% vs last month' },
              { label: 'Won', value: '18', sub: '5.2% conversion' },
              { label: 'Dead / Lost', value: '34', sub: '9.8% churn' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-[#E2E8F0] px-3 py-2.5">
                <p className="text-[10px] text-[#94A3B8] font-medium">{s.label}</p>
                <p className="text-xl font-bold text-[#0F172A] mt-0.5">{s.value}</p>
                <p className="text-[9px] text-[#94A3B8] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Bar chart — Lead Sources over time */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Leads by Source — Monthly</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">Volume per source across reporting months</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {sources.map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: sourceColors[s] }} />
                    <span className="text-[10px] font-medium text-[#475569]">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grouped bar chart (CSS-based) */}
            <div className="flex items-end gap-4 h-40 pt-3">
              {sourceData.map(month => (
                <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex items-end gap-1 h-40 w-full justify-center">
                    {sources.map(s => {
                      const pct = (month[s] / maxVal) * 100
                      return (
                        <div key={s} className="flex-1 flex flex-col justify-end group relative">
                          <div
                            className="rounded-t-sm transition-all duration-500 cursor-pointer hover:opacity-80"
                            style={{ height: `${pct}%`, background: sourceColors[s], minHeight: '4px' }}
                          />
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#0F172A] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                            {s}: {month[s]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs font-semibold text-[#475569]">{month.month}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Disposition pipeline table */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0]">
              <p className="text-sm font-bold text-[#0F172A]">Pipeline Summary</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  {['Stage', 'Count', 'Avg Days', 'Conv. Next', 'Revenue'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { stage: 'New', count: 89, avgDays: 1.2, conv: '68%', rev: '—' },
                  { stage: 'Contacted', count: 61, avgDays: 3.4, conv: '52%', rev: '—' },
                  { stage: 'Qualified', count: 42, avgDays: 5.1, conv: '44%', rev: '~118 Cr' },
                  { stage: 'Proposal', count: 28, avgDays: 8.3, conv: '39%', rev: '~98 Cr' },
                  { stage: 'Negotiation', count: 18, avgDays: 12.6, conv: '61%', rev: '~72 Cr' },
                  { stage: 'Won', count: 11, avgDays: '—', conv: '—', rev: '~44 Cr' },
                ].map(row => (
                  <tr key={row.stage} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 text-xs font-semibold text-[#0F172A]">{row.stage}</td>
                    <td className="px-3 py-2.5 text-xs text-[#0F172A]">{row.count}</td>
                    <td className="px-3 py-2.5 text-xs text-[#475569]">{typeof row.avgDays === 'number' ? `${row.avgDays}d` : row.avgDays}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-[#16A34A]">{row.conv}</td>
                    <td className="px-3 py-2.5 text-xs text-[#475569]">{row.rev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

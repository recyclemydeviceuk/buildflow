import { useState } from 'react'
import { Search, Shield, User, Settings, Cpu } from 'lucide-react'
import { auditLogs } from '../data/mockData'

const actionColors: Record<string, { bg: string; color: string }> = {
  'Disposition Changed': { bg: '#EFF6FF', color: '#1D4ED8' },
  'Lead Assigned': { bg: '#F0FDF4', color: '#16A34A' },
  'Reminder Set': { bg: '#FFFBEB', color: '#F59E0B' },
  'Lead Marked Dead': { bg: '#FEF2F2', color: '#DC2626' },
  'Call Logged': { bg: '#F0FDF4', color: '#16A34A' },
  'Lead Offer Timed Out': { bg: '#FEF2F2', color: '#DC2626' },
  'Note Added': { bg: '#F5F3FF', color: '#7C3AED' },
}

const roleIcons: Record<string, React.FC<any>> = {
  Agent: User,
  Manager: Shield,
  System: Cpu,
  Admin: Settings,
}

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('All')
  const [filterAction, setFilterAction] = useState('All')

  const actions = ['All', ...Array.from(new Set(auditLogs.map(l => l.action)))]
  const roles = ['All', 'Agent', 'Manager', 'System', 'Admin']

  const filtered = auditLogs.filter(log => {
    const matchSearch = log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.entity.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'All' || log.role === filterRole
    const matchAction = filterAction === 'All' || log.action === filterAction
    return matchSearch && matchRole && matchAction
  })

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Audit Log</h1>
            <p className="text-xs text-[#475569] mt-0.5">Complete history of all system and user actions</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
            <Shield size={12} className="text-[#16A34A]" />
            <span className="text-xs font-semibold text-[#16A34A]">Tamper-proof</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actor, entity or action..."
              className="w-full pl-8 pr-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs placeholder-[#94A3B8] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="h-8 px-3 pr-7 appearance-none bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] cursor-pointer"
          >
            {roles.map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
          </select>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="h-8 px-3 pr-7 appearance-none bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] cursor-pointer"
          >
            {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="p-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Before', 'After'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm text-[#94A3B8]">No log entries match your filters.</p>
                  </td>
                </tr>
              ) : filtered.map(log => {
                const ac = actionColors[log.action] || { bg: '#F8FAFC', color: '#94A3B8' }
                const RoleIcon = roleIcons[log.role] || User

                return (
                  <tr key={log.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="text-[10px] font-mono text-[#475569] whitespace-nowrap">{log.timestamp}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-[#1D4ED8]">
                            {log.actor.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-[#0F172A] truncate max-w-[100px]">{log.actor}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <RoleIcon size={11} className="text-[#94A3B8]" />
                        <span className="text-[11px] text-[#475569]">{log.role}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: ac.bg, color: ac.color }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-[#475569] truncate max-w-[120px] block">{log.entity}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-[#94A3B8] font-mono">{log.before}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-[#0F172A] font-semibold">{log.after}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#94A3B8] mt-2 text-center">
          Showing {filtered.length} of {auditLogs.length} entries
        </p>
      </div>
    </div>
  )
}

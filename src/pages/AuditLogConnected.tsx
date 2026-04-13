import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Shield } from 'lucide-react'
import { auditAPI, type AuditLogRow } from '../api/audit'
import { useAuth } from '../context/AuthContext'

type RoleFilter = 'all' | 'representative' | 'manager'

function stringifyCompact(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function humanizeKey(key: string) {
  if (key === '_id') return 'ID'
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function humanizeActionLabel(action: string) {
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function humanizeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Empty'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (typeof value === 'string') {
    const maybeDate = new Date(value)
    if (!Number.isNaN(maybeDate.getTime()) && /T|\d{4}-\d{2}-\d{2}/.test(value)) {
      return maybeDate.toLocaleString('en-IN')
    }
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Empty'
    return value.map((item) => humanizeValue(item)).join(', ')
  }
  if (isPlainRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return 'Empty object'
    return entries
      .slice(0, 3)
      .map(([entryKey, entryValue]) => `${humanizeKey(entryKey)}: ${humanizeValue(entryValue)}`)
      .join(' • ')
  }
  return String(value)
}

function snapshotEntries(value: unknown): Array<{ key: string; label: string; value: string }> {
  if (!isPlainRecord(value)) return []
  return Object.entries(value).map(([key, entryValue]) => ({
    key,
    label: humanizeKey(key),
    value: humanizeValue(entryValue),
  }))
}

function buildChangeRows(before: unknown, after: unknown): Array<{
  key: string
  label: string
  before: string
  after: string
  changed: boolean
}> {
  const beforeRecord = isPlainRecord(before) ? before : {}
  const afterRecord = isPlainRecord(after) ? after : {}
  const allKeys = Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]))

  const rows = allKeys
    .map((key) => {
      const beforeValue = beforeRecord[key]
      const afterValue = afterRecord[key]
      const changed = stringifyCompact(beforeValue) !== stringifyCompact(afterValue)
      return {
        key,
        label: humanizeKey(key),
        before: humanizeValue(beforeValue),
        after: humanizeValue(afterValue),
        changed,
      }
    })
    .filter((row) => row.changed)

  if (rows.length > 0) return rows

  if (Object.keys(afterRecord).length > 0) {
    return Object.keys(afterRecord).slice(0, 6).map((key) => ({
      key,
      label: humanizeKey(key),
      before: 'Empty',
      after: humanizeValue(afterRecord[key]),
      changed: true,
    }))
  }

  if (Object.keys(beforeRecord).length > 0) {
    return Object.keys(beforeRecord).slice(0, 6).map((key) => ({
      key,
      label: humanizeKey(key),
      before: humanizeValue(beforeRecord[key]),
      after: 'Empty',
      changed: true,
    }))
  }

  return []
}

function formatDateParts(value: string) {
  const date = new Date(value)
  return {
    date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

function formatRoleLabel(role?: string) {
  if (!role) return 'Unknown'
  if (role === 'representative') return 'Representative'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function getRoleBadgeClasses(role?: string) {
  switch (role) {
    case 'manager':
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
    case 'representative':
      return 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
    case 'admin':
      return 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
    case 'system':
      return 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
    default:
      return 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
  }
}

function getActionBadgeClasses(action: string) {
  if (action.includes('deleted') || action.includes('removed')) {
    return 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
  }
  if (action.includes('created') || action.includes('added')) {
    return 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
  }
  if (action.includes('updated') || action.includes('changed')) {
    return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
  }
  return 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
}

export default function AuditLogConnected() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filterLeadStatus, setFilterLeadStatus] = useState('All')
  const [filterAction, setFilterAction] = useState('All')
  const [filterRole, setFilterRole] = useState<RoleFilter>('all')
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [pagination, setPagination] = useState<{ pages: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [leadStatusOptions, setLeadStatusOptions] = useState<string[]>(['All'])
  const [actionOptions, setActionOptions] = useState<string[]>(['All'])
  const [roleOptions, setRoleOptions] = useState<Array<{ value: RoleFilter; label: string }>>([
    { value: 'all', label: 'All Roles' },
    { value: 'representative', label: 'Representative' },
    { value: 'manager', label: 'Manager' },
  ])

  const loadFilters = async () => {
    try {
      const res = await auditAPI.getAuditLogFilters()
      if (!res.success) return

      setActionOptions(['All', ...res.data.actions])
      setLeadStatusOptions(['All', ...res.data.leadStatuses])

      const dynamicRoleOptions = [
        { value: 'all' as RoleFilter, label: 'All Roles' },
        ...res.data.roles
          .filter((role): role is Exclude<RoleFilter, 'all'> => role === 'representative' || role === 'manager')
          .map((role) => ({
            value: role,
            label: formatRoleLabel(role),
          })),
      ]

      setRoleOptions(dynamicRoleOptions)
    } catch (error) {
      console.error('Failed to load audit filters:', error)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await auditAPI.getAuditLogs({
        page: String(page),
        limit: String(limit),
        actorRole: filterRole === 'all' ? undefined : filterRole,
        action: filterAction === 'All' ? undefined : filterAction,
        leadStatus: filterLeadStatus === 'All' ? undefined : filterLeadStatus,
        search: search || undefined,
      })
      if (res.success) {
        setRows(res.data)
        setPagination({ pages: res.pagination.pages, total: res.pagination.total })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFilters()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAction, filterLeadStatus, filterRole, search, user?.id])

  const urgentEmptyMessage = loading
    ? 'Loading audit history...'
    : 'No audit log entries match your filters.'

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Audit Log</h1>
            <p className="text-xs text-[#475569] mt-0.5">Backend-driven history of system and user actions</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
            <Shield size={12} className="text-[#16A34A]" />
            <span className="text-xs font-semibold text-[#16A34A]">Tamper-proof log</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="Search by actor, entity, or action..."
              className="w-full pl-8 pr-3 h-8 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
            />
          </div>

          <select
            value={filterLeadStatus}
            onChange={(event) => {
              setPage(1)
              setFilterLeadStatus(event.target.value)
            }}
            className="h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
          >
            {leadStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'All' ? 'All Lead Statuses' : status}
              </option>
            ))}
          </select>

          <select
            value={filterAction}
            onChange={(event) => {
              setPage(1)
              setFilterAction(event.target.value)
            }}
            className="h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action === 'All' ? 'All Actions' : humanizeActionLabel(action)}
              </option>
            ))}
          </select>

          <select
            value={filterRole}
            onChange={(event) => {
              setPage(1)
              setFilterRole(event.target.value as RoleFilter)
            }}
            className="h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
          >
          {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="grid grid-cols-[140px_200px_160px_1fr_36px] gap-3 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Timestamp</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Actor</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Event</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">Change Summary</div>
            <div />
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-[#94A3B8] text-sm">{urgentEmptyMessage}</div>
          ) : (
            <div>
              {rows.map((log) => {
                const expanded = expandedId === log._id
                const dateParts = formatDateParts(log.createdAt)
                const hasSnapshots = Boolean(log.before || log.after)
                const changeRows = buildChangeRows(log.before, log.after)
                const beforeEntries = snapshotEntries(log.before)
                const afterEntries = snapshotEntries(log.after)

                return (
                  <div key={log._id} className="border-b border-[#F1F5F9] last:border-b-0">
                    <div className="grid grid-cols-[140px_200px_160px_1fr_36px] gap-3 px-4 py-2.5 hover:bg-[#FAFCFF] transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A]">{dateParts.date}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">{dateParts.time}</p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {String(log.actorName || '?')
                              .split(' ')
                              .filter(Boolean)
                              .map((part) => part[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#0F172A] break-words">{log.actorName}</p>
                            <span className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${getRoleBadgeClasses(log.actorRole)}`}>
                              {formatRoleLabel(log.actorRole)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${getActionBadgeClasses(log.action)}`}>
                          {humanizeActionLabel(log.action)}
                        </span>
                        <p className="text-[10px] text-[#64748B] mt-1 break-words">
                          {log.entity}
                          {log.entityId ? <span className="text-[#94A3B8]"> • {log.entityId.slice(-8)}</span> : null}
                        </p>
                      </div>

                      <div className="min-w-0">
                        {hasSnapshots ? (
                          changeRows.length > 0 ? (
                            <div className="space-y-1">
                              {changeRows.slice(0, 3).map((row) => (
                                <div key={row.key} className="flex items-start gap-2 text-[10px]">
                                  <span className="font-semibold text-[#475569] shrink-0 min-w-[80px]">{row.label}:</span>
                                  <span className="text-[#94A3B8] line-through truncate max-w-[80px]">{row.before === 'Empty' ? '—' : row.before}</span>
                                  <span className="text-[#0F172A] font-medium truncate max-w-[100px]">{row.after}</span>
                                </div>
                              ))}
                              {changeRows.length > 3 ? (
                                <p className="text-[9px] text-[#94A3B8]">+{changeRows.length - 3} more changes</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#94A3B8] italic">No field differences detected</p>
                          )
                        ) : (
                          <p className="text-[10px] text-[#94A3B8] italic">No snapshot</p>
                        )}
                      </div>

                      <div className="flex items-start justify-end">
                        <button
                          type="button"
                          onClick={() => setExpandedId((current) => (current === log._id ? null : log._id))}
                          className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
                          title={expanded ? 'Hide details' : 'Show details'}
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="px-4 pb-3">
                        <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] p-3">
                          {changeRows.length > 0 ? (
                            <div className="mb-3">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1.5">Field Changes</p>
                              <div className="rounded-lg border border-[#E2E8F0] overflow-hidden bg-white">
                                <div className="grid grid-cols-[160px_1fr_1fr] gap-3 px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Field</p>
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Before</p>
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">After</p>
                                </div>
                                {changeRows.map((row) => (
                                  <div key={row.key} className="grid grid-cols-[160px_1fr_1fr] gap-3 px-3 py-2 border-b border-[#F1F5F9] last:border-b-0">
                                    <p className="text-[10px] font-semibold text-[#334155]">{row.label}</p>
                                    <p className="text-[10px] text-[#64748B] break-words">{row.before}</p>
                                    <p className="text-[10px] font-medium text-[#0F172A] break-words">{row.after}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1.5">Before Snapshot</p>
                              <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5 space-y-1.5">
                                {beforeEntries.length > 0 ? (
                                  beforeEntries.map((entry) => (
                                    <div key={entry.key} className="flex items-start justify-between gap-2 border-b border-[#F8FAFC] pb-1.5 last:border-b-0 last:pb-0">
                                      <p className="text-[10px] font-semibold text-[#64748B] shrink-0">{entry.label}</p>
                                      <p className="text-[10px] text-[#0F172A] text-right break-words">{entry.value}</p>
                                    </div>
                                  ))
                                ) : (
                                  <pre className="text-[10px] leading-relaxed text-[#64748B] font-mono overflow-x-auto whitespace-pre-wrap break-words">
                                    {log.before ? prettyJson(log.before) : 'No snapshot'}
                                  </pre>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1.5">After Snapshot</p>
                              <div className="rounded-lg border border-[#DBEAFE] bg-white p-2.5 space-y-1.5">
                                {afterEntries.length > 0 ? (
                                  afterEntries.map((entry) => (
                                    <div key={entry.key} className="flex items-start justify-between gap-2 border-b border-[#F8FAFC] pb-1.5 last:border-b-0 last:pb-0">
                                      <p className="text-[10px] font-semibold text-[#64748B] shrink-0">{entry.label}</p>
                                      <p className="text-[10px] text-[#0F172A] text-right break-words">{entry.value}</p>
                                    </div>
                                  ))
                                ) : (
                                  <pre className="text-[10px] leading-relaxed text-[#0F172A] font-mono overflow-x-auto whitespace-pre-wrap break-words">
                                    {log.after ? prettyJson(log.after) : 'No snapshot'}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="text-xs font-bold text-[#1D4ED8]">
            Page {page}
            {pagination ? ` of ${pagination.pages}` : ''}
            {pagination ? <span className="text-[#94A3B8] font-normal"> · {pagination.total} total</span> : null}
          </div>
          <button
            onClick={() => setPage((current) => current + 1)}
            disabled={loading || (pagination ? page >= pagination.pages : true)}
            className="px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

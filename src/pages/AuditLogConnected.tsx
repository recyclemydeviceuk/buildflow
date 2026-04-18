import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Shield, Clock } from 'lucide-react'
import { auditAPI, type AuditLogRow } from '../api/audit'
import { useAuth } from '../context/AuthContext'

type RoleFilter = 'all' | 'representative' | 'manager'

// ───────────────────────── helpers ─────────────────────────

const isObjectId = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v)
const isIsoDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)
const isPlainRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)

// Fields that are noise in audit summaries (IDs, timestamps, internal flags)
const HIDDEN_FIELDS = new Set([
  '_id',
  '__v',
  'id',
  'createdAt',
  'updatedAt',
  'lastActivity',
  'assignedAt',
  'isInQueue',
  'statusNotes',
  'tags',
  'websiteFormData',
  'metaLeadId',
  'externalId',
  'campaignId',
  'skipCount',
  'isDuplicate',
  'assignmentAcknowledged',
  'duplicateOf',
])

function humanizeKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function humanizeAction(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (isObjectId(value)) return '' // suppress ObjectId noise
    if (isIsoDate(value)) {
      const d = new Date(value)
      return isNaN(d.getTime())
        ? value
        : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    }
    return value
  }
  if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} item(s)`
  return ''
}

type Change = { key: string; label: string; before: string; after: string }

function extractChanges(before: unknown, after: unknown): Change[] {
  const b = isPlainRecord(before) ? before : {}
  const a = isPlainRecord(after) ? after : {}
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).filter(
    (k) => !HIDDEN_FIELDS.has(k)
  )

  const changes: Change[] = []
  for (const key of keys) {
    const beforeVal = formatValue(b[key])
    const afterVal = formatValue(a[key])
    if (beforeVal === afterVal) continue
    if (!beforeVal && !afterVal) continue
    changes.push({ key, label: humanizeKey(key), before: beforeVal, after: afterVal })
  }
  return changes
}

// One-line human summary for the row, generated from the top 1–2 changes
function buildSummary(action: string, before: unknown, after: unknown, entity: string): string {
  const changes = extractChanges(before, after)

  if (action.includes('created')) return `Created new ${entity.toLowerCase()}`
  if (action.includes('deleted')) return `Deleted ${entity.toLowerCase()}`
  if (action.includes('assigned')) {
    const owner = changes.find((c) => c.key === 'ownerName')
    return owner ? `Assigned to ${owner.after || owner.before}` : 'Assignment changed'
  }
  if (action.includes('unassigned')) return `Unassigned from owner`

  if (changes.length === 0) return 'Updated record'
  if (changes.length === 1) {
    const c = changes[0]
    if (!c.before || c.before === '—') return `Set ${c.label} to "${c.after}"`
    if (!c.after || c.after === '—') return `Cleared ${c.label}`
    return `${c.label}: ${c.before} → ${c.after}`
  }
  const top = changes[0]
  return `${top.label}: ${top.before || '—'} → ${top.after || '—'} · +${changes.length - 1} more`
}

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return { primary: timeStr, secondary: 'Today' }
  return {
    primary: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    secondary: timeStr,
  }
}

function formatRoleLabel(role?: string) {
  if (!role) return 'Unknown'
  if (role === 'representative') return 'Representative'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function getActionStyle(action: string): { dot: string; bg: string; text: string; border: string } {
  if (action.includes('deleted') || action.includes('removed'))
    return { dot: '#DC2626', bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' }
  if (action.includes('created') || action.includes('added'))
    return { dot: '#16A34A', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }
  if (action.includes('assigned'))
    return { dot: '#7C3AED', bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }
  if (action.includes('updated') || action.includes('changed'))
    return { dot: '#1D4ED8', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }
  return { dot: '#64748B', bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' }
}

function getInitials(name?: string | null) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ───────────────────────── component ─────────────────────────

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
      setRoleOptions([
        { value: 'all' as RoleFilter, label: 'All Roles' },
        ...res.data.roles
          .filter((r): r is Exclude<RoleFilter, 'all'> => r === 'representative' || r === 'manager')
          .map((r) => ({ value: r, label: formatRoleLabel(r) })),
      ])
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

  const hasRows = rows.length > 0

  const selectClass =
    'h-9 px-3 pr-8 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#475569] font-medium appearance-none bg-no-repeat bg-[right_10px_center] bg-[length:10px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50 hover:border-[#CBD5E1] transition-colors'
  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-extrabold text-[#0F172A] tracking-tight">Audit Log</h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                {pagination?.total
                  ? `${pagination.total.toLocaleString()} recorded events`
                  : 'Backend-driven history of every action'}
              </p>
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0]"
              title="All entries are cryptographically sealed and cannot be modified."
            >
              <Shield size={12} className="text-[#16A34A]" />
              <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wide">Tamper-proof</span>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(e) => {
                  setPage(1)
                  setSearch(e.target.value)
                }}
                placeholder="Search by actor, entity, or action…"
                className="w-full pl-9 pr-3 h-9 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50 hover:border-[#CBD5E1] transition-colors"
              />
            </div>

            <select
              value={filterLeadStatus}
              onChange={(e) => {
                setPage(1)
                setFilterLeadStatus(e.target.value)
              }}
              className={selectClass}
              style={{ backgroundImage: chevronBg }}
            >
              {leadStatusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Lead Statuses' : s}
                </option>
              ))}
            </select>

            <select
              value={filterAction}
              onChange={(e) => {
                setPage(1)
                setFilterAction(e.target.value)
              }}
              className={selectClass}
              style={{ backgroundImage: chevronBg }}
            >
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a === 'All' ? 'All Actions' : humanizeAction(a)}
                </option>
              ))}
            </select>

            <select
              value={filterRole}
              onChange={(e) => {
                setPage(1)
                setFilterRole(e.target.value as RoleFilter)
              }}
              className={selectClass}
              style={{ backgroundImage: chevronBg }}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          {loading && !hasRows ? (
            <div className="py-20 text-center text-[#94A3B8] text-sm">Loading audit history…</div>
          ) : !hasRows ? (
            <div className="py-20 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F1F5F9] mb-3">
                <Clock size={20} className="text-[#94A3B8]" />
              </div>
              <p className="text-sm font-semibold text-[#475569]">No audit entries match your filters</p>
              <p className="text-xs text-[#94A3B8] mt-1">Try broadening the search or clearing filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {rows.map((log) => {
                const expanded = expandedId === log._id
                const time = formatTimestamp(log.createdAt)
                const actionStyle = getActionStyle(log.action)
                const summary = buildSummary(log.action, log.before, log.after, log.entity || 'record')
                const changes = extractChanges(log.before, log.after)

                return (
                  <div key={log._id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : log._id)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#FAFCFF] transition-colors text-left"
                    >
                      {/* Timeline dot */}
                      <div className="relative flex flex-col items-center shrink-0 w-14">
                        <div
                          className="w-2.5 h-2.5 rounded-full mb-1"
                          style={{ background: actionStyle.dot }}
                        />
                        <p className="text-xs font-bold text-[#0F172A] leading-none">{time.primary}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5 leading-none">{time.secondary}</p>
                      </div>

                      {/* Actor avatar */}
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] text-[#1D4ED8] text-[11px] font-bold flex items-center justify-center shrink-0 ring-1 ring-[#BFDBFE]">
                        {getInitials(log.actorName)}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-[#0F172A] truncate">{log.actorName}</p>
                          <span className="text-[10px] text-[#94A3B8]">•</span>
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold"
                            style={{
                              background: actionStyle.bg,
                              color: actionStyle.text,
                              borderColor: actionStyle.border,
                            }}
                          >
                            {humanizeAction(log.action)}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] truncate">{summary}</p>
                      </div>

                      {/* Expand chevron */}
                      <div className="shrink-0 text-[#94A3B8]">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-[72px] rounded-xl bg-[#FAFBFC] border border-[#E2E8F0] p-4">
                          {changes.length > 0 ? (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
                                Changes ({changes.length})
                              </p>
                              <div className="space-y-2">
                                {changes.map((c) => (
                                  <div
                                    key={c.key}
                                    className="flex items-start gap-3 text-xs py-1.5 border-b border-[#F1F5F9] last:border-b-0 last:pb-0"
                                  >
                                    <span className="font-semibold text-[#475569] shrink-0 min-w-[120px]">
                                      {c.label}
                                    </span>
                                    <span className="text-[#94A3B8] line-through truncate flex-1 min-w-0">
                                      {c.before || '—'}
                                    </span>
                                    <span className="text-[#0F172A] font-semibold truncate flex-1 min-w-0">
                                      {c.after || '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-[#94A3B8] italic">
                              No field-level changes recorded for this event.
                            </p>
                          )}

                          {log.entityId && (
                            <p className="mt-3 pt-3 border-t border-[#E2E8F0] text-[10px] text-[#94A3B8] font-mono">
                              {log.entity} · {log.entityId}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {hasRows && pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-0 bg-[#0F172A] rounded-lg p-0.5">
              <div className="px-3 h-7 flex items-center justify-center bg-white rounded-md text-[11px] font-bold text-[#0F172A] whitespace-nowrap">
                {page} <span className="mx-1 text-[#94A3B8]">/</span> {pagination.pages}
              </div>
            </div>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || page >= pagination.pages}
              className="px-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

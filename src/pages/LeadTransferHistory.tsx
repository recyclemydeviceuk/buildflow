import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  UserRound,
} from 'lucide-react'
import {
  auditAPI,
  type LeadTransferHistoryRow,
  type LeadTransferType,
} from '../api/audit'

type TypeFilter = 'all' | LeadTransferType
type RoleFilter = 'all' | 'manager' | 'representative'

const typeMeta: Record<LeadTransferType, { label: string; className: string }> = {
  assignment: {
    label: 'Assigned',
    className: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  },
  transfer: {
    label: 'Transferred',
    className: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]',
  },
  unassignment: {
    label: 'Unassigned',
    className: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
  },
}

const sourceLabels: Record<LeadTransferHistoryRow['source'], string> = {
  direct: 'Lead panel',
  bulk: 'Bulk edit',
  queue: 'Live queue',
  assistant: 'Timy assistant',
  call: 'Call assignment',
  declined: 'Assignment declined',
  legacy: 'Previous workflow',
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Unknown time'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const roleLabel = (role: string) =>
  role === 'representative' ? 'Representative' : role === 'manager' ? 'Manager' : 'Unknown role'

export default function LeadTransferHistory() {
  const [rows, setRows] = useState<LeadTransferHistoryRow[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [role, setRole] = useState<RoleFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await auditAPI.getLeadTransferHistory({
          page: String(page),
          limit: '25',
          search: debouncedSearch || undefined,
          type: type === 'all' ? undefined : type,
          actorRole: role === 'all' ? undefined : role,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        })
        if (!cancelled && response.success) {
          setRows(response.data)
          setPagination({ total: response.pagination.total, pages: response.pagination.pages })
        }
      } catch (requestError: any) {
        if (!cancelled) {
          setRows([])
          setPagination({ total: 0, pages: 0 })
          setError(requestError?.response?.data?.message || 'Could not load lead transfer history.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, type, role, dateFrom, dateTo])

  const resetPage = () => setPage(1)
  const selectClass =
    'h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50'

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="border-b border-[#E2E8F0] bg-white px-6 py-5">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#7C3AED]">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-[#0F172A]">Lead Transfer History</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">
                See which lead moved, who moved it, the previous owner, the new owner, and when it happened.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 lg:grid-cols-[minmax(260px,1fr)_160px_170px_155px_155px]">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(event) => {
                  resetPage()
                  setSearch(event.target.value)
                }}
                placeholder="Search lead, phone, user, or owner…"
                className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50"
              />
            </div>

            <select
              value={type}
              onChange={(event) => {
                resetPage()
                setType(event.target.value as TypeFilter)
              }}
              className={selectClass}
            >
              <option value="all">All movement types</option>
              <option value="transfer">Transfers only</option>
              <option value="assignment">Assignments only</option>
              <option value="unassignment">Unassignments only</option>
            </select>

            <select
              value={role}
              onChange={(event) => {
                resetPage()
                setRole(event.target.value as RoleFilter)
              }}
              className={selectClass}
            >
              <option value="all">All performed-by roles</option>
              <option value="manager">Managers</option>
              <option value="representative">Representatives</option>
            </select>

            <label className="relative">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  resetPage()
                  setDateFrom(event.target.value)
                }}
                aria-label="From date"
                className={`${selectClass} w-full pl-9`}
              />
            </label>

            <label className="relative">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  resetPage()
                  setDateTo(event.target.value)
                }}
                aria-label="To date"
                className={`${selectClass} w-full pl-9`}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-[#64748B]">
            {pagination.total.toLocaleString()} recorded lead movement{pagination.total === 1 ? '' : 's'}
          </p>
          <p className="text-[11px] text-[#94A3B8]">Newest first</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-sm text-[#94A3B8]">Loading transfer history…</div>
          ) : error ? (
            <div className="py-20 text-center">
              <p className="text-sm font-semibold text-[#DC2626]">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9]">
                <ArrowRightLeft size={20} className="text-[#94A3B8]" />
              </div>
              <p className="text-sm font-semibold text-[#475569]">No lead movements match these filters</p>
              <p className="mt-1 text-xs text-[#94A3B8]">Try clearing the search or date filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left">
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">When</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">Lead</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">Ownership change</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">Performed by</th>
                    <th className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {rows.map((row) => {
                    const meta = typeMeta[row.type]
                    return (
                      <tr key={row.id} className="hover:bg-[#FAFCFF]">
                        <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-[#64748B]">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <Link to={`/leads/${row.leadId}`} className="text-sm font-bold text-[#0F172A] hover:text-[#1D4ED8]">
                            {row.leadName}
                          </Link>
                          <p className="mt-0.5 text-xs text-[#94A3B8]">{row.leadPhone || 'No phone recorded'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex min-w-[270px] items-center gap-2">
                            <div className="min-w-0 flex-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">From</p>
                              <p className="truncate text-xs font-semibold text-[#475569]">{row.from?.name || 'Unassigned'}</p>
                            </div>
                            <ArrowRight size={15} className="shrink-0 text-[#94A3B8]" />
                            <div className="min-w-0 flex-1 rounded-lg border border-[#DDE7F7] bg-[#F8FBFF] px-3 py-2">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">To</p>
                              <p className="truncate text-xs font-bold text-[#1D4ED8]">{row.to?.name || 'Unassigned'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#1D4ED8]">
                              <UserRound size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0F172A]">{row.performedBy.name}</p>
                              <p className="text-[10px] text-[#94A3B8]">{roleLabel(row.performedBy.role)} · {sourceLabels[row.source]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${meta.className}`}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && !error && pagination.pages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-bold text-[#475569] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs font-semibold text-[#64748B]">Page {page} of {pagination.pages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
              disabled={page >= pagination.pages}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-bold text-[#475569] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

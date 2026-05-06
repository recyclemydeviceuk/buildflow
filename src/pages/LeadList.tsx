import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, MapPin, ChevronRight, ArrowUpDown, X, Plus, ChevronLeft, RefreshCw, Trash2, ToggleLeft, ToggleRight, Loader2, Download, User, ChevronDown, Clock, CalendarDays, Check } from 'lucide-react'
import { leadsAPI, type Lead } from '../api/leads'
import type { LeadFieldConfig } from '../api/settings'
import { callsAPI } from '../api/calls'
import { teamAPI } from '../api/team'
import { type FancyDropdownOption } from '../components/common/FancyDropdown'
import FancyMultiSelect from '../components/common/FancyMultiSelect'
import BulkEditLeadsModal from '../components/leads/BulkEditLeadsModal'
import CreatedAtEditor, { formatDateTimeLocalInput } from '../components/leads/CreatedAtEditor'
import ManualLeadModal from '../components/leads/ManualLeadModal'
import ExportLeadsModal from '../components/leads/ExportLeadsModal'
import RepresentativePicker, { type RepresentativePickerOption } from '../components/leads/RepresentativePicker'
import LeadColumnManager, {
  loadLeadColumnConfig,
  saveLeadColumnConfig,
  LEAD_COLUMN_LABELS,
  type LeadColumnConfig,
  type LeadColumnKey,
} from '../components/leads/LeadColumnManager'
import DateRangePicker, { type DateRange } from '../components/common/DateRangePicker'
import WhatsAppIcon from '../components/common/WhatsAppIcon'
import { openWhatsAppChat, sanitizePhoneForWhatsApp } from '../utils/whatsapp'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { LEAD_FIELDS_STORAGE_KEY, LEAD_FIELDS_UPDATED_EVENT } from '../utils/leadFields'
import { settingsAPI } from '../api/settings'
import { useFeatureControls } from '../context/FeatureControlsContext'

const dispositionColors: Record<string, { bg: string; text: string }> = {
  New: { bg: '#EFF6FF', text: '#1D4ED8' },
  'Contacted/Open': { bg: '#F0F9FF', text: '#0284C7' },
  Qualified: { bg: '#ECFDF5', text: '#059669' },
  'Visit Done': { bg: '#F5F3FF', text: '#7C3AED' },
  'Meeting Done': { bg: '#FDF4FF', text: '#9333EA' },
  'Negotiation Done': { bg: '#FFFBEB', text: '#D97706' },
  'Booking Done': { bg: '#FFF7ED', text: '#EA580C' },
  'Agreement Done': { bg: '#F0FDF4', text: '#16A34A' },
  Failed: { bg: '#FEF2F2', text: '#DC2626' },
}

const sourceColors: Record<string, string> = {
  Direct: '#F59E0B',
  Manual: '#64748B',
  Meta: '#1877F2',
  Website: '#16A34A',
  'Google ADS': '#EA4335',
}

// Mode-aware storage key: My Leads and Failed Leads share the same component
// but persist their filters separately so picking "RNR" on the failed page
// doesn't bleed into My Leads (and vice versa).
const filtersStorageKey = (mode: LeadListMode) =>
  mode === 'failed' ? 'buildflow:lead-list-filters:failed' : 'buildflow:lead-list-filters'

export type LeadListMode = 'active' | 'failed'

// Curated failed-reason list used both as the LeadDetail dropdown source AND
// the Failed Leads filter options. RNR (Ring No Response) was added so reps
// can extract every unanswered number for re-targeting. The "Looking for…"
// pair captures leads that aren't a fit for BuildFlow's construction service
// because they're after a finished home or a plot instead.
export const FAILED_REASONS = [
  'RNR',
  'Not Responding',
  'Not Interested',
  'Budget Issue',
  'Location Issue',
  'Timeline Issue',
  'Competition',
  'Not Enquired',
  'Invalid Number',
  'Looking for constructed house',
  'Looking for plot',
  'Other',
] as const

type PersistedLeadFilters = {
  city: string[]
  disposition: string[]
  owner: string[]
  paginationMode: 'on' | 'off'
  search: string
  source: string[]
  followUp: string[]
  failedReason: string[]
  dateRange: { from: string | null; to: string | null }
}

// Tolerates both legacy single-string filters (pre-multi-select) and the
// new string[] shape. Stops a stale localStorage entry from blowing up.
const coerceToArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === 'string' && v && v !== 'All')
  if (typeof raw === 'string' && raw && raw !== 'All') return [raw]
  return []
}

// Module-level snapshot — survives unmount when the user navigates into a lead
// detail page so we can restore scroll position + already-loaded leads when
// they come back. Persisted to sessionStorage (per-mode) so it survives HMR,
// hard refreshes, and React.StrictMode's dev-only double-mount that used to
// nuke the previous module-level cache on the second mount.
type LeadListNavigationSnapshot = {
  signature: string
  paginationMode: 'on' | 'off'
  paginatedLeads: Lead[]
  pagination: { page: number; total: number; pages: number }
  infiniteLeads: Lead[]
  infinitePage: number
  hasMore: boolean
  innerScrollTop: number
  mainScrollTop: number
  windowScrollY: number
  /** Wall-clock when the snapshot was last touched. Used to expire stale ones. */
  ts: number
}

const SNAPSHOT_TTL_MS = 30 * 60 * 1000 // 30 minutes — long enough for a quick detour, short enough that re-opening the app a day later starts clean
const snapshotKey = (mode: LeadListMode) =>
  mode === 'failed' ? 'buildflow:lead-list-snapshot:failed' : 'buildflow:lead-list-snapshot'

const readLeadListSnapshot = (mode: LeadListMode): LeadListNavigationSnapshot | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(snapshotKey(mode))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LeadListNavigationSnapshot
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > SNAPSHOT_TTL_MS) {
      window.sessionStorage.removeItem(snapshotKey(mode))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeLeadListSnapshot = (mode: LeadListMode, snapshot: LeadListNavigationSnapshot) => {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(snapshotKey(mode), JSON.stringify(snapshot))
  } catch {
    // QuotaExceeded etc — silently drop, scroll restoration is non-critical.
  }
}

const clearLeadListSnapshot = (mode: LeadListMode) => {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(snapshotKey(mode)) } catch { /* ignore */ }
}

// The actual scroll container can be either the inner table wrapper or the
// outer <main> element from Layout.tsx (depending on viewport / sticky banner
// state). Walk up from the inner ref to find the closest <main>.
const findMainAncestor = (start: HTMLElement | null): HTMLElement | null => {
  let current = start?.parentElement || null
  while (current) {
    if (current.tagName === 'MAIN') return current
    current = current.parentElement
  }
  return null
}

const emptyPersistedFilters = (): PersistedLeadFilters => ({
  city: [],
  disposition: [],
  owner: [],
  paginationMode: 'on',
  search: '',
  source: [],
  followUp: [],
  failedReason: [],
  dateRange: { from: null, to: null },
})

const readPersistedLeadFilters = (mode: LeadListMode): PersistedLeadFilters => {
  if (typeof window === 'undefined') return emptyPersistedFilters()

  try {
    const rawValue = window.localStorage.getItem(filtersStorageKey(mode))
    if (!rawValue) return emptyPersistedFilters()

    const parsed = JSON.parse(rawValue) as Partial<PersistedLeadFilters & {
      // Legacy single-string fields kept here only so coerceToArray sees them
      // when migrating an old localStorage entry.
      city?: unknown; disposition?: unknown; owner?: unknown; source?: unknown
      followUp?: unknown; failedReason?: unknown
    }>
    return {
      city: coerceToArray(parsed.city),
      disposition: coerceToArray(parsed.disposition),
      owner: coerceToArray(parsed.owner),
      paginationMode: parsed.paginationMode === 'off' ? 'off' : 'on',
      search: typeof parsed.search === 'string' ? parsed.search : '',
      source: coerceToArray(parsed.source),
      followUp: coerceToArray(parsed.followUp),
      failedReason: coerceToArray(parsed.failedReason),
      dateRange: parsed.dateRange || { from: null, to: null },
    }
  } catch {
    return emptyPersistedFilters()
  }
}

interface LeadListProps {
  /**
   * 'active' (default) → My Leads / Leads page; excludes Failed disposition.
   * 'failed'           → Failed Leads page; forces disposition=Failed and
   *                      surfaces the failedReason multi-select instead of
   *                      the disposition picker.
   */
  mode?: LeadListMode
}

export default function LeadList({ mode = 'active' }: LeadListProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const isManager = user?.role === 'manager'
  const canAssignOwner = user?.role === 'manager' || user?.role === 'representative'
  const canEditCreatedAt = user?.role === 'manager' || user?.role === 'representative'
  const isFailedMode = mode === 'failed'
  const [persistedFilters] = useState(() => readPersistedLeadFilters(mode))

  // Consume the navigation snapshot exactly once on mount. We compute the
  // filter signature from the persisted filters (the same source the filter
  // state below initializes from) so we can validate the snapshot synchronously
  // and use it as the seed for `useState` lazy initializers — that way the
  // FIRST render already contains the saved leads, and useLayoutEffect can
  // restore scroll position before the browser paints. This is the only way
  // to avoid a "flash of top of list" on return.
  // Read once on first render. The result is a 2-tuple:
  //  - navSnapshot:        full snapshot when filters still match (lets us
  //                        seed leads + restore scroll synchronously).
  //  - scrollOnlySnapshot: just the saved scroll positions, for the case
  //                        where filters changed between leaving and coming
  //                        back. We can't reuse the cached leads then, but
  //                        we can still nudge the user back to roughly where
  //                        they were once the fresh fetch lands.
  type ScrollOnly = Pick<LeadListNavigationSnapshot, 'innerScrollTop' | 'mainScrollTop' | 'windowScrollY'>
  const [restorePair] = useState<{
    full: LeadListNavigationSnapshot | null
    scrollOnly: ScrollOnly | null
  }>(() => {
    const snap = readLeadListSnapshot(mode)
    if (!snap) return { full: null, scrollOnly: null }
    const expected = JSON.stringify({
      mode,
      search: persistedFilters.search.trim(),
      filterDisposition: [...persistedFilters.disposition].sort(),
      filterSource: [...persistedFilters.source].sort(),
      filterCity: [...persistedFilters.city].sort(),
      filterOwner: [...persistedFilters.owner].sort(),
      filterFollowUp: [...persistedFilters.followUp].sort(),
      filterFailedReason: [...persistedFilters.failedReason].sort(),
      showMyLeadsOnly: false,
      paginationMode: persistedFilters.paginationMode,
      dateFrom: persistedFilters.dateRange.from,
      dateTo: persistedFilters.dateRange.to,
      dateMode: 'updatedAt',
    })
    if (snap.signature === expected) return { full: snap, scrollOnly: null }
    return {
      full: null,
      scrollOnly: {
        innerScrollTop: snap.innerScrollTop,
        mainScrollTop: snap.mainScrollTop,
        windowScrollY: snap.windowScrollY,
      },
    }
  })
  const navSnapshot = restorePair.full
  const scrollOnlySnapshot = restorePair.scrollOnly

  const [leads, setLeads] = useState<Lead[]>(() =>
    navSnapshot && navSnapshot.paginationMode === 'on' ? navSnapshot.paginatedLeads : []
  )
  const [loading, setLoading] = useState(() => !navSnapshot)
  const [ownershipToast, setOwnershipToast] = useState(false)

  const [search, setSearch] = useState(persistedFilters.search)
  // Each filter is an array — empty array == "All". A single value is treated
  // identically to the old single-select behaviour by both the panel and the
  // backend; multiple values are sent as a comma-separated string.
  const [filterDisposition, setFilterDisposition] = useState<string[]>(persistedFilters.disposition)
  const [filterSource, setFilterSource] = useState<string[]>(persistedFilters.source)
  const [filterCity, setFilterCity] = useState<string[]>(persistedFilters.city)
  const [filterOwner, setFilterOwner] = useState<string[]>(persistedFilters.owner)
  // Follow-up filter buckets: 'with', 'without', 'overdue', 'today',
  // 'tomorrow', 'thisweek'. Multi-select OR-combines them server-side.
  // Terminal dispositions (Failed, Booking Done, Agreement Done) are never
  // counted as missing — they don't need ongoing follow-ups.
  const [filterFollowUp, setFilterFollowUp] = useState<string[]>(persistedFilters.followUp)
  // Only used in Failed Leads mode. Multi-select over the curated reasons
  // list (RNR, Not Interested, Budget Issue, …).
  const [filterFailedReason, setFilterFailedReason] = useState<string[]>(persistedFilters.failedReason)
  // Per-bucket counts for the follow-up filter dropdown (shown as inline badges).
  // Refreshed alongside the leads list so the numbers stay in sync with edits.
  const [followUpCounts, setFollowUpCounts] = useState<{
    all: number
    with: number
    without: number
    overdue: number
    today: number
    tomorrow: number
    thisWeek: number
  } | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: persistedFilters.dateRange.from ? new Date(persistedFilters.dateRange.from) : null,
    to: persistedFilters.dateRange.to ? new Date(persistedFilters.dateRange.to) : null,
  })
  const [showManualLead, setShowManualLead] = useState(false)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [representatives, setRepresentatives] = useState<RepresentativePickerOption[]>([])
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
  const [editingCreatedAtLeadId, setEditingCreatedAtLeadId] = useState<string | null>(null)
  const [createdAtDraft, setCreatedAtDraft] = useState('')
  const [createdAtEditorVersion, setCreatedAtEditorVersion] = useState(0)
  const [savingCreatedAtLeadId, setSavingCreatedAtLeadId] = useState<string | null>(null)
  // Which timestamp the date-range filter applies to. The two date columns
  // render independently of this — it only scopes the filter.
  const [dateMode, setDateMode] = useState<'updatedAt' | 'createdAt'>('updatedAt')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pagination, setPagination] = useState(() =>
    navSnapshot ? navSnapshot.pagination : { page: 1, total: 0, pages: 1 }
  )
  const [paginationMode, setPaginationMode] = useState<'on' | 'off'>(persistedFilters.paginationMode)
  const [infiniteLeads, setInfiniteLeads] = useState<Lead[]>(() =>
    navSnapshot && navSnapshot.paginationMode === 'off' ? navSnapshot.infiniteLeads : []
  )
  const [infinitePage, setInfinitePage] = useState(() => (navSnapshot ? navSnapshot.infinitePage : 1))
  const [hasMore, setHasMore] = useState(() => (navSnapshot ? navSnapshot.hasMore : true))
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const leadListRequestVersionRef = useRef(0)
  const featureControls = useFeatureControls()
  const [showMyLeadsOnly, setShowMyLeadsOnly] = useState(false)
  // When true on next render, the auto-fetch effect skips one cycle so the
  // restored leads aren't blown away by a fresh page-1 fetch. Set synchronously
  // when navSnapshot is present so the very first auto-fetch run on mount sees
  // the flag.
  const skipNextAutoFetchRef = useRef(navSnapshot != null)
  // Set true once the layout-effect has restored scroll. Prevents subsequent
  // re-renders (e.g. socket-driven refreshes) from re-applying the stale
  // snapshot scroll target.
  const scrollRestoredRef = useRef(false)

  // Per-user column ordering + visibility, persisted to localStorage so it
  // survives reloads and navigations.
  const [columnConfig, setColumnConfig] = useState<LeadColumnConfig[]>(() => loadLeadColumnConfig())
  const handleColumnConfigChange = (next: LeadColumnConfig[]) => {
    setColumnConfig(next)
    saveLeadColumnConfig(next)
  }
  // Derive visible ordered column keys once per render to simplify the JSX below.
  const visibleColumnKeys = columnConfig.filter((c) => c.visible).map((c) => c.key)
  // The Actions column is shown to everyone — reps see WhatsApp + View, managers see WhatsApp + Delete.
  const effectiveColumnKeys = visibleColumnKeys
  // Total span for empty/loading rows: 1 (checkbox col) + visible columns + 1 (trailing chevron)
  const tableColSpan = 1 + effectiveColumnKeys.length + 1

  const [dispositions, setDispositions] = useState<string[]>([
    'All',
    'New',
    'Contacted/Open',
    'Qualified',
    'Visit Done',
    'Meeting Done',
    'Negotiation Done',
    'Booking Done',
    'Agreement Done',
    'Failed',
  ])
  const [sources, setSources] = useState<string[]>(['All', 'Direct', 'Manual', 'Meta', 'Website', 'Google ADS'])
  const [cities, setCities] = useState<string[]>(['All'])
  const [leadFields, setLeadFields] = useState<LeadFieldConfig[]>([])
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([
    { id: 'All', name: 'All Owners' },
    { id: 'unassigned', name: 'Unassigned' },
  ])

  useEffect(() => {
    fetchFilters()
    if (user) {
      fetchTeam()
      // Silently fix any reps whose "In Call" status was never cleared
      // (e.g. Exotel webhook missed, server restarted mid-call)
      callsAPI.reconcileStatuses().catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const payload: PersistedLeadFilters = {
      city: filterCity,
      disposition: filterDisposition,
      owner: filterOwner,
      paginationMode,
      search,
      source: filterSource,
      followUp: filterFollowUp,
      failedReason: filterFailedReason,
      dateRange: {
        from: dateRange.from ? dateRange.from.toISOString() : null,
        to: dateRange.to ? dateRange.to.toISOString() : null,
      },
    }
    window.localStorage.setItem(filtersStorageKey(mode), JSON.stringify(payload))
  }, [mode, filterCity, filterDisposition, filterOwner, filterSource, filterFollowUp, filterFailedReason, paginationMode, search, dateRange])

  useEffect(() => {
    const handleLeadFieldsUpdated = () => {
      void fetchFilters()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LEAD_FIELDS_STORAGE_KEY) {
        void fetchFilters()
      }
    }

    window.addEventListener(LEAD_FIELDS_UPDATED_EVENT, handleLeadFieldsUpdated as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(LEAD_FIELDS_UPDATED_EVENT, handleLeadFieldsUpdated as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    if (!socket || !connected) return

    const handleAvailabilityUpdate = (payload: any) => {
      setRepresentatives((current) =>
        current.map((member) =>
          String(member.id) === String(payload?.id)
            ? {
                ...member,
                phone: payload?.phone ?? member.phone,
                callAvailabilityStatus: payload?.callAvailabilityStatus ?? member.callAvailabilityStatus,
                activeCallSid: payload?.activeCallSid ?? null,
              }
            : member
        )
      )
    }

    socket.on('user:availability_updated', handleAvailabilityUpdate)

    return () => {
      socket.off('user:availability_updated', handleAvailabilityUpdate)
    }
  }, [socket, connected])

  const buildLeadParams = useCallback(
    (page: number): Record<string, string> => {
      const params: Record<string, string> = { page: String(page), limit: '30' }

      if (search.trim()) params.search = search.trim()
      if (isFailedMode) {
        // Failed Leads view — disposition is locked to Failed regardless of
        // any persisted disposition filter from a different mode.
        params.disposition = 'Failed'
        if (filterFailedReason.length > 0) params.failedReason = filterFailedReason.join(',')
      } else {
        // Active leads view — exclude Failed so a Failed lead never appears
        // here (matches the user-visible promise: same lead is never in both
        // My Leads and Failed Leads).
        params.excludeDispositions = 'Failed'
        if (filterDisposition.length > 0) params.disposition = filterDisposition.join(',')
      }
      if (filterSource.length > 0) params.source = filterSource.join(',')
      if (filterCity.length > 0) params.city = filterCity.join(',')
      if (isManager && filterOwner.length > 0) params.owner = filterOwner.join(',')
      if (filterFollowUp.length > 0) params.followUp = filterFollowUp.join(',')
      // Reps see all leads by default; when "My Leads" mode is on, filter to their own.
      // Overrides any owner filter above (reps don't see the owner picker anyway).
      if (!isManager && showMyLeadsOnly && user?.id) params.owner = user.id

      if (dateRange.from) {
        const fromDate = new Date(dateRange.from)
        fromDate.setHours(0, 0, 0, 0)
        params.dateFrom = fromDate.toISOString()
      }

      if (dateRange.to) {
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        params.dateTo = toDate.toISOString()
      }

      // Tell the backend which timestamp the date range applies to. The UI
      // toggle (Last Edit vs Created At) shifts the column shown AND the
      // filter field — without this the backend always filters by createdAt
      // even when the user expects "edited within range".
      if (dateRange.from || dateRange.to) {
        params.dateField = dateMode
      }

      return params
    },
    [isFailedMode, search, filterDisposition, filterSource, filterCity, isManager, filterOwner, filterFollowUp, filterFailedReason, dateRange, dateMode, showMyLeadsOnly, user?.id]
  )

  // Stable string identity for the current filter set. Used to validate the
  // navigation snapshot so we never restore stale leads when filters changed
  // between leaving and returning to the page.
  const filtersSignature = useMemo(
    () =>
      JSON.stringify({
        mode,
        search: search.trim(),
        // Sort the array filters so [A,B] and [B,A] produce the same signature
        // (selection order doesn't change the result set).
        filterDisposition: [...filterDisposition].sort(),
        filterSource: [...filterSource].sort(),
        filterCity: [...filterCity].sort(),
        filterOwner: [...filterOwner].sort(),
        filterFollowUp: [...filterFollowUp].sort(),
        filterFailedReason: [...filterFailedReason].sort(),
        showMyLeadsOnly,
        paginationMode,
        dateFrom: dateRange.from ? dateRange.from.toISOString() : null,
        dateTo: dateRange.to ? dateRange.to.toISOString() : null,
        dateMode,
      }),
    [mode, search, filterDisposition, filterSource, filterCity, filterOwner, filterFollowUp, filterFailedReason, showMyLeadsOnly, paginationMode, dateRange, dateMode]
  )

  // Restore scroll position on the very first commit, before paint. Because
  // leads are seeded into state via lazy initializers above, the first render
  // already contains the table rows — so the scroll container has its full
  // scrollHeight by the time this layout-effect fires. We set scrollTop on
  // every plausible candidate (inner table div, <main>, window) so whichever
  // element is actually scrolling lands at the right spot. Non-scrolling
  // elements clamp to 0 and are no-ops.
  useLayoutEffect(() => {
    if (scrollRestoredRef.current) return
    if (!navSnapshot) return
    const container = scrollContainerRef.current
    if (!container) return
    const visibleCount = navSnapshot.paginationMode === 'on'
      ? navSnapshot.paginatedLeads.length
      : navSnapshot.infiniteLeads.length
    if (visibleCount === 0) {
      scrollRestoredRef.current = true
      return
    }
    const mainEl = findMainAncestor(container)
    const apply = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = navSnapshot.innerScrollTop
      }
      if (mainEl) mainEl.scrollTop = navSnapshot.mainScrollTop
      if (navSnapshot.windowScrollY > 0) window.scrollTo(0, navSnapshot.windowScrollY)
    }
    apply()
    // Reapply across the next two frames in case any late layout pass (web
    // fonts loading, image dimensions resolving, etc.) shifts content height.
    requestAnimationFrame(apply)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      apply()
      scrollRestoredRef.current = true
    }))
  }, [navSnapshot])

  // Best-effort fallback: filters changed between leaving and coming back so
  // we couldn't reuse the cached leads, but we still have the saved scroll
  // position. Apply it once the fresh fetch lands. We watch `loading` going
  // false and the leads array having content as the signal that the page is
  // ready to be scrolled.
  useEffect(() => {
    if (scrollRestoredRef.current) return
    if (!scrollOnlySnapshot) return
    if (loading) return
    const visibleCount = paginationMode === 'on' ? leads.length : infiniteLeads.length
    if (visibleCount === 0) {
      scrollRestoredRef.current = true
      return
    }
    const container = scrollContainerRef.current
    if (!container) return
    const mainEl = findMainAncestor(container)
    const apply = () => {
      const inner = scrollContainerRef.current
      if (inner) {
        inner.scrollTop = Math.min(scrollOnlySnapshot.innerScrollTop, inner.scrollHeight - inner.clientHeight)
      }
      if (mainEl) {
        mainEl.scrollTop = Math.min(scrollOnlySnapshot.mainScrollTop, mainEl.scrollHeight - mainEl.clientHeight)
      }
      if (scrollOnlySnapshot.windowScrollY > 0) {
        window.scrollTo(0, scrollOnlySnapshot.windowScrollY)
      }
    }
    apply()
    requestAnimationFrame(apply)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      apply()
      scrollRestoredRef.current = true
    }))
  }, [scrollOnlySnapshot, loading, leads, infiniteLeads, paginationMode])

  // Whenever leads land or the filter set changes, lay down a base snapshot
  // so the scroll listener has something to update. Also keeps the snapshot
  // signature in sync so coming back finds a valid match.
  useEffect(() => {
    if (loading) return
    const visibleCount = paginationMode === 'on' ? leads.length : infiniteLeads.length
    if (visibleCount === 0) return
    const inner = scrollContainerRef.current
    const mainEl = findMainAncestor(inner)
    writeLeadListSnapshot(mode, {
      signature: filtersSignature,
      paginationMode,
      paginatedLeads: leads,
      pagination,
      infiniteLeads,
      infinitePage,
      hasMore,
      innerScrollTop: inner?.scrollTop ?? 0,
      mainScrollTop: mainEl?.scrollTop ?? 0,
      windowScrollY: typeof window !== 'undefined' ? window.scrollY : 0,
      ts: Date.now(),
    })
  }, [mode, filtersSignature, paginationMode, leads, pagination, infiniteLeads, infinitePage, hasMore, loading])

  // Continuously refresh the snapshot's scroll position on every scroll event
  // (rAF-throttled). Without this the saved scroll would only update when the
  // user clicks through navigateToLead — so navigating away via a sidebar
  // link, browser forward/back, or any other route change would persist a
  // stale position.
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    let rafPending = false
    const onScroll = () => {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        const inner = scrollContainerRef.current
        if (!inner) return
        const mainEl = findMainAncestor(inner)
        const existing = readLeadListSnapshot(mode)
        if (!existing) return
        writeLeadListSnapshot(mode, {
          ...existing,
          innerScrollTop: inner.scrollTop,
          mainScrollTop: mainEl?.scrollTop ?? 0,
          windowScrollY: window.scrollY,
          ts: Date.now(),
        })
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
    // Re-bind whenever a fresh container mounts (e.g. on filter-driven
    // re-renders that swap the scroll container) so we keep tracking.
  }, [mode, leads, infiniteLeads])

  // Wrap navigation into a lead detail so we always capture the snapshot
  // (scroll position + already-loaded leads) before unmounting.
  const navigateToLead = useCallback(
    (leadId: string) => {
      const inner = scrollContainerRef.current
      const mainEl = findMainAncestor(inner)
      writeLeadListSnapshot(mode, {
        signature: filtersSignature,
        paginationMode,
        paginatedLeads: leads,
        pagination,
        infiniteLeads,
        infinitePage,
        hasMore,
        innerScrollTop: inner?.scrollTop ?? 0,
        mainScrollTop: mainEl?.scrollTop ?? 0,
        windowScrollY: typeof window !== 'undefined' ? window.scrollY : 0,
        ts: Date.now(),
      })
      // Pass the current path through router state so the LeadDetail back
      // button can return to /leads/failed when the user came from there
      // (instead of dumping them onto My Leads, where the lead they just
      // closed wouldn't even be visible because Failed leads are excluded).
      // Also mirror it into sessionStorage so a hard-refresh of the detail
      // page doesn't lose the source — router state evaporates on reload.
      try { window.sessionStorage.setItem('buildflow:lead-detail-source', location.pathname) } catch { /* ignore */ }
      navigate(`/leads/${leadId}`, { state: { from: location.pathname } })
    },
    [mode, filtersSignature, paginationMode, leads, pagination, infiniteLeads, infinitePage, hasMore, navigate, location.pathname]
  )

  const fetchLeads = useCallback(
    async (page: number, isBackgroundRefresh = false) => {
      const requestVersion = ++leadListRequestVersionRef.current

      try {
        if (!isBackgroundRefresh) {
          setLoading(true)
        }

        const response = await leadsAPI.getLeads(buildLeadParams(page))
        if (!response.success || requestVersion !== leadListRequestVersionRef.current) return

        setLeads(response.data)
        setSelectedLeadIds((current) =>
          current.filter((leadId) => response.data.some((lead) => lead._id === leadId))
        )
        setPagination({
          page: response.pagination.page,
          total: response.pagination.total,
          pages: response.pagination.pages,
        })
      } catch (error) {
        console.error('Failed to fetch leads:', error)
      } finally {
        if (requestVersion === leadListRequestVersionRef.current) {
          setLoading(false)
        }
      }
    },
    [buildLeadParams]
  )

  const initInfiniteScroll = useCallback(async () => {
    const requestVersion = ++leadListRequestVersionRef.current

    try {
      setLoading(true)
      setLoadingMore(false)
      const response = await leadsAPI.getLeads(buildLeadParams(1))
      if (!response.success || requestVersion !== leadListRequestVersionRef.current) return

      setInfiniteLeads(response.data)
      setInfinitePage(1)
      setHasMore(response.pagination.page < response.pagination.pages)
      setSelectedLeadIds((current) =>
        current.filter((leadId) => response.data.some((lead) => lead._id === leadId))
      )
      setPagination({
        page: 1,
        total: response.pagination.total,
        pages: response.pagination.pages,
      })
    } catch (error) {
      console.error('Failed to init infinite scroll:', error)
    } finally {
      if (requestVersion === leadListRequestVersionRef.current) {
        setLoading(false)
      }
    }
  }, [buildLeadParams])

  const loadMoreLeads = useCallback(async () => {
    if (loadingMore || !hasMore) return

    const requestVersion = leadListRequestVersionRef.current

    try {
      setLoadingMore(true)
      const nextPage = infinitePage + 1
      const response = await leadsAPI.getLeads(buildLeadParams(nextPage))
      if (!response.success || requestVersion !== leadListRequestVersionRef.current) return

      if (response.data.length === 0) {
        setHasMore(false)
        return
      }

      setInfiniteLeads((current) => {
        const existingIds = new Set(current.map((lead) => lead._id))
        const nextLeads = response.data.filter((lead) => !existingIds.has(lead._id))
        return [...current, ...nextLeads]
      })
      setInfinitePage(nextPage)
      setHasMore(response.pagination.page < response.pagination.pages)
      setPagination({
        page: response.pagination.page,
        total: response.pagination.total,
        pages: response.pagination.pages,
      })
    } catch (error) {
      console.error('Failed to load more leads:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, infinitePage, buildLeadParams])

  useEffect(() => {
    if (!socket || !connected) return

    const handleLeadRefresh = () => {
      if (paginationMode === 'on') {
        void fetchLeads(pagination.page, true)
      } else {
        void initInfiniteScroll()
      }
      void fetchFilters()
    }

    socket.on('lead:incoming', handleLeadRefresh)
    socket.on('lead:assigned', handleLeadRefresh)
    socket.on('lead:deleted', handleLeadRefresh)

    return () => {
      socket.off('lead:incoming', handleLeadRefresh)
      socket.off('lead:assigned', handleLeadRefresh)
      socket.off('lead:deleted', handleLeadRefresh)
    }
  }, [socket, connected, pagination.page, paginationMode, fetchLeads, initInfiniteScroll])

  const handleScroll = useCallback(() => {
    if (paginationMode !== 'off' || !scrollContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      void loadMoreLeads()
    }
  }, [paginationMode, loadMoreLeads])

  useEffect(() => {
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false
      return
    }
    if (paginationMode === 'on') {
      void fetchLeads(1)
    } else {
      void initInfiniteScroll()
    }
  }, [paginationMode, fetchLeads, initInfiniteScroll])

  // Keep the follow-up bucket counts in sync with any filter / search change
  // that could alter which leads are visible. Scopes by the currently-selected
  // Owner filter when set (so a manager drilling into specific reps sees only
  // their counts). Multi-select uses the same comma-joined format the
  // backend now understands.
  useEffect(() => {
    const ownerScope = isManager && filterOwner.length > 0 ? filterOwner.join(',') : undefined
    leadsAPI
      .getFollowUpCounts(ownerScope)
      .then((res) => {
        if (res.success) setFollowUpCounts(res.data)
      })
      .catch((err) => console.error('follow-up counts fetch failed', err))
  }, [isManager, filterOwner, filterDisposition, filterSource, filterCity, filterFollowUp, search, dateRange])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || paginationMode !== 'off') return

    const onScroll = () => handleScroll()
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [paginationMode, handleScroll])

  const fetchFilters = async () => {
    try {
      const res = await leadsAPI.getLeadFilters()
      if (res.success) {
        setDispositions(['All', ...res.data.dispositions])
        setSources(['All', ...res.data.sources])
        setCities(['All', ...res.data.cities])
        setLeadFields(res.data.leadFields?.fields || [])
        setOwners([
          { id: 'All', name: 'All Owners' },
          { id: 'unassigned', name: 'Unassigned' },
          ...res.data.owners,
        ])
      }
    } catch (err) {
      console.error('Failed to fetch filters:', err)
    }
  }

  const fetchTeam = async () => {
    try {
      const res = await teamAPI.getTeamMembers()
      if (res.success) {
        setRepresentatives(
          res.data
            .filter((member) => member.role === 'representative' && member.isActive)
            .map((member) => ({
              id: member.id,
              name: member.name,
              phone: member.phone,
              callAvailabilityStatus: member.callAvailabilityStatus,
              activeCallSid: member.activeCallSid,
            }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err)
    }
  }

  // Per-lead ownership: true if manager OR the current rep owns that lead
  const isLeadOwnerOfRow = (lead: Lead) =>
    isManager || (Boolean(lead.owner) && String(lead.owner) === String(user?.id))

  const showOwnershipError = () => {
    setOwnershipToast(true)
    setTimeout(() => setOwnershipToast(false), 3500)
  }

  const handleAssignLead = async (leadId: string, userId: string | null) => {
    const targetLead = leads.find((l) => l._id === leadId)
    if (targetLead && !isLeadOwnerOfRow(targetLead)) {
      showOwnershipError()
      return
    }
    try {
      setAssigningLeadId(leadId)
      const response = await leadsAPI.assignLead(leadId, userId)
      if (!response.success) return

      if (paginationMode === 'on') {
        await fetchLeads(pagination.page)
      } else {
        await initInfiniteScroll()
      }
    } catch (error) {
      console.error('Failed to assign lead:', error)
    } finally {
      setAssigningLeadId(null)
    }
  }

  const syncLeadInLists = (updatedLead: Lead) => {
    setLeads((current) =>
      current.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead))
    )
    setInfiniteLeads((current) =>
      current.map((lead) => (lead._id === updatedLead._id ? updatedLead : lead))
    )
  }

  const startEditingCreatedAt = (lead: Lead) => {
    setEditingCreatedAtLeadId(lead._id)
    setCreatedAtDraft(formatDateTimeLocalInput(lead.createdAt))
  }

  const cancelEditingCreatedAt = () => {
    setEditingCreatedAtLeadId(null)
    setCreatedAtDraft('')
  }

  const handleSaveCreatedAt = async (lead: Lead) => {
    if (!createdAtDraft.trim()) {
      cancelEditingCreatedAt()
      return
    }

    const nextCreatedAt = new Date(createdAtDraft)
    if (Number.isNaN(nextCreatedAt.getTime())) {
      return
    }

    try {
      setSavingCreatedAtLeadId(lead._id)
      const response = await leadsAPI.updateLead(lead._id, {
        createdAt: nextCreatedAt.toISOString(),
      })
      if (!response.success) return

      syncLeadInLists(response.data)
      setCreatedAtDraft(formatDateTimeLocalInput(response.data.createdAt))
      setCreatedAtEditorVersion((v) => v + 1)
      cancelEditingCreatedAt()
    } catch (error) {
      console.error('Failed to update lead created at:', error)
    } finally {
      setSavingCreatedAtLeadId(null)
    }
  }

  const visibleLeads = paginationMode === 'on' ? leads : infiniteLeads
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every((lead) => selectedLeadIds.includes(lead._id))

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    )
  }

  const toggleSelectAllVisible = () => {
    setSelectedLeadIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleLeads.some((lead) => lead._id === id))
      }

      return [...new Set([...current, ...visibleLeads.map((lead) => lead._id)])]
    })
  }

  const hasFilters =
    Boolean(search.trim()) ||
    (!isFailedMode && filterDisposition.length > 0) ||
    (isFailedMode && filterFailedReason.length > 0) ||
    filterSource.length > 0 ||
    filterCity.length > 0 ||
    filterFollowUp.length > 0 ||
    (isManager && filterOwner.length > 0) ||
    (!isManager && showMyLeadsOnly) ||
    Boolean(dateRange.from || dateRange.to)

  const clearFilters = () => {
    setFilterDisposition([])
    setFilterSource([])
    setFilterCity([])
    setFilterOwner([])
    setFilterFollowUp([])
    setFilterFailedReason([])
    setSearch('')
    setDateRange({ from: null, to: null })
    if (!isManager) setShowMyLeadsOnly(false)
    // Wipe the cached scroll snapshot — its leads cache is now invalid and we
    // want the user to land at the top of the freshly-filtered list anyway.
    clearLeadListSnapshot(mode)
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await Promise.all([
        paginationMode === 'on' ? fetchLeads(pagination.page, true) : initInfiniteScroll(),
        fetchFilters(),
        user ? fetchTeam() : Promise.resolve(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  const handleDeleteLead = async (lead: Lead) => {
    const confirmed = window.confirm(`Delete lead "${lead.name}"? This will also remove related reminders, queue items, and call history.`)
    if (!confirmed) return

    try {
      setDeletingLeadId(lead._id)
      await leadsAPI.deleteLead(lead._id)
      setSelectedLeadIds((current) => current.filter((id) => id !== lead._id))
    } catch (error) {
      console.error('Failed to delete lead:', error)
    } finally {
      setDeletingLeadId(null)
      // Always refetch to sync UI with actual DB state, regardless of success or failure
      const nextPage = leads.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page
      if (paginationMode === 'on') {
        await fetchLeads(nextPage)
      } else {
        await initInfiniteScroll()
      }
      await fetchFilters()
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedLeadIds.length) return

    const confirmed = window.confirm(
      `Delete ${selectedLeadIds.length} selected lead${selectedLeadIds.length > 1 ? 's' : ''}? This will also remove related reminders, queue items, and call history.`
    )
    if (!confirmed) return

    try {
      setBulkDeleting(true)
      await leadsAPI.bulkDeleteLeads(selectedLeadIds)
      setSelectedLeadIds([])
    } catch (error) {
      console.error('Failed to bulk delete leads:', error)
    } finally {
      setBulkDeleting(false)
      // Always refetch to sync UI with actual DB state, regardless of success or failure
      const nextPage = selectedLeadIds.length === leads.length && pagination.page > 1 ? pagination.page - 1 : pagination.page
      if (paginationMode === 'on') {
        await fetchLeads(nextPage)
      } else {
        await initInfiniteScroll()
      }
      await fetchFilters()
    }
  }

  const handleBulkUpdate = async (payload: { disposition?: string; owner?: string | null; source?: string; statusNote?: string }) => {
    try {
      setBulkUpdating(true)
      const response = await leadsAPI.bulkUpdateLeads({
        ids: selectedLeadIds,
        ...payload,
      })
      if (!response.success) return

      setShowBulkEditModal(false)
      setSelectedLeadIds([])
      if (paginationMode === 'on') {
        await fetchLeads(pagination.page)
      } else {
        await initInfiniteScroll()
      }
      await fetchFilters()
    } catch (error) {
      console.error('Failed to bulk update leads:', error)
      throw error
    } finally {
      setBulkUpdating(false)
    }
  }

  const dispositionOptions: FancyDropdownOption[] = dispositions.map((disposition) => ({
    value: disposition,
    label: disposition === 'All' ? 'All Dispositions' : disposition,
    dotColor: disposition !== 'All' ? dispositionColors[disposition]?.text : undefined,
  }))

  const sourceOptions: FancyDropdownOption[] = sources.map((source) => ({
    value: source,
    label: source === 'All' ? 'All Sources' : source,
    dotColor: source !== 'All' ? sourceColors[source] : undefined,
  }))

  const cityOptions: FancyDropdownOption[] = cities.map((city) => ({
    value: city,
    label: city === 'All' ? 'All Cities' : city,
    description: city === 'All' ? 'Show every city' : 'Filter leads by city',
  }))

  // Helper: append count to the option label when we have counts loaded.
  // We render them as "Today (12)" so the manager can see at a glance
  // how many leads are in each bucket before clicking to filter.
  const followUpLabel = (base: string, count: number | undefined) =>
    typeof count === 'number' ? `${base} (${count})` : base

  const followUpOptions: FancyDropdownOption[] = [
    {
      value: 'All',
      label: followUpLabel('All Follow-ups', followUpCounts?.with),
      description: 'Show every lead',
    },
    {
      value: 'today',
      label: followUpLabel('Today', followUpCounts?.today),
      description: 'Follow-ups scheduled for today',
      dotColor: '#2563EB',
    },
    {
      value: 'tomorrow',
      label: followUpLabel('Tomorrow', followUpCounts?.tomorrow),
      description: 'Scheduled for tomorrow',
      dotColor: '#7C3AED',
    },
    {
      value: 'thisWeek',
      label: followUpLabel('This Week', followUpCounts?.thisWeek),
      description: 'Scheduled within the next 7 days',
      dotColor: '#0EA5E9',
    },
    {
      value: 'overdue',
      label: followUpLabel('Ignored', followUpCounts?.overdue),
      description: 'Follow-up date has already passed',
      dotColor: '#F59E0B',
    },
    {
      value: 'without',
      label: followUpLabel('Missing (NA)', followUpCounts?.without),
      description: 'Active leads with no follow-up date set',
      dotColor: '#DC2626',
    },
    {
      value: 'with',
      label: followUpLabel('Has Follow-up', followUpCounts?.with),
      description: 'Every lead with a scheduled follow-up',
      dotColor: '#16A34A',
    },
  ]

  const ownerOptions: FancyDropdownOption[] = owners.map((owner) => {
    const representative = representatives.find((member) => member.id === owner.id)
    let badgeLabel: string | undefined
    let badgeBg: string | undefined
    let badgeText: string | undefined

    if (owner.id === 'unassigned') {
      badgeLabel = 'Pool'
      badgeBg = '#FFF7ED'
      badgeText = '#C2410C'
    } else if (representative) {
      if (representative.callAvailabilityStatus === 'offline') {
        badgeLabel = 'Offline'
        badgeBg = '#F8FAFC'
        badgeText = '#64748B'
      } else if (representative.callAvailabilityStatus === 'in-call') {
        badgeLabel = 'In Call'
        badgeBg = '#EFF6FF'
        badgeText = '#1D4ED8'
      } else if (representative.activeCallSid) {
        badgeLabel = 'Dialing'
        badgeBg = '#FFFBEB'
        badgeText = '#B45309'
      } else {
        badgeLabel = 'Available'
        badgeBg = '#F0FDF4'
        badgeText = '#15803D'
      }
    }

    return {
      value: owner.id,
      label: owner.name,
      description:
        owner.id === 'All'
          ? 'Show every representative'
          : owner.id === 'unassigned'
            ? 'Leads waiting for manager assignment'
            : representative?.phone || 'Representative lead owner',
      dotColor:
        owner.id === 'All'
          ? undefined
          : owner.id === 'unassigned'
            ? '#F59E0B'
            : representative?.callAvailabilityStatus === 'offline'
              ? '#94A3B8'
              : representative?.callAvailabilityStatus === 'in-call'
                ? '#2563EB'
                : representative?.activeCallSid
                  ? '#D97706'
                  : '#16A34A',
      badgeLabel,
      badgeBg,
      badgeText,
    }
  })

  // ── Column-driven table rendering ────────────────────────────────────────
  // Each visible column's header (<th>) and per-row cell (<td>) are produced
  // by these two helpers. The order + visibility come from columnConfig, which
  // the user can customize via the LeadColumnManager popover above the table.
  const renderColumnHeader = (key: LeadColumnKey) => {
    if (key === 'createdAt' || key === 'updatedAt') {
      const Icon = key === 'createdAt' ? CalendarDays : Clock
      const label = key === 'createdAt' ? 'Created' : 'Last Edit'
      const isDateFilterTarget = dateMode === key && (dateRange.from || dateRange.to)
      return (
        <th key={key} className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Icon size={10} className={isDateFilterTarget ? 'text-[#1D4ED8]' : 'opacity-60'} />
            <span className={isDateFilterTarget ? 'text-[#1D4ED8]' : ''}>{label}</span>
            {/* Visual cue when this column is the one the date-range filter
                is currently scoping. Click to swap which timestamp the
                filter applies to without leaving the table. */}
            {(dateRange.from || dateRange.to) ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDateMode(key) }}
                title={isDateFilterTarget ? 'Date filter applies to this column' : `Filter date range by ${label}`}
                className={`ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors ${
                  isDateFilterTarget
                    ? 'bg-[#1D4ED8] text-white'
                    : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]'
                }`}
              >
                <span className="text-[7px] font-extrabold leading-none">
                  {isDateFilterTarget ? '•' : '+'}
                </span>
              </button>
            ) : null}
            <ArrowUpDown size={10} className="opacity-50 ml-auto" />
          </div>
        </th>
      )
    }
    return (
      <th key={key} className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
        {key === 'actions' ? (
          'Actions'
        ) : (
          <div className="flex items-center gap-1">
            {LEAD_COLUMN_LABELS[key]} <ArrowUpDown size={10} className="opacity-50" />
          </div>
        )}
      </th>
    )
  }

  const renderColumnCell = (key: LeadColumnKey, lead: Lead, dc: { bg: string; text: string }) => {
    switch (key) {
      case 'lead':
        return (
          <td key={key} className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#1D4ED8] text-[10px] font-bold shrink-0">
                {lead.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate max-w-[130px]">{lead.name}</p>
                <p className="text-[10px] text-[#94A3B8]">{lead.phone}</p>
              </div>
            </div>
          </td>
        )
      case 'source':
        return (
          <td key={key} className="px-3 py-2.5">
            <span className="text-[11px] font-semibold" style={{ color: sourceColors[lead.source] || '#94A3B8' }}>
              {lead.source}
            </span>
          </td>
        )
      case 'city':
        return (
          <td key={key} className="px-3 py-2.5">
            <div className="flex items-center gap-1">
              <MapPin size={10} className="text-[#94A3B8]" />
              <span className="text-[11px] text-[#475569]">{lead.city}</span>
            </div>
          </td>
        )
      case 'owner':
        return (
          <td key={key} className="px-3 py-2.5">
            {isLeadOwnerOfRow(lead) ? (
              <div onClick={(event) => event.stopPropagation()}>
                <RepresentativePicker
                  value={lead.owner ? String(lead.owner) : null}
                  onChange={(nextValue) => { handleAssignLead(lead._id, nextValue) }}
                  options={representatives}
                  allowUnassigned={isManager}
                  disabled={assigningLeadId === lead._id}
                  compact
                />
              </div>
            ) : (
              <div
                onClick={(e) => { e.stopPropagation(); showOwnershipError() }}
                className="flex items-center gap-1.5 cursor-not-allowed group"
                title="Only the lead owner can transfer this lead"
              >
                <div className="w-6 h-6 rounded-md bg-[#E2E8F0] flex items-center justify-center text-[#475569] text-[9px] font-bold shrink-0">
                  {lead.ownerName ? lead.ownerName.split(' ').map((p) => p[0]).join('') : '?'}
                </div>
                <span className="text-[11px] font-medium text-[#475569] truncate max-w-[80px]">
                  {lead.ownerName || 'Unassigned'}
                </span>
                <svg className="w-3 h-3 text-[#CBD5E1] shrink-0 group-hover:text-[#F59E0B] transition-colors" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </td>
        )
      case 'disposition':
        return (
          <td key={key} className="px-3 py-2.5">
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: dc.bg, color: dc.text }}
            >
              {lead.disposition}
            </span>
          </td>
        )
      case 'followup': {
        const isTerminal =
          lead.disposition === 'Failed' ||
          lead.disposition === 'Booking Done' ||
          lead.disposition === 'Agreement Done'
        return (
          <td key={key} className="px-3 py-2.5">
            {lead.nextFollowUp ? (() => {
              const d = new Date(lead.nextFollowUp)
              const isOverdue = d.getTime() < Date.now()
              return (
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold whitespace-nowrap ${isOverdue ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
                    {d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-[9px] text-[#94A3B8] whitespace-nowrap">
                    {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    {isOverdue && <span className="ml-1.5 font-bold text-[#DC2626]">Ignored</span>}
                  </span>
                </div>
              )
            })() : isTerminal ? (
              <span className="text-[10px] text-[#CBD5E1]" title="Terminal stage — no follow-up required">—</span>
            ) : (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
                title="No follow-up date set"
              >
                NA
              </span>
            )}
          </td>
        )
      }
      case 'createdAt':
        return (
          <td key={key} className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
            {editingCreatedAtLeadId === lead._id ? (
              <div
                className="space-y-2 min-w-[280px] max-w-[320px]"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); void handleSaveCreatedAt(lead) }
                  if (event.key === 'Escape') { event.preventDefault(); cancelEditingCreatedAt() }
                }}
              >
                <CreatedAtEditor
                  key={`${lead._id}-${createdAtEditorVersion}`}
                  compact
                  value={createdAtDraft}
                  onChange={setCreatedAtDraft}
                  helperText="Adjust the local date, time, and year."
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleSaveCreatedAt(lead)}
                    disabled={savingCreatedAtLeadId === lead._id || createdAtDraft === formatDateTimeLocalInput(lead.createdAt)}
                    className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-[10px] font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingCreatedAtLeadId === lead._id ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingCreatedAt}
                    disabled={savingCreatedAtLeadId === lead._id}
                    className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] text-[10px] font-bold hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-[#475569] whitespace-nowrap">
                    {new Date(lead.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-[9px] text-[#94A3B8] whitespace-nowrap">
                    {new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                {canEditCreatedAt ? (
                  <button
                    type="button"
                    onClick={() => startEditingCreatedAt(lead)}
                    className="w-fit px-2 py-1 rounded-md border border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8] text-[9px] font-bold hover:bg-[#DBEAFE] transition-colors"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            )}
          </td>
        )
      case 'updatedAt':
        return (
          <td key={key} className="px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-[#475569] whitespace-nowrap">
                {new Date(lead.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-[9px] text-[#94A3B8] whitespace-nowrap">
                {new Date(lead.updatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </td>
        )
      case 'actions':
        return (
          <td key={key} className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openWhatsAppChat(lead.phone)}
                disabled={!sanitizePhoneForWhatsApp(lead.phone)}
                title={`Open WhatsApp chat with ${lead.name}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <WhatsAppIcon size={12} />
              </button>
              {isManager ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteLead(lead)}
                  disabled={deletingLeadId === lead._id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-[10px] font-bold hover:bg-[#FEE2E2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 size={11} />
                  {deletingLeadId === lead._id ? '…' : 'Delete'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToLead(lead._id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold hover:bg-[#DBEAFE] transition-colors"
                >
                  View
                </button>
              )}
            </div>
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col">
      {/* Ownership toast — shown when a non-owner rep tries to transfer a lead */}
      {ownershipToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#1E293B] text-white shadow-2xl animate-fade-in">
          <div className="w-6 h-6 rounded-full bg-[#F59E0B] flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold">You can't transfer this lead</p>
            <p className="text-xs text-[#94A3B8]">Only the lead owner or a manager can transfer leads.</p>
          </div>
        </div>
      )}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              {isFailedMode ? (
                <>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                    <X size={11} strokeWidth={3} />
                  </span>
                  Failed Leads
                </>
              ) : (
                'Leads'
              )}
            </h1>
            <p className="text-xs text-[#475569] mt-0.5">
              {pagination.total} {isFailedMode ? 'failed leads' : 'leads'}
              {isManager && filterOwner.length === 1 && filterOwner[0] === 'unassigned' ? ' awaiting assignment' : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Pagination Mode Toggle */}
            <button
              onClick={() => setPaginationMode(paginationMode === 'on' ? 'off' : 'on')}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors shadow-sm ${
                paginationMode === 'on'
                  ? 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                  : 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'
              }`}
              title={paginationMode === 'on' ? 'Pagination: ON - Click to switch to infinite scroll' : 'Pagination: OFF (Infinite Scroll) - Click to switch to pagination'}
            >
              {paginationMode === 'on' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {paginationMode === 'on' ? 'Pagination: On' : 'Pagination: Off'}
            </button>

            {/* Refresh — action button, soft blue ghost style */}
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] hover:border-[#93C5FD] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {/* Column manager — drag to reorder, eye toggle to show/hide */}
            <LeadColumnManager value={columnConfig} onChange={handleColumnConfigChange} />

            {paginationMode === 'on' && (
              /* Pagination — dark segmented control, visually distinct from action buttons */
              <div className="flex items-center gap-0 bg-[#0F172A] rounded-lg p-0.5 shadow-[0_1px_3px_rgba(15,23,42,0.2)]">
                <button
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchLeads(pagination.page - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} strokeWidth={2.5} />
                </button>
                <div className="mx-0.5 px-2.5 h-7 flex items-center justify-center bg-white rounded-md text-[11px] font-bold text-[#0F172A] whitespace-nowrap min-w-[48px]">
                  {pagination.page}<span className="mx-1 text-[#94A3B8]">/</span>{pagination.pages}
                </div>
                <button
                  disabled={pagination.page >= pagination.pages || loading}
                  onClick={() => fetchLeads(pagination.page + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Next page"
                >
                  <ChevronRight size={14} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {selectedLeadIds.length ? (
              <>
                {featureControls.bulkEdit && (
                  <button
                    onClick={() => setShowBulkEditModal(true)}
                    disabled={bulkUpdating}
                    className="inline-flex items-center gap-1.5 h-8 px-3 border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-xs font-bold rounded-lg hover:bg-[#DBEAFE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={12} />
                    {bulkUpdating ? 'Updating...' : `Bulk Edit (${selectedLeadIds.length})`}
                  </button>
                )}
                {isManager && featureControls.bulkEdit ? (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="inline-flex items-center gap-1.5 h-8 px-3 border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-xs font-bold rounded-lg hover:bg-[#FEE2E2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 size={12} />
                    {bulkDeleting ? 'Deleting...' : `Delete (${selectedLeadIds.length})`}
                  </button>
                ) : null}
              </>
            ) : null}
            {isManager && featureControls.exportLeads ? (
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 border border-[#D1FAE5] bg-[#F0FDF4] text-[#15803D] text-xs font-bold rounded-lg hover:bg-[#DCFCE7] transition-colors"
              >
                <Download size={12} />
                Export
              </button>
            ) : null}
            <button
              onClick={() => navigate('/lead-import')}
              className="inline-flex items-center gap-1.5 h-8 px-3 border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-xs font-bold rounded-lg hover:bg-[#DBEAFE] transition-colors"
            >
              <Plus size={12} />
              Import
            </button>
            <button
              onClick={() => setShowManualLead(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1D4ED8] text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={12} /> Add Lead
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {selectedLeadIds.length ? (
            <div className="px-2 py-0.5 rounded-md bg-[#FFF7ED] text-[#C2410C] text-[10px] font-bold border border-[#FED7AA]">
              {selectedLeadIds.length} selected
            </div>
          ) : null}
          <div className="relative flex-1 min-w-32">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-2 h-7 bg-white border border-gray-200 rounded-md text-[10px] text-[#0F172A] placeholder-[#94A3B8] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-colors"
            />
          </div>

          {isFailedMode ? (
            <FancyMultiSelect
              values={filterFailedReason}
              onChange={setFilterFailedReason}
              options={FAILED_REASONS.map((reason) => ({
                value: reason,
                label: reason,
                dotColor: '#DC2626',
              }))}
              placeholder="Failed Reason"
              minWidth={110}
              panelWidth={220}
            />
          ) : (
            <FancyMultiSelect
              values={filterDisposition}
              onChange={setFilterDisposition}
              // Hide 'All' AND 'Failed' from the picker — Failed leads live on
              // their own page now, so allowing the user to filter them in
              // here would just confuse the My Leads experience.
              options={dispositionOptions.filter((opt) => opt.value !== 'All' && opt.value !== 'Failed')}
              placeholder="Disposition"
              minWidth={70}
              panelWidth={220}
            />
          )}

          <FancyMultiSelect
            values={filterSource}
            onChange={setFilterSource}
            options={sourceOptions.filter((opt) => opt.value !== 'All')}
            placeholder="Source"
            minWidth={70}
            panelWidth={200}
          />

          <FancyMultiSelect
            values={filterCity}
            onChange={setFilterCity}
            options={cityOptions.filter((opt) => opt.value !== 'All')}
            placeholder="City"
            minWidth={70}
            panelWidth={200}
            // Cities can be a long curated list — Select-all is rarely useful here.
            hideSelectAll
          />

          <FancyMultiSelect
            values={filterFollowUp}
            onChange={setFilterFollowUp}
            options={followUpOptions.filter((opt) => opt.value !== 'All')}
            placeholder="Follow-up"
            minWidth={90}
            panelWidth={260}
          />

          {isManager ? (
            <FancyMultiSelect
              values={filterOwner}
              onChange={setFilterOwner}
              options={ownerOptions.filter((opt) => opt.value !== 'All')}
              placeholder="Owner"
              minWidth={70}
              panelWidth={220}
              hideSelectAll
            />
          ) : (
            <button
              onClick={() => setShowMyLeadsOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold border transition-colors ${
                showMyLeadsOnly
                  ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                  : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#1D4ED8] hover:text-[#1D4ED8]'
              }`}
            >
              <User size={12} />
              {showMyLeadsOnly ? 'My Leads' : 'All Leads'}
            </button>
          )}

          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Date"
            className="min-w-[70px]"
          />

          {/* When a date range is active, surface which timestamp it filters
              against. The two-button toggle mirrors the column headers — the
              column the filter is currently scoping shows a blue dot. Hidden
              while no range is set so the toolbar stays compact. */}
          {(dateRange.from || dateRange.to) ? (
            <div
              className="inline-flex items-center h-7 rounded-md border border-[#E2E8F0] bg-white p-0.5 text-[10px] font-bold"
              title="Which timestamp the date range filters by"
            >
              <button
                type="button"
                onClick={() => setDateMode('createdAt')}
                className={`inline-flex items-center gap-1 h-6 px-2 rounded transition-colors ${
                  dateMode === 'createdAt'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <CalendarDays size={10} />
                Created
              </button>
              <button
                type="button"
                onClick={() => setDateMode('updatedAt')}
                className={`inline-flex items-center gap-1 h-6 px-2 rounded transition-colors ${
                  dateMode === 'updatedAt'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Clock size={10} />
                Edited
              </button>
            </div>
          ) : null}

          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-0.5 h-7 px-2 text-[10px] font-semibold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-md hover:bg-[#FEE2E2] transition-colors"
            >
              <X size={9} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto px-4 pb-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                  <label className="relative inline-flex items-center justify-center cursor-pointer select-none align-middle">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible leads"
                      className="peer h-[18px] w-[18px] appearance-none rounded-[6px] border-[1.5px] border-[#CBD5E1] bg-white transition-all duration-200 cursor-pointer hover:border-[#3B82F6] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] checked:border-[#1D4ED8] checked:bg-gradient-to-br checked:from-[#3B82F6] checked:to-[#1D4ED8] checked:shadow-[0_2px_6px_rgba(29,78,216,0.3)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                    />
                    <Check size={11} strokeWidth={3.5} className="absolute text-white opacity-0 scale-50 transition-all duration-150 peer-checked:opacity-100 peer-checked:scale-100 pointer-events-none" />
                  </label>
                </th>
                {effectiveColumnKeys.map((key) => renderColumnHeader(key))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-6 py-20 text-center">
                    <p className="text-[#94A3B8] text-sm italic">Loading leads...</p>
                  </td>
                </tr>
              ) : (paginationMode === 'on' ? leads : infiniteLeads).length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-6 py-20 text-center">
                    <p className="text-[#94A3B8] text-sm">No leads found.</p>
                    <p className="text-[#94A3B8] text-xs mt-1">
                      {isManager
                        ? 'New leads will appear here as unassigned until a manager routes them manually.'
                        : showMyLeadsOnly
                          ? 'No leads are assigned to you yet.'
                          : 'No leads found. Try adjusting your filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                (paginationMode === 'on' ? leads : infiniteLeads).map((lead) => {
                  const dc = dispositionColors[lead.disposition] || { bg: '#F8FAFC', text: '#94A3B8' }

                  return (
                    <tr
                      key={lead._id}
                      className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                      onClick={() => navigateToLead(lead._id)}
                    >
                      <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <label className="relative inline-flex items-center justify-center cursor-pointer select-none align-middle">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead._id)}
                            onChange={() => toggleLeadSelection(lead._id)}
                            aria-label={`Select ${lead.name}`}
                            className="peer h-[18px] w-[18px] appearance-none rounded-[6px] border-[1.5px] border-[#CBD5E1] bg-white transition-all duration-200 cursor-pointer hover:border-[#3B82F6] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] checked:border-[#1D4ED8] checked:bg-gradient-to-br checked:from-[#3B82F6] checked:to-[#1D4ED8] checked:shadow-[0_2px_6px_rgba(29,78,216,0.3)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                          />
                          <Check size={11} strokeWidth={3.5} className="absolute text-white opacity-0 scale-50 transition-all duration-150 peer-checked:opacity-100 peer-checked:scale-100 pointer-events-none" />
                        </label>
                      </td>
                      {effectiveColumnKeys.map((key) => renderColumnCell(key, lead, dc))}
                      <td className="px-3 py-2.5 text-right">
                        <ChevronRight size={12} className="text-[#CBD5E1] inline" />
                      </td>
                    </tr>
                  )
                })
              )}
              {/* Loading more indicator for infinite scroll */}
              {paginationMode === 'off' && loadingMore && (
                <tr>
                  <td colSpan={tableColSpan} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-[#94A3B8]">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-xs">Loading more leads...</span>
                    </div>
                  </td>
                </tr>
              )}
              {/* End of list indicator */}
              {paginationMode === 'off' && !hasMore && infiniteLeads.length > 0 && !loadingMore && (
                <tr>
                  <td colSpan={tableColSpan} className="px-6 py-4 text-center">
                    <p className="text-[#94A3B8] text-xs">All leads loaded</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showManualLead ? (
        <ManualLeadModal
          onSubmit={async (leadData) => {
            try {
              const res = await leadsAPI.createLead(leadData)
              if (res.success) {
                if (paginationMode === 'on') {
                  fetchLeads(1)
                } else {
                  initInfiniteScroll()
                }
                setShowManualLead(false)
              }
            } catch (err) {
              console.error('Failed to create lead:', err)
            }
          }}
          onClose={() => setShowManualLead(false)}
          cities={cities.filter((city) => city !== 'All')}
          sources={sources.filter((source) => source !== 'All')}
          defaultCity={cities.filter((city) => city !== 'All')[0] || 'Mumbai'}
          leadFields={leadFields}
          ownerMode={isManager ? 'unassigned' : 'self'}
        />
      ) : null}

      {showBulkEditModal ? (
        <BulkEditLeadsModal
          allowUnassigned={isManager}
          canAssignOwner={canAssignOwner}
          dispositions={dispositions.filter((disposition) => disposition !== 'All')}
          onClose={() => setShowBulkEditModal(false)}
          onSubmit={handleBulkUpdate}
          representatives={representatives}
          selectedCount={selectedLeadIds.length}
          sources={sources.filter((source) => source !== 'All')}
        />
      ) : null}

      {showExportModal && isManager ? (
        <ExportLeadsModal
          initialOwner={filterOwner.length === 1 ? filterOwner[0] : 'All'}
          onClose={() => setShowExportModal(false)}
          owners={owners}
        />
      ) : null}
    </div>
  )
}

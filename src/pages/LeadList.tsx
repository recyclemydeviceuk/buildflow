import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, ChevronRight, ArrowUpDown, X, Plus, ChevronLeft, RefreshCw, Trash2, ToggleLeft, ToggleRight, Loader2, Download } from 'lucide-react'
import { leadsAPI, type Lead } from '../api/leads'
import type { LeadFieldConfig } from '../api/settings'
import { teamAPI } from '../api/team'
import FancyDropdown, { type FancyDropdownOption } from '../components/common/FancyDropdown'
import BulkEditLeadsModal from '../components/leads/BulkEditLeadsModal'
import CreatedAtEditor, { formatDateTimeLocalInput } from '../components/leads/CreatedAtEditor'
import ManualLeadModal from '../components/leads/ManualLeadModal'
import ExportLeadsModal from '../components/leads/ExportLeadsModal'
import RepresentativePicker, { type RepresentativePickerOption } from '../components/leads/RepresentativePicker'
import DateRangePicker, { type DateRange } from '../components/common/DateRangePicker'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { LEAD_FIELDS_STORAGE_KEY, LEAD_FIELDS_UPDATED_EVENT } from '../utils/leadFields'

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

const LEAD_LIST_FILTERS_STORAGE_KEY = 'buildflow:lead-list-filters'

type PersistedLeadFilters = {
  city: string
  disposition: string
  owner: string
  paginationMode: 'on' | 'off'
  search: string
  source: string
  dateRange: { from: string | null; to: string | null }
}

const readPersistedLeadFilters = (): PersistedLeadFilters => {
  if (typeof window === 'undefined') {
    return {
      city: 'All',
      disposition: 'All',
      owner: 'All',
      paginationMode: 'on',
      search: '',
      source: 'All',
      dateRange: { from: null, to: null },
    }
  }

  try {
    const rawValue = window.localStorage.getItem(LEAD_LIST_FILTERS_STORAGE_KEY)
    if (!rawValue) {
      return {
        city: 'All',
        disposition: 'All',
        owner: 'All',
        paginationMode: 'on',
        search: '',
        source: 'All',
        dateRange: { from: null, to: null },
      }
    }

    const parsed = JSON.parse(rawValue) as Partial<PersistedLeadFilters>
    return {
      city: parsed.city || 'All',
      disposition: parsed.disposition || 'All',
      owner: parsed.owner || 'All',
      paginationMode: parsed.paginationMode === 'off' ? 'off' : 'on',
      search: parsed.search || '',
      source: parsed.source || 'All',
      dateRange: parsed.dateRange || { from: null, to: null },
    }
  } catch {
    return {
      city: 'All',
      disposition: 'All',
      owner: 'All',
      paginationMode: 'on',
      search: '',
      source: 'All',
      dateRange: { from: null, to: null },
    }
  }
}

export default function LeadList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const isManager = user?.role === 'manager'
  const canAssignOwner = user?.role === 'manager' || user?.role === 'representative'
  const canEditCreatedAt = user?.role === 'manager' || user?.role === 'representative'
  const [persistedFilters] = useState(readPersistedLeadFilters)

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState(persistedFilters.search)
  const [filterDisposition, setFilterDisposition] = useState<string>(persistedFilters.disposition)
  const [filterSource, setFilterSource] = useState<string>(persistedFilters.source)
  const [filterCity, setFilterCity] = useState<string>(persistedFilters.city)
  const [filterOwner, setFilterOwner] = useState<string>(persistedFilters.owner)
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
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [paginationMode, setPaginationMode] = useState<'on' | 'off'>(persistedFilters.paginationMode)
  const [infiniteLeads, setInfiniteLeads] = useState<Lead[]>([])
  const [infinitePage, setInfinitePage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const leadListRequestVersionRef = useRef(0)

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
    }
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      LEAD_LIST_FILTERS_STORAGE_KEY,
      JSON.stringify({
        city: filterCity,
        disposition: filterDisposition,
        owner: filterOwner,
        paginationMode,
        search,
        source: filterSource,
        dateRange: {
          from: dateRange.from ? dateRange.from.toISOString() : null,
          to: dateRange.to ? dateRange.to.toISOString() : null,
        },
      })
    )
  }, [filterCity, filterDisposition, filterOwner, filterSource, paginationMode, search, dateRange])

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
      if (filterDisposition !== 'All') params.disposition = filterDisposition
      if (filterSource !== 'All') params.source = filterSource
      if (filterCity !== 'All') params.city = filterCity
      if (isManager && filterOwner !== 'All') params.owner = filterOwner

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

      return params
    },
    [search, filterDisposition, filterSource, filterCity, isManager, filterOwner, dateRange]
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
    if (paginationMode === 'on') {
      void fetchLeads(1)
    } else {
      void initInfiniteScroll()
    }
  }, [paginationMode, fetchLeads, initInfiniteScroll])

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

  const handleAssignLead = async (leadId: string, userId: string | null) => {
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
    filterDisposition !== 'All' ||
    filterSource !== 'All' ||
    filterCity !== 'All' ||
    (isManager && filterOwner !== 'All') ||
    Boolean(dateRange.from || dateRange.to)

  const clearFilters = () => {
    setFilterDisposition('All')
    setFilterSource('All')
    setFilterCity('All')
    setFilterOwner('All')
    setSearch('')
    setDateRange({ from: null, to: null })
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
      const response = await leadsAPI.deleteLead(lead._id)
      if (!response.success) return

      setSelectedLeadIds((current) => current.filter((id) => id !== lead._id))
      const nextPage = leads.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page
      if (paginationMode === 'on') {
        await fetchLeads(nextPage)
      } else {
        await initInfiniteScroll()
      }
      await fetchFilters()
    } catch (error) {
      console.error('Failed to delete lead:', error)
    } finally {
      setDeletingLeadId(null)
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
      const response = await leadsAPI.bulkDeleteLeads(selectedLeadIds)
      if (!response.success) return

      setSelectedLeadIds([])
      const nextPage = selectedLeadIds.length === leads.length && pagination.page > 1 ? pagination.page - 1 : pagination.page
      if (paginationMode === 'on') {
        await fetchLeads(nextPage)
      } else {
        await initInfiniteScroll()
      }
      await fetchFilters()
    } catch (error) {
      console.error('Failed to bulk delete leads:', error)
    } finally {
      setBulkDeleting(false)
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

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Leads</h1>
            <p className="text-xs text-[#475569] mt-0.5">
              {pagination.total} leads
              {isManager && filterOwner === 'unassigned' ? ' awaiting assignment' : ''}
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

            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {paginationMode === 'on' && (
              <div className="flex items-center gap-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-0.5 py-0.5 shadow-sm">
                <button
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchLeads(pagination.page - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#64748B] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={13} />
                </button>
                <div className="px-2 text-[11px] font-semibold text-[#475569] whitespace-nowrap">
                  <span className="text-[#0F172A] font-bold">{pagination.page}</span> / <span className="text-[#0F172A] font-bold">{pagination.pages}</span>
                </div>
                <button
                  disabled={pagination.page >= pagination.pages || loading}
                  onClick={() => fetchLeads(pagination.page + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#64748B] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            {selectedLeadIds.length ? (
              <>
                <button
                  onClick={() => setShowBulkEditModal(true)}
                  disabled={bulkUpdating}
                  className="inline-flex items-center gap-1.5 h-8 px-3 border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-xs font-bold rounded-lg hover:bg-[#DBEAFE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={12} />
                  {bulkUpdating ? 'Updating...' : `Bulk Edit (${selectedLeadIds.length})`}
                </button>
                {isManager ? (
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
            {isManager ? (
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

          <FancyDropdown
            value={filterDisposition}
            onChange={setFilterDisposition}
            options={dispositionOptions}
            placeholder="Disposition"
            minWidth={70}
            panelWidth={200}
          />

          <FancyDropdown
            value={filterSource}
            onChange={setFilterSource}
            options={sourceOptions}
            placeholder="Source"
            minWidth={70}
            panelWidth={180}
          />

          <FancyDropdown
            value={filterCity}
            onChange={setFilterCity}
            options={cityOptions}
            placeholder="City"
            minWidth={70}
            panelWidth={180}
          />

          {isManager ? (
            <FancyDropdown
              value={filterOwner}
              onChange={setFilterOwner}
              options={ownerOptions}
              placeholder="Owner"
              minWidth={70}
              panelWidth={200}
            />
          ) : null}

          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Date"
            className="min-w-[70px]"
          />

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
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible leads"
                    className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#1D4ED8] focus:ring-[#1D4ED8]"
                  />
                </th>
                {['Lead', 'Source', 'City', 'Owner', 'Disposition', 'Created At', isManager ? 'Actions' : '', ''].filter(Boolean).map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                  >
                    {heading && heading !== 'Actions' ? (
                      <div className="flex items-center gap-1">
                        {heading} <ArrowUpDown size={10} className="opacity-50" />
                      </div>
                    ) : heading === 'Actions' ? (
                      'Actions'
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <p className="text-[#94A3B8] text-sm italic">Loading leads...</p>
                  </td>
                </tr>
              ) : (paginationMode === 'on' ? leads : infiniteLeads).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <p className="text-[#94A3B8] text-sm">No leads found.</p>
                    <p className="text-[#94A3B8] text-xs mt-1">
                      {isManager
                        ? 'New leads will appear here as unassigned until a manager routes them manually.'
                        : 'You will only see leads currently assigned to you.'}
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
                      onClick={() => navigate(`/leads/${lead._id}`)}
                    >
                      <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead._id)}
                          onChange={() => toggleLeadSelection(lead._id)}
                          aria-label={`Select ${lead.name}`}
                          className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#1D4ED8] focus:ring-[#1D4ED8]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
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
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-semibold" style={{ color: sourceColors[lead.source] || '#94A3B8' }}>
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <MapPin size={10} className="text-[#94A3B8]" />
                          <span className="text-[11px] text-[#475569]">{lead.city}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {canAssignOwner ? (
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
                        ) : lead.ownerName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-[#E2E8F0] flex items-center justify-center text-[#475569] text-[9px] font-bold shrink-0">
                              {lead.ownerName.split(' ').map((part) => part[0]).join('')}
                            </div>
                            <span className="text-[11px] font-medium text-[#475569] truncate max-w-[100px]">
                              {lead.ownerName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: dc.bg, color: dc.text }}
                        >
                          {lead.disposition}
                        </span>
                      </td>
                      <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                        {editingCreatedAtLeadId === lead._id ? (
                          <div
                            className="space-y-2 min-w-[280px] max-w-[320px]"
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                void handleSaveCreatedAt(lead)
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                cancelEditingCreatedAt()
                              }
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
                                {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="text-[9px] text-[#94A3B8] whitespace-nowrap">
                                {new Date(lead.createdAt).toLocaleTimeString('en-IN', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
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
                      <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
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
                            onClick={() => navigate(`/leads/${lead._id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold hover:bg-[#DBEAFE] transition-colors"
                          >
                            View
                          </button>
                        )}
                      </td>
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
                  <td colSpan={9} className="px-6 py-4 text-center">
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
                  <td colSpan={9} className="px-6 py-4 text-center">
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
          initialOwner={filterOwner}
          onClose={() => setShowExportModal(false)}
          owners={owners}
        />
      ) : null}
    </div>
  )
}

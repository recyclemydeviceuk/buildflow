import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MessageSquare, RefreshCw, Search, ToggleLeft, ToggleRight, User } from 'lucide-react'
import { followUpsAPI, type FollowUpRecord } from '../api/followUps'
import { leadsAPI } from '../api/leads'
import { useAuth } from '../context/AuthContext'

type FollowUpBucket = 'all' | 'overdue' | 'due-soon' | 'upcoming' | 'completed' | 'cancelled'
const FOLLOW_UPS_PAGE_SIZE = 40

const bucketConfig: Record<Exclude<FollowUpBucket, 'all'>, { label: string; dot: string; bg: string; text: string }> = {
  overdue: { label: 'Overdue', dot: '#DC2626', bg: '#FEF2F2', text: '#B91C1C' },
  'due-soon': { label: 'Due Soon', dot: '#F59E0B', bg: '#FFFBEB', text: '#B45309' },
  upcoming: { label: 'Upcoming', dot: '#16A34A', bg: '#F0FDF4', text: '#15803D' },
  completed: { label: 'Completed', dot: '#2563EB', bg: '#EFF6FF', text: '#1D4ED8' },
  cancelled: { label: 'Cancelled', dot: '#94A3B8', bg: '#F8FAFC', text: '#64748B' },
}

const getFollowUpBucket = (followUp: FollowUpRecord): Exclude<FollowUpBucket, 'all'> => {
  if (followUp.status === 'completed') return 'completed'
  if (followUp.status === 'cancelled') return 'cancelled'

  const now = Date.now()
  const scheduledAt = new Date(followUp.scheduledAt).getTime()

  if (scheduledAt <= now) return 'overdue'
  if (scheduledAt - now <= 30 * 60 * 1000) return 'due-soon'
  return 'upcoming'
}

const isTodayDate = (value: string) => {
  const date = new Date(value)
  const now = new Date()

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export default function FollowUps() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  // Split data by status so we can lazy-load only the bucket the user is viewing.
  // Previously we sequentially fetched EVERY page of EVERY follow-up before rendering,
  // which made the page unusable once counts grew into the thousands.
  const [pendingFollowUps, setPendingFollowUps] = useState<FollowUpRecord[]>([])
  const [completedFollowUps, setCompletedFollowUps] = useState<FollowUpRecord[]>([])
  const [cancelledFollowUps, setCancelledFollowUps] = useState<FollowUpRecord[]>([])
  const [completedTotal, setCompletedTotal] = useState(0)
  const [cancelledTotal, setCancelledTotal] = useState(0)
  const [completedLoaded, setCompletedLoaded] = useState(false)
  const [cancelledLoaded, setCancelledLoaded] = useState(false)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FollowUpBucket>('all')
  const [markingDoneIds, setMarkingDoneIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [todayFirst, setTodayFirst] = useState(false)

  // Fetch only the ACTIVE (pending) follow-ups on mount. Completed/cancelled are
  // lazy-loaded when the user clicks their tab — they're historical and rarely
  // scanned, so there's no point paying that cost upfront.
  const fetchPending = async (background = false) => {
    try {
      if (!background) setLoading(true)
      const res = await followUpsAPI.getFollowUps({ page: '1', limit: '200', status: 'pending' })
      if (res.success) setPendingFollowUps(res.data)
    } catch (error) {
      console.error('Failed to fetch pending follow-ups:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchCompleted = async () => {
    try {
      const res = await followUpsAPI.getFollowUps({ page: '1', limit: '100', status: 'completed' })
      if (res.success) {
        setCompletedFollowUps(res.data)
        setCompletedTotal(res.pagination?.total || res.data.length)
        setCompletedLoaded(true)
      }
    } catch (error) {
      console.error('Failed to fetch completed follow-ups:', error)
    }
  }

  const fetchCancelled = async () => {
    try {
      const res = await followUpsAPI.getFollowUps({ page: '1', limit: '100', status: 'cancelled' })
      if (res.success) {
        setCancelledFollowUps(res.data)
        setCancelledTotal(res.pagination?.total || res.data.length)
        setCancelledLoaded(true)
      }
    } catch (error) {
      console.error('Failed to fetch cancelled follow-ups:', error)
    }
  }

  const refreshAll = async (background = false) => {
    await fetchPending(background)
    if (completedLoaded) void fetchCompleted()
    if (cancelledLoaded) void fetchCancelled()
  }

  useEffect(() => {
    void fetchPending()
  }, [])

  // Lazy-load completed/cancelled only when the user actually switches to that tab
  useEffect(() => {
    if (activeTab === 'completed' && !completedLoaded) void fetchCompleted()
    if (activeTab === 'cancelled' && !cancelledLoaded) void fetchCancelled()
  }, [activeTab, completedLoaded, cancelledLoaded])

  // Reduced poll interval from 60s → 180s (3 min). We still refetch on window focus
  // so reps see fresh data when they come back, but we stop hammering the DB while
  // the tab is sitting idle in the background.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchPending(true)
    }, 180000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchPending(true)
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Combined list for "All" tab + filtering
  const followUps = useMemo(() => {
    return [...pendingFollowUps, ...completedFollowUps, ...cancelledFollowUps]
  }, [pendingFollowUps, completedFollowUps, cancelledFollowUps])

  // Bucket counts for the tab badges.
  // Pending-derived buckets (overdue / due-soon / upcoming) are computed from the
  // in-memory pending array. Completed/cancelled use the server's pagination total
  // so the badge is accurate even before the user has opened that tab.
  const counts: Record<FollowUpBucket, number> = useMemo(
    () => {
      const pendingCounts = {
        overdue: 0,
        'due-soon': 0,
        upcoming: 0,
      }
      for (const fu of pendingFollowUps) {
        const b = getFollowUpBucket(fu)
        if (b === 'overdue') pendingCounts.overdue++
        else if (b === 'due-soon') pendingCounts['due-soon']++
        else if (b === 'upcoming') pendingCounts.upcoming++
      }
      const completed = completedLoaded ? completedFollowUps.length : completedTotal
      const cancelled = cancelledLoaded ? cancelledFollowUps.length : cancelledTotal
      return {
        all: pendingFollowUps.length + completed + cancelled,
        overdue: pendingCounts.overdue,
        'due-soon': pendingCounts['due-soon'],
        upcoming: pendingCounts.upcoming,
        completed,
        cancelled,
      }
    },
    [pendingFollowUps, completedFollowUps, cancelledFollowUps, completedLoaded, cancelledLoaded, completedTotal, cancelledTotal]
  )

  const filteredFollowUps = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()

    return followUps.filter((followUp) => {
      const bucket = getFollowUpBucket(followUp)
      const matchesTab = activeTab === 'all' || bucket === activeTab
      const matchesSearch =
        !normalizedQuery ||
        followUp.leadName.toLowerCase().includes(normalizedQuery) ||
        followUp.ownerName.toLowerCase().includes(normalizedQuery) ||
        String(followUp.notes || '').toLowerCase().includes(normalizedQuery)

      return matchesTab && matchesSearch
    })
  }, [activeTab, followUps, search])

  const orderedFollowUps = useMemo(() => {
    if (!todayFirst) return filteredFollowUps

    const todaysItems = filteredFollowUps.filter((followUp) => isTodayDate(followUp.scheduledAt))
    const remainingItems = filteredFollowUps.filter((followUp) => !isTodayDate(followUp.scheduledAt))

    return [...todaysItems, ...remainingItems]
  }, [filteredFollowUps, todayFirst])

  const totalPages = Math.max(1, Math.ceil(orderedFollowUps.length / FOLLOW_UPS_PAGE_SIZE))

  const visibleFollowUps = useMemo(() => {
    const startIndex = (page - 1) * FOLLOW_UPS_PAGE_SIZE
    return orderedFollowUps.slice(startIndex, startIndex + FOLLOW_UPS_PAGE_SIZE)
  }, [orderedFollowUps, page])

  useEffect(() => {
    setPage(1)
  }, [activeTab, search, todayFirst])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const tabs: Array<{ key: FollowUpBucket; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'due-soon', label: 'Due Soon' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  const summaryCards: Array<{
    key: FollowUpBucket
    label: string
    helper: string
    Icon: typeof CalendarClock
    surface: string
    iconColor: string
    valueColor: string
  }> = [
    {
      key: 'all',
      label: 'Total follow-ups',
      helper: 'Entire queue',
      Icon: CalendarClock,
      surface: 'bg-[#EFF6FF]',
      iconColor: 'text-[#1D4ED8]',
      valueColor: 'text-[#0F172A]',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      helper: 'Needs immediate action',
      Icon: Clock3,
      surface: 'bg-[#FEF2F2]',
      iconColor: 'text-[#DC2626]',
      valueColor: 'text-[#B91C1C]',
    },
    {
      key: 'due-soon',
      label: 'Due soon',
      helper: 'Within the next 30 min',
      Icon: CalendarDays,
      surface: 'bg-[#FFF7ED]',
      iconColor: 'text-[#EA580C]',
      valueColor: 'text-[#C2410C]',
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      helper: 'Planned next',
      Icon: CalendarDays,
      surface: 'bg-[#F0FDF4]',
      iconColor: 'text-[#16A34A]',
      valueColor: 'text-[#166534]',
    },
    {
      key: 'completed',
      label: 'Completed',
      helper: 'Already closed',
      Icon: CheckCircle2,
      surface: 'bg-[#EFF6FF]',
      iconColor: 'text-[#2563EB]',
      valueColor: 'text-[#1D4ED8]',
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      helper: 'No longer active',
      Icon: MessageSquare,
      surface: 'bg-[#F8FAFC]',
      iconColor: 'text-[#64748B]',
      valueColor: 'text-[#475569]',
    },
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshAll(true)
  }

  const handleMarkDone = async (followUp: FollowUpRecord) => {
    try {
      setMarkingDoneIds((current) => new Set(current).add(followUp._id))
      const response = await leadsAPI.updateFollowUp(followUp.lead, followUp._id, { status: 'completed' })
      if (response.success) {
        // Optimistic local update — remove from pending, reset completed so the
        // tab re-fetches fresh on next open. Avoids a full page refetch.
        setPendingFollowUps((prev) => prev.filter((item) => item._id !== followUp._id))
        setCompletedLoaded(false)
      }
    } catch (error) {
      console.error('Failed to mark follow-up done:', error)
    } finally {
      setMarkingDoneIds((current) => {
        const next = new Set(current)
        next.delete(followUp._id)
        return next
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="px-3 py-3 sm:px-4 lg:px-5 lg:py-4 space-y-3.5">
        <div className="rounded-[22px] border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-[#0F172A] tracking-tight">Follow Ups</h1>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                {isManager
                  ? 'Plan, track, and close every scheduled follow-up across the team.'
                  : 'See your upcoming conversations, follow-throughs, and completed callbacks.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                <span className="text-xs font-semibold text-[#475569]">
                  {orderedFollowUps.length} visible of {counts.all}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setTodayFirst((current) => !current)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                  todayFirst
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                {todayFirst ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                Today on top
              </button>

              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] bg-white text-xs sm:text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search lead, owner, or notes..."
                className="w-full pl-10 pr-3.5 h-10 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key
                const count = counts[tab.key]

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-[#0F172A] text-white shadow-sm'
                        : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:bg-white hover:text-[#0F172A]'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/15 text-white' : 'bg-white text-[#64748B] border border-[#E2E8F0]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-6">
          {summaryCards.map(({ key, label, helper, Icon, surface, iconColor, valueColor }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-[20px] border p-3 text-left transition-all ${
                activeTab === key
                  ? 'border-[#BFDBFE] bg-white shadow-sm ring-2 ring-[#DBEAFE]'
                  : 'border-[#E2E8F0] bg-white hover:-translate-y-px hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${surface}`}>
                  <Icon size={16} className={iconColor} />
                </div>
                <span className="text-[10px] font-semibold text-[#94A3B8] text-right leading-4">{helper}</span>
              </div>
              <p className={`mt-3 text-xl font-extrabold ${valueColor}`}>{counts[key]}</p>
              <p className="mt-0.5 text-[11px] sm:text-xs font-semibold text-[#64748B] leading-4">{label}</p>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-[22px] border border-[#E2E8F0] bg-white py-16">
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-2.5">
              <CalendarClock size={20} className="text-[#1D4ED8]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Loading follow-ups...</p>
            <p className="text-xs text-[#94A3B8] mt-1">Bringing your schedule into view.</p>
          </div>
        ) : filteredFollowUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[22px] border border-[#E2E8F0] bg-white py-16">
            <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] flex items-center justify-center mb-2.5">
              <CheckCircle2 size={20} className="text-[#16A34A]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">No follow-ups here</p>
            <p className="text-xs text-[#94A3B8] mt-1">Try another tab or search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {visibleFollowUps.map((followUp) => {
              const bucket = getFollowUpBucket(followUp)
              const config = bucketConfig[bucket]
              const scheduledAt = new Date(followUp.scheduledAt)
              const isPending = followUp.status === 'pending'
              const isMarkingDone = markingDoneIds.has(followUp._id)
              const notificationLabel = !isPending
                ? config.label
                : followUp.notificationState?.confirmedAt
                ? 'Prompt confirmed'
                : 'Awaiting action'

              return (
                <div
                  key={followUp._id}
                  className="bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden transition-all duration-200 hover:shadow-sm hover:-translate-y-px"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[165px_minmax(0,1fr)_158px] xl:grid-cols-[175px_minmax(0,1fr)_170px]">
                    <div
                      className="px-3.5 py-3.5 border-b lg:border-b-0 lg:border-r border-[#E2E8F0]"
                      style={{ background: `${config.dot}0F` }}
                    >
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                        style={{ background: config.bg, color: config.text }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${bucket === 'overdue' ? 'animate-pulse' : ''}`} style={{ background: config.dot }} />
                        {config.label}
                      </div>

                      <div className="mt-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">Scheduled</p>
                        <p className="mt-1.5 text-2xl font-extrabold text-[#0F172A] leading-none">
                          {scheduledAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#475569]">
                          {scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="mt-1 text-[11px] text-[#94A3B8] leading-4">
                          {scheduledAt.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="px-3.5 py-3.5 min-w-0">
                      <div className="flex flex-col gap-3 h-full">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-base font-extrabold text-[#0F172A] truncate">{followUp.leadName}</p>
                            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 truncate">
                              {isManager ? `Assigned to ${followUp.ownerName}` : 'Scheduled follow-up in your queue'}
                            </p>
                          </div>

                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-semibold text-[#475569]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.dot }} />
                            {notificationLabel}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                              <User size={12} className="text-[#64748B]" />
                              Owner
                            </div>
                            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#475569] break-words line-clamp-2">{followUp.ownerName}</p>
                          </div>

                          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                              <Clock3 size={12} className="text-[#64748B]" />
                              Status
                            </div>
                            <p className="mt-1.5 text-xs sm:text-sm font-semibold leading-4" style={{ color: config.text }}>
                              {isPending ? 'Pending follow-through' : config.label}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 min-h-[88px]">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                            <MessageSquare size={12} className="text-[#64748B]" />
                            Notes
                          </div>
                          <p className="mt-2 text-xs sm:text-sm leading-5 text-[#475569] break-words">
                            {followUp.notes?.trim() || 'No notes were added for this follow-up yet.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="px-3.5 py-3.5 border-t lg:border-t-0 lg:border-l border-[#E2E8F0] bg-[#FCFDFE] flex lg:flex-col gap-2 lg:justify-between">
                      <div className="space-y-1.5 flex-1 lg:flex-none">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Next step</p>
                        <p className="text-xs sm:text-sm font-semibold text-[#475569] leading-5">
                          {isPending ? 'Complete this follow-up or open the lead to continue.' : 'Review the lead history for context.'}
                        </p>
                      </div>

                      <div className="flex flex-1 flex-col justify-end gap-2 sm:flex-row lg:flex-col lg:flex-none">
                        {isPending ? (
                          <button
                            onClick={() => void handleMarkDone(followUp)}
                            disabled={isMarkingDone}
                            className="w-full justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] hover:bg-[#DCFCE7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <CheckCircle2 size={13} />
                            {isMarkingDone ? 'Saving...' : 'Mark done'}
                          </button>
                        ) : null}

                        <button
                          onClick={() => navigate(`/leads/${followUp.lead}`)}
                          className="w-full justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                        >
                          Open lead
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && orderedFollowUps.length > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E2E8F0] bg-white px-3 py-2.5">
            <div className="text-[11px] sm:text-xs font-semibold text-[#64748B]">
              Showing <span className="text-[#0F172A] font-bold">{Math.min((page - 1) * FOLLOW_UPS_PAGE_SIZE + 1, orderedFollowUps.length)}</span>
              {' '}-{' '}
              <span className="text-[#0F172A] font-bold">{Math.min(page * FOLLOW_UPS_PAGE_SIZE, orderedFollowUps.length)}</span>
              {' '}of{' '}
              <span className="text-[#0F172A] font-bold">{orderedFollowUps.length}</span>
            </div>

            <div className="flex items-center gap-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-0.5 py-0.5 shadow-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="w-7 h-7 flex items-center justify-center rounded text-[#64748B] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={13} />
              </button>
              <div className="px-2 text-[11px] font-semibold text-[#475569] whitespace-nowrap">
                <span className="text-[#0F172A] font-bold">{page}</span> / <span className="text-[#0F172A] font-bold">{totalPages}</span>
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="w-7 h-7 flex items-center justify-center rounded text-[#64748B] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

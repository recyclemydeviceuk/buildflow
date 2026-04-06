import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, ChevronRight, Clock3, RefreshCw, Search, User } from 'lucide-react'
import { followUpsAPI, type FollowUpRecord } from '../api/followUps'
import { leadsAPI } from '../api/leads'
import { useAuth } from '../context/AuthContext'

type FollowUpBucket = 'all' | 'overdue' | 'due-soon' | 'upcoming' | 'completed' | 'cancelled'

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

export default function FollowUps() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FollowUpBucket>('all')
  const [markingDoneIds, setMarkingDoneIds] = useState<Set<string>>(new Set())

  const fetchFollowUps = async (background = false) => {
    try {
      if (!background) setLoading(true)
      const response = await followUpsAPI.getFollowUps({ page: '1', limit: '200' })
      if (response.success) {
        setFollowUps(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchFollowUps()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchFollowUps(true)
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchFollowUps(true)
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

  const counts: Record<FollowUpBucket, number> = useMemo(
    () => ({
      all: followUps.length,
      overdue: followUps.filter((followUp) => getFollowUpBucket(followUp) === 'overdue').length,
      'due-soon': followUps.filter((followUp) => getFollowUpBucket(followUp) === 'due-soon').length,
      upcoming: followUps.filter((followUp) => getFollowUpBucket(followUp) === 'upcoming').length,
      completed: followUps.filter((followUp) => getFollowUpBucket(followUp) === 'completed').length,
      cancelled: followUps.filter((followUp) => getFollowUpBucket(followUp) === 'cancelled').length,
    }),
    [followUps]
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

  const tabs: Array<{ key: FollowUpBucket; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'due-soon', label: 'Due Soon' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchFollowUps(true)
  }

  const handleMarkDone = async (followUp: FollowUpRecord) => {
    try {
      setMarkingDoneIds((current) => new Set(current).add(followUp._id))
      const response = await leadsAPI.updateFollowUp(followUp.lead, followUp._id, { status: 'completed' })
      if (response.success) {
        await fetchFollowUps(true)
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
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div>
            <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">Follow Ups</h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {isManager ? 'Track every team follow-up in one place.' : 'Track the follow-ups assigned to you.'}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lead, owner, or notes..."
            className="w-full pl-8 pr-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs placeholder-[#94A3B8] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            const count = counts[tab.key]

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                  isActive ? 'bg-[#0F172A] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`}
              >
                {tab.label}
                {count > 0 ? (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-3 max-w-6xl space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-3">
              <CalendarClock size={24} className="text-[#1D4ED8]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Loading follow-ups...</p>
            <p className="text-xs text-[#94A3B8] mt-1">Bringing your timeline together.</p>
          </div>
        ) : filteredFollowUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-[#16A34A]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">No follow-ups here</p>
            <p className="text-xs text-[#94A3B8] mt-1">Try another tab or search term.</p>
          </div>
        ) : (
          filteredFollowUps.map((followUp) => {
            const bucket = getFollowUpBucket(followUp)
            const config = bucketConfig[bucket]
            const scheduledAt = new Date(followUp.scheduledAt)
            const isPending = followUp.status === 'pending'
            const isMarkingDone = markingDoneIds.has(followUp._id)

            return (
              <div
                key={followUp._id}
                className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden transition-all duration-200 hover:shadow-sm hover:-translate-y-px"
              >
                <div className="flex items-stretch">
                  <div className="w-1 shrink-0" style={{ background: config.dot }} />

                  <div className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${bucket === 'overdue' ? 'animate-pulse' : ''}`}
                        style={{ background: config.dot }}
                      />

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0F172A] truncate">{followUp.leadName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={10} className="text-[#94A3B8]" />
                            {scheduledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                            {scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isManager ? (
                            <span className="inline-flex items-center gap-1">
                              <User size={10} className="text-[#94A3B8]" />
                              {followUp.ownerName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {followUp.notes ? (
                      <div className="hidden xl:block flex-1 min-w-0 px-4 border-l border-r border-[#F1F5F9]">
                        <p className="text-xs text-[#64748B] truncate">{followUp.notes}</p>
                      </div>
                    ) : (
                      <div className="hidden xl:block flex-1" />
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: config.bg, color: config.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.dot }} />
                        {config.label}
                      </span>

                      {isPending ? (
                        <button
                          onClick={() => void handleMarkDone(followUp)}
                          disabled={isMarkingDone}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] hover:bg-[#DCFCE7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <CheckCircle2 size={12} />
                          {isMarkingDone ? 'Saving...' : 'Done'}
                        </button>
                      ) : null}

                      <button
                        onClick={() => navigate(`/leads/${followUp.lead}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                      >
                        Open
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

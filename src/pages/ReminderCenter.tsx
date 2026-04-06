import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BellRing, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock, PhoneCall, RefreshCw, Search, ToggleLeft, ToggleRight, User } from 'lucide-react'
import { remindersAPI, type Reminder, type ReminderPriority } from '../api/reminders'

type UIReminderStatus = 'overdue' | 'due-soon' | 'upcoming' | 'completed'
type TabKey = UIReminderStatus | 'all'
const REMINDERS_PAGE_SIZE = 40

const statusCfg: Record<string, { label: string; dot: string; text: string; bar: string }> = {
  overdue:   { label: 'Overdue',   dot: '#DC2626', text: '#DC2626', bar: '#DC2626' },
  'due-soon':{ label: 'Due Soon',  dot: '#F59E0B', text: '#D97706', bar: '#F59E0B' },
  upcoming:  { label: 'Upcoming',  dot: '#16A34A', text: '#16A34A', bar: '#16A34A' },
  completed: { label: 'Completed', dot: '#94A3B8', text: '#94A3B8', bar: '#CBD5E1' },
}

const priorityCfg: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#FEF2F2', text: '#DC2626' },
  medium: { bg: '#FFFBEB', text: '#D97706' },
  low:    { bg: '#F1F5F9', text: '#64748B' },
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

export default function ReminderCenter() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [todayFirst, setTodayFirst] = useState(false)

  const statusToUI = (status: Reminder['status']): UIReminderStatus => {
    if (status === 'due_soon') return 'due-soon'
    return status
  }

  const statusToBackend = (uiStatus: UIReminderStatus): Reminder['status'] => {
    if (uiStatus === 'due-soon') return 'due_soon'
    return uiStatus
  }

  const fetchReminders = async (background = false) => {
    if (!background) setLoading(true)
    try {
      const res = await remindersAPI.getReminders({ page: '1', limit: '100' })
      if (res.success) setReminders(res.data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchReminders()
  }, [])

  const counts: Record<TabKey, number> = {
    all: reminders.length,
    overdue: reminders.filter(r => r.status === 'overdue').length,
    'due-soon': reminders.filter(r => r.status === 'due_soon').length,
    upcoming: reminders.filter(r => r.status === 'upcoming').length,
    completed: reminders.filter(r => r.status === 'completed').length,
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return reminders.filter(r => {
      const matchTab = activeTab === 'all' || r.status === statusToBackend(activeTab)
      const matchSearch = !q ||
        r.leadName?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search, reminders])

  const orderedReminders = useMemo(() => {
    if (!todayFirst) return filtered

    const todaysItems = filtered.filter((reminder) => isTodayDate(reminder.dueAt))
    const remainingItems = filtered.filter((reminder) => !isTodayDate(reminder.dueAt))

    return [...todaysItems, ...remainingItems]
  }, [filtered, todayFirst])

  const totalPages = Math.max(1, Math.ceil(orderedReminders.length / REMINDERS_PAGE_SIZE))

  const visibleReminders = useMemo(() => {
    const startIndex = (page - 1) * REMINDERS_PAGE_SIZE
    return orderedReminders.slice(startIndex, startIndex + REMINDERS_PAGE_SIZE)
  }, [orderedReminders, page])

  useEffect(() => {
    setPage(1)
  }, [activeTab, search, todayFirst])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const markDone = async (id: string) => {
    setDoneIds(prev => new Set(prev).add(id))
    try {
      await remindersAPI.markReminderDone(id)
      await fetchReminders()
    } catch (err) {
      console.error('Failed to mark reminder done:', err)
    } finally {
      setDoneIds(prev => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'due-soon', label: 'Due Soon' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Done' },
  ]

  const summaryCards: Array<{
    key: TabKey
    label: string
    helper: string
    Icon: typeof BellRing
    surface: string
    iconColor: string
    valueColor: string
  }> = [
    {
      key: 'all',
      label: 'All reminders',
      helper: 'Everything scheduled',
      Icon: BellRing,
      surface: 'bg-[#DBEAFE]',
      iconColor: 'text-[#1D4ED8]',
      valueColor: 'text-[#0F172A]',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      helper: 'Immediate attention',
      Icon: AlertTriangle,
      surface: 'bg-[#FEE2E2]',
      iconColor: 'text-[#DC2626]',
      valueColor: 'text-[#B91C1C]',
    },
    {
      key: 'due-soon',
      label: 'Due soon',
      helper: 'Next up to call',
      Icon: Clock,
      surface: 'bg-[#FFEDD5]',
      iconColor: 'text-[#EA580C]',
      valueColor: 'text-[#C2410C]',
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      helper: 'Future queue',
      Icon: CalendarRange,
      surface: 'bg-[#DCFCE7]',
      iconColor: 'text-[#16A34A]',
      valueColor: 'text-[#166534]',
    },
    {
      key: 'completed',
      label: 'Completed',
      helper: 'Already cleared',
      Icon: CheckCircle2,
      surface: 'bg-[#E2E8F0]',
      iconColor: 'text-[#64748B]',
      valueColor: 'text-[#475569]',
    },
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchReminders(true)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="px-3 py-3 sm:px-4 lg:px-5 lg:py-4 space-y-3.5">
      {/* Header */}
      <div className="rounded-[22px] overflow-hidden border border-[#0F172A] bg-[linear-gradient(135deg,#0F172A_0%,#172554_58%,#1E3A8A_100%)] text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
        <div className="px-4 py-4 sm:px-5 sm:py-4.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
                <PhoneCall size={11} />
                Call reminders
              </div>
              <h1 className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight">Reminder Center</h1>
              <p className="mt-1.5 text-xs sm:text-sm text-blue-100 max-w-2xl leading-5">
                Prioritize urgent callbacks, clear due items fast, and keep every scheduled reminder visible in one adaptive dashboard.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${counts.overdue > 0 ? 'bg-[#FCA5A5] animate-pulse' : 'bg-[#86EFAC]'}`} />
                <span className="text-xs font-semibold text-white/90">
                  {counts.overdue > 0
                    ? `${counts.overdue} overdue · ${counts['due-soon']} due soon`
                    : counts['due-soon'] > 0
                    ? `${counts['due-soon']} due soon`
                    : 'All on schedule'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setTodayFirst((current) => !current)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-colors ${
                  todayFirst
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'border-white/10 bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {todayFirst ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                Today on top
              </button>

              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white text-[#0F172A] text-xs sm:text-sm font-bold hover:bg-[#E2E8F0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search lead name, title or notes..."
                className="w-full pl-10 pr-3.5 h-10 bg-white border border-white/30 rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white transition-all"
              />
            </div>

            {/* Pill tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {tabs.map(tab => {
                const isActive = activeTab === tab.key
                const count = counts[tab.key]
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-white text-[#0F172A] shadow-sm'
                        : 'bg-white/10 text-white border border-white/10 hover:bg-white/15'
                    }`}
                  >
                    {tab.key === 'overdue' && count > 0 && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FCA5A5] animate-pulse" />
                    )}
                    {tab.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-white/10 text-white'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
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

      {/* List */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-[22px] border border-[#E2E8F0] bg-white py-16">
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-2.5">
              <User size={20} className="text-[#1D4ED8]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Loading reminders...</p>
            <p className="text-xs text-[#94A3B8] mt-1">Fetching due follow-ups</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[22px] border border-[#E2E8F0] bg-white py-16">
            <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] flex items-center justify-center mb-2.5">
              <CheckCircle2 size={20} className="text-[#16A34A]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">All clear</p>
            <p className="text-xs text-[#94A3B8] mt-1">No reminders in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {visibleReminders.map(reminder => {
              const uiStatus = statusToUI(reminder.status)
              const sc = statusCfg[uiStatus] || statusCfg.upcoming
              const pc = priorityCfg[(reminder.priority || 'low') as ReminderPriority] || priorityCfg.low
              const isDone = doneIds.has(reminder._id)
              const dueDate = new Date(reminder.dueAt)

              return (
                <div
                  key={reminder._id}
                  className={`bg-white rounded-[22px] border border-[#E2E8F0] overflow-hidden transition-all duration-300 ${
                    isDone ? 'opacity-30 scale-[0.99] pointer-events-none' : 'hover:shadow-sm hover:-translate-y-px'
                  }`}
                >
                  <div className="flex items-stretch h-full">
                    {/* Status bar */}
                    <div className="w-1 shrink-0 rounded-l-[22px]" style={{ background: sc.bar }} />

                    {/* Main content */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="px-3.5 py-3.5 border-b border-[#E2E8F0]" style={{ background: `${sc.dot}0D` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: sc.text, background: `${sc.dot}15` }}>
                              <span className={`w-1.5 h-1.5 rounded-full ${reminder.status === 'overdue' ? 'animate-pulse' : ''}`} style={{ background: sc.dot }} />
                              {sc.label}
                            </div>
                            <p className="mt-3 text-base font-extrabold text-[#0F172A] truncate">{reminder.leadName}</p>
                            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-[#475569] break-words line-clamp-2">{reminder.title}</p>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: pc.bg, color: pc.text }}>
                            {(reminder.priority || 'low').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="px-3.5 py-3.5 flex flex-col gap-3 flex-1">
                        {/* LEFT: status dot + name + action */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                              <Clock size={12} className="text-[#64748B]" />
                              Due at
                            </div>
                            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#0F172A] whitespace-nowrap">
                              {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#64748B] font-semibold whitespace-nowrap">
                              {dueDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                              <User size={12} className="text-[#64748B]" />
                              Owner
                            </div>
                            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#475569] break-words line-clamp-2">{reminder.ownerName}</p>
                          </div>
                        </div>

                        {/* CENTER: notes */}
                        <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 min-h-[88px]">
                          <p className="text-[11px] font-bold text-[#0F172A] uppercase tracking-[0.14em]">Notes</p>
                          <p className="mt-2 text-xs sm:text-sm leading-5 text-[#475569] break-words line-clamp-3">
                            {reminder.notes?.trim() || 'No notes added for this reminder.'}
                          </p>
                        </div>

                        {/* RIGHT: meta + actions */}
                        <div className="flex flex-col gap-3 mt-auto">
                          {/* Owner */}
                          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Queue state</span>
                              <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.text, background: sc.dot + '18' }}>
                                {sc.label}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#475569] leading-5">
                              {reminder.status !== 'completed' ? 'Ready for follow-through' : 'Already completed'}
                            </p>
                          </div>

                          {/* Due date */}
                          {/* Buttons */}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {reminder.status !== 'completed' && !isDone ? (
                              <button
                                onClick={() => markDone(reminder._id)}
                                className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] hover:bg-[#DCFCE7] transition-colors"
                              >
                                <CheckCircle2 size={13} /> Mark done
                              </button>
                            ) : reminder.status === 'completed' ? (
                              <span className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]">
                                <CheckCircle2 size={13} /> Completed
                              </span>
                            ) : null}

                            <button
                              onClick={() => navigate(`/leads/${reminder.lead}`)}
                              className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                            >
                              Open lead <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && orderedReminders.length > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E2E8F0] bg-white px-3 py-2.5">
            <div className="text-[11px] sm:text-xs font-semibold text-[#64748B]">
              Showing <span className="text-[#0F172A] font-bold">{Math.min((page - 1) * REMINDERS_PAGE_SIZE + 1, orderedReminders.length)}</span>
              {' '}-{' '}
              <span className="text-[#0F172A] font-bold">{Math.min(page * REMINDERS_PAGE_SIZE, orderedReminders.length)}</span>
              {' '}of{' '}
              <span className="text-[#0F172A] font-bold">{orderedReminders.length}</span>
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
    </div>
  )
}

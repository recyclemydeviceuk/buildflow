import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, ChevronRight, User, Search } from 'lucide-react'
import { remindersAPI, type Reminder, type ReminderPriority } from '../api/reminders'

type UIReminderStatus = 'overdue' | 'due-soon' | 'upcoming' | 'completed'
type TabKey = UIReminderStatus | 'all'

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

export default function ReminderCenter() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  const statusToUI = (status: Reminder['status']): UIReminderStatus => {
    if (status === 'due_soon') return 'due-soon'
    return status
  }

  const statusToBackend = (uiStatus: UIReminderStatus): Reminder['status'] => {
    if (uiStatus === 'due-soon') return 'due_soon'
    return uiStatus
  }

  const fetchReminders = async () => {
    setLoading(true)
    try {
      const res = await remindersAPI.getReminders({ page: '1', limit: '100' })
      if (res.success) setReminders(res.data)
    } finally {
      setLoading(false)
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

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">Reminders</h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {counts.overdue > 0
                ? `${counts.overdue} overdue · ${counts['due-soon']} due soon`
                : counts['due-soon'] > 0 ? `${counts['due-soon']} due soon` : 'All on schedule'}
            </p>
          </div>
          {counts.overdue > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
              <span className="text-xs font-bold text-[#DC2626]">{counts.overdue} overdue</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lead name, title or notes..."
            className="w-full pl-8 pr-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs placeholder-[#94A3B8] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
          />
        </div>

        {/* Pill tabs */}
        <div className="flex items-center gap-1">
          {tabs.map(tab => {
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
                {tab.key === 'overdue' && count > 0 && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                )}
                {tab.label}
                {count > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' :
                    tab.key === 'overdue' ? 'bg-[#FEF2F2] text-[#DC2626]' :
                    'bg-[#F1F5F9] text-[#64748B]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="px-4 py-3 max-w-5xl space-y-1.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-3">
              <User size={24} className="text-[#1D4ED8]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Loading reminders...</p>
            <p className="text-xs text-[#94A3B8] mt-1">Fetching due follow-ups</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-[#16A34A]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">All clear</p>
            <p className="text-xs text-[#94A3B8] mt-1">No reminders in this category.</p>
          </div>
        ) : filtered.map(reminder => {
          const uiStatus = statusToUI(reminder.status)
          const sc = statusCfg[uiStatus] || statusCfg.upcoming
          const pc = priorityCfg[(reminder.priority || 'low') as ReminderPriority] || priorityCfg.low
          const isDone = doneIds.has(reminder._id)
          const dueDate = new Date(reminder.dueAt)

          return (
            <div
              key={reminder._id}
              className={`bg-white rounded-xl border border-[#E2E8F0] overflow-hidden transition-all duration-300 ${
                isDone ? 'opacity-30 scale-[0.99] pointer-events-none' : 'hover:shadow-sm hover:-translate-y-px'
              }`}
            >
              <div className="flex items-stretch">
                {/* Status bar */}
                <div className="w-1 shrink-0 rounded-l-xl" style={{ background: sc.bar }} />

                {/* Main content */}
                <div className="flex-1 flex items-center gap-3 px-3 py-2 min-w-0">

                  {/* LEFT: status dot + name + action */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full block ${reminder.status === 'overdue' ? 'animate-pulse' : ''}`}
                        style={{ background: sc.dot }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0F172A] leading-tight truncate">{reminder.leadName}</p>
                      <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">{reminder.title}</p>
                    </div>
                  </div>

                  {/* CENTER: notes */}
                  {reminder.notes ? (
                    <div className="hidden xl:block flex-1 min-w-0 px-4 border-l border-r border-[#F1F5F9]">
                      <p className="text-xs text-[#94A3B8] italic truncate">"{reminder.notes}"</p>
                    </div>
                  ) : (
                    <div className="hidden xl:block flex-1" />
                  )}

                  {/* RIGHT: meta + actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Owner */}
                    <div className="hidden lg:flex items-center gap-1.5">
                      <User size={10} className="text-[#CBD5E1]" />
                      <span className="text-[11px] text-[#94A3B8] font-medium">{reminder.ownerName}</span>
                    </div>

                    {/* Due date */}
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} className="text-[#CBD5E1]" />
                      <span className="text-[11px] text-[#64748B] font-medium whitespace-nowrap">
                        {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' '}
                        {dueDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Priority */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.text }}>
                      {(reminder.priority || 'low').toUpperCase()}
                    </span>

                    {/* Status chip */}
                    <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.text, background: sc.dot + '18' }}>
                      {sc.label}
                    </span>

                    {/* Buttons */}
                    {reminder.status !== 'completed' && !isDone ? (
                      <button
                        onClick={() => markDone(reminder._id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] hover:bg-[#DCFCE7] transition-colors"
                      >
                        <CheckCircle2 size={12} /> Done
                      </button>
                    ) : reminder.status === 'completed' ? (
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]">
                        <CheckCircle2 size={12} /> Done
                      </span>
                    ) : null}

                    <button
                      onClick={() => navigate(`/leads/${reminder.lead}`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                    >
                      Open <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Users, UserPlus, RotateCcw, XCircle, ChevronRight, Flame, Search } from 'lucide-react'
import { queueAPI, type QueueItem, type QueueSegment } from '../api/queue'
import { teamAPI, type TeamMember } from '../api/team'

const segments: Array<'All' | QueueSegment> = ['All', 'Timed Out', 'Skipped', 'Unassigned', 'Escalated']

const urgencyConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  high: { label: 'High', color: '#F59E0B', bg: '#FFFBEB' },
  medium: { label: 'Medium', color: '#1D4ED8', bg: '#EFF6FF' },
}

const reasonConfig: Record<string, { label: string; color: string }> = {
  'timed-out': { label: 'Timed Out', color: '#DC2626' },
  skipped: { label: 'Skipped', color: '#F59E0B' },
  unassigned: { label: 'Unassigned', color: '#94A3B8' },
  escalated: { label: 'Escalated', color: '#7C3AED' },
}

export default function ManagerQueue() {
  const navigate = useNavigate()
  const [activeSegment, setActiveSegment] = useState<'All' | QueueSegment>('All')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [held, setHeld] = useState<Set<string>>(new Set())

  const [queueItemsRaw, setQueueItemsRaw] = useState<QueueItem[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignToId, setAssignToId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const formatAge = (createdAtISO: string) => {
    const ms = Date.now() - new Date(createdAtISO).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 48) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return `${days}d`
  }

  const normalizedQueueItems = useMemo(() => {
    const reasonBySegment: Record<QueueSegment, keyof typeof reasonConfig> = {
      'Timed Out': 'timed-out',
      'Skipped': 'skipped',
      'Unassigned': 'unassigned',
      'Escalated': 'escalated',
    }

    const urgencyToKey = (urgency: number): keyof typeof urgencyConfig => {
      if (urgency >= 2) return 'critical'
      return 'medium'
    }

    return queueItemsRaw.map((q) => {
      const ownerHistory = [q.assignedToName, q.offeredToName].filter(Boolean) as string[]
      return {
        id: q._id,
        leadId: q.leadId,
        leadName: q.leadName,
        city: q.city,
        source: q.source,
        urgency: urgencyToKey(q.urgency),
        reason: reasonBySegment[q.segment],
        age: formatAge(q.createdAt),
        skipCount: q.skipCount,
        ownerHistory: ownerHistory.length ? ownerHistory : ['System'],
      }
    })
  }, [queueItemsRaw])

  const selectedAgent = useMemo(() => teamMembers.find((m) => m.id === assignToId), [teamMembers, assignToId])

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const segment = activeSegment === 'All' ? undefined : activeSegment
      const res = await queueAPI.getQueue({ segment, page: '1', limit: '50' })
      if (res.success) setQueueItemsRaw(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await teamAPI.getTeamMembers()
        if (res.success) {
          setTeamMembers(res.data)
          setAssignToId((prev) => prev || (res.data[0]?.id ?? ''))
        }
      } catch (err) {
        console.error('Failed to fetch team members:', err)
      }
    }
    fetchTeam()
  }, [])

  useEffect(() => {
    // Clear selection when segment changes so UI doesn't point to stale items.
    setSelectedItem(null)
    setAssigned(new Set())
    setHeld(new Set())
    fetchQueue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegment])

  const filtered = normalizedQueueItems.filter((q) => {
    if (activeSegment === 'Timed Out' && q.reason !== 'timed-out') return false
    if (activeSegment === 'Skipped' && q.reason !== 'skipped') return false
    if (activeSegment === 'Unassigned' && q.reason !== 'unassigned') return false
    if (activeSegment === 'Escalated' && q.reason !== 'escalated') return false
    if (assigned.has(q.id)) return false
    if (search) {
      const q2 = search.toLowerCase()
      return q.leadName?.toLowerCase().includes(q2) ||
        q.city?.toLowerCase().includes(q2) ||
        q.source?.toLowerCase().includes(q2)
    }
    return true
  })

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Manager Queue</h1>
            <p className="text-xs text-[#475569] mt-0.5">
              {filtered.length} lead{filtered.length !== 1 ? 's' : ''} awaiting action
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
            <Flame size={12} className="text-[#DC2626]" />
            <span className="text-xs font-semibold text-[#DC2626]">{normalizedQueueItems.filter(q => q.urgency === 'critical').length} Critical</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lead name, city or source..."
            className="w-full pl-8 pr-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs placeholder-[#94A3B8] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
          />
        </div>

        {/* Segment tabs */}
        <div className="flex items-center gap-1">
          {segments.map(seg => (
            <button
              key={seg}
              onClick={() => setActiveSegment(seg)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeSegment === seg ? 'bg-[#1D4ED8] text-white' : 'text-[#475569] hover:bg-[#F1F5F9]'
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-0">
        {/* Queue list */}
        <div className="flex-1 p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
                <Users size={24} className="text-[#1D4ED8]" />
              </div>
              <p className="text-[#0F172A] font-semibold">Loading queue...</p>
              <p className="text-sm text-[#94A3B8] mt-1">Fetching latest leads waiting for action</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-4">
                <Users size={24} className="text-[#16A34A]" />
              </div>
              <p className="text-[#0F172A] font-semibold">Queue is clear</p>
              <p className="text-sm text-[#94A3B8] mt-1">No leads waiting for attention in this segment.</p>
            </div>
          ) : filtered.map(item => {
            const uc = urgencyConfig[item.urgency]
            const rc = reasonConfig[item.reason]
            const isSelected = selectedItem === item.id
            const isHeld = held.has(item.id)

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border transition-all cursor-pointer ${
                  isSelected ? 'border-[#1D4ED8] shadow-md' : 'border-[#E2E8F0] hover:shadow-sm'
                } ${isHeld ? 'opacity-60' : ''}`}
                onClick={() => setSelectedItem(isSelected ? null : item.id)}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {/* Urgency indicator */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: uc.bg }}>
                      <AlertTriangle size={14} style={{ color: uc.color }} />
                    </div>

                    {/* Lead info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-[#0F172A]">{item.leadName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[#475569]">{item.city} · {item.source}</span>
                            <span className="text-[10px] font-semibold" style={{ color: rc.color }}>{rc.label}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: uc.bg, color: uc.color }}>
                            {uc.label}
                          </span>
                          <div className="flex items-center gap-1.5 justify-end mt-1.5">
                            <Clock size={11} className="text-[#94A3B8]" />
                            <span className="text-xs text-[#94A3B8]">In queue: {item.age}</span>
                          </div>
                        </div>
                      </div>

                      {/* Skip history */}
                      {item.skipCount > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-[#DC2626] font-medium">{item.skipCount} skip{item.skipCount > 1 ? 's' : ''}</span>
                          <div className="flex items-center gap-1">
                            {item.ownerHistory.map((owner, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#F1F5F9] text-[#475569] rounded">
                                {owner.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded actions */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <select
                          className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                          onClick={e => e.stopPropagation()}
                          value={assignToId}
                          onChange={(e) => setAssignToId(e.target.value)}
                        >
                          <option value="">Assign to...</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={!selectedAgent}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!selectedAgent) return
                            await queueAPI.assignQueueItem(item.id, {
                              assignedTo: selectedAgent.id,
                              assignedName: selectedAgent.name,
                            })
                            setAssigned(prev => new Set(prev).add(item.id))
                            setSelectedItem(null)
                            fetchQueue()
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <UserPlus size={13} /> Assign
                        </button>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await queueAPI.requeueItem(item.id)
                          setAssigned(prev => new Set(prev).add(item.id))
                          setSelectedItem(null)
                          fetchQueue()
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] text-xs font-semibold rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <RotateCcw size={13} /> Re-queue
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const holdUntilISO = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
                          await queueAPI.holdQueueItem(item.id, holdUntilISO)
                          setHeld(prev => new Set(prev).add(item.id))
                          setSelectedItem(null)
                          fetchQueue()
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#FFFBEB] border border-[#FDE68A] text-[#F59E0B] text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        <Clock size={13} /> Hold
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const reason = window.prompt('Invalid reason (optional):', 'Invalid') || 'Invalid'
                          await queueAPI.markInvalid(item.id, reason)
                          setAssigned(prev => new Set(prev).add(item.id))
                          setSelectedItem(null)
                          fetchQueue()
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#94A3B8] text-xs font-semibold rounded-lg hover:bg-[#F1F5F9] transition-colors"
                      >
                        <XCircle size={13} /> Mark Invalid
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/leads/${item.leadId}`) }}
                        className="ml-auto flex items-center gap-1 px-3 py-2 text-[#1D4ED8] text-xs font-semibold bg-[#EFF6FF] rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        View Lead <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right context panel */}
        <div className="w-64 border-l border-[#E2E8F0] bg-white p-5 space-y-5 shrink-0">
          <div>
            <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide mb-3">Queue Stats</p>
            <div className="space-y-3">
              {[
                { label: 'Critical', value: normalizedQueueItems.filter(q => q.urgency === 'critical').length, color: '#DC2626', bg: '#FEF2F2' },
                { label: 'Medium Priority', value: normalizedQueueItems.filter(q => q.urgency === 'medium').length, color: '#1D4ED8', bg: '#EFF6FF' },
                { label: 'Timed Out', value: normalizedQueueItems.filter(q => q.reason === 'timed-out').length, color: '#DC2626', bg: '#FEF2F2' },
                { label: 'Skipped 2+', value: normalizedQueueItems.filter(q => q.skipCount >= 2).length, color: '#7C3AED', bg: '#F5F3FF' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: stat.bg }}>
                  <p className="text-xs font-medium" style={{ color: stat.color }}>{stat.label}</p>
                  <p className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-bold text-[#0F172A] uppercase tracking-wide mb-3">Guidelines</p>
            <div className="space-y-2">
              {[
                'Assign critical leads immediately',
                'Leads idle >60 min need escalation',
                'Check skip history before re-routing',
                'Mark invalid only after verification',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[8px] font-bold text-[#1D4ED8]">{i + 1}</span>
                  </div>
                  <p className="text-[10px] text-[#475569] leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

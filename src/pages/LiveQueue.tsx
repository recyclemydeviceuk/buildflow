import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, MapPin, RefreshCw, Users, Zap, ArrowUpRight } from 'lucide-react'
import { queueAPI, type QueueItem } from '../api/queue'
import { teamAPI, type TeamMember } from '../api/team'

function formatAge(createdAtISO: string) {
  const ms = Date.now() - new Date(createdAtISO).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function urgencyChip(urgency: number) {
  if (urgency >= 2) return { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' }
  return { label: 'Medium', color: '#1D4ED8', bg: '#EFF6FF' }
}

export default function LiveQueue() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignToId, setAssignToId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const selectedAgent = useMemo(() => teamMembers.find((m) => m.id === assignToId), [teamMembers, assignToId])

  const fetchLiveQueue = async () => {
    setLoading(true)
    try {
      const res = await queueAPI.getLiveQueue()
      if (res.success) setQueue(res.data)
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
    fetchLiveQueue()
    const t = setInterval(fetchLiveQueue, 10000) // refresh every 10s
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight">Live Queue</h1>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full text-[10px] font-bold text-[#16A34A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-sm text-[#64748B]">{queue.length} waiting for assignment</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <RefreshCw size={11} />
              <span>Auto-refresh</span>
            </div>
            <select
              value={assignToId}
              onChange={(e) => setAssignToId(e.target.value)}
              className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            >
              <option value="">Select rep...</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => navigate('/leads')}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1D4ED8] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all hover:-translate-y-px"
            >
              <Users size={13} /> All Leads
            </button>
          </div>
        </div>
      </div>

      {/* Queue list */}
      <div className="px-8 py-5 max-w-5xl space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-3">
              <Users size={24} className="text-[#1D4ED8]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Loading live queue...</p>
            <p className="text-xs text-[#94A3B8] mt-1">Pulling latest unassigned leads</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-[#16A34A]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Queue is clear</p>
            <p className="text-xs text-[#94A3B8] mt-1">No leads waiting right now.</p>
          </div>
        ) : (
          queue.map((item, idx) => {
            const uc = urgencyChip(item.urgency)
            return (
              <div
                key={item._id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${
                  item.urgency >= 2 ? 'border-[#FECACA]' : 'border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-stretch">
                  <div className="w-12 shrink-0 flex items-center justify-center border-r border-[#F1F5F9]">
                    <span className="text-xs font-bold text-[#94A3B8]">#{idx + 1}</span>
                  </div>

                  <div className="flex-1 flex items-center gap-4 px-5 py-3.5 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 w-52">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-[#EFF6FF] text-[#1D4ED8]">
                        {item.leadName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0F172A] truncate">{item.leadName}</p>
                        <p className="text-[11px] text-[#94A3B8]">{item.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={10} className="text-[#CBD5E1] shrink-0" />
                        <span className="text-xs text-[#475569] font-medium">{item.city}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: item.source === 'Meta' ? '#1877F2' : item.source === 'Google' ? '#EA4335' : item.source === 'Website' ? '#16A34A' : '#94A3B8' }} />
                        <span className="text-xs text-[#64748B]">{item.source}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 w-24">
                        <Clock size={10} className={item.urgency >= 2 ? 'text-[#DC2626]' : 'text-[#CBD5E1]'} />
                        <span className={`text-xs font-semibold ${item.urgency >= 2 ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
                          {formatAge(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    <span
                      className="shrink-0 flex items-center gap-2 text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: uc.bg, color: uc.color }}
                    >
                      {uc.label}
                      {item.skipCount > 0 && (
                        <span className="ml-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/40">
                          {item.skipCount} skip{item.skipCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={!selectedAgent}
                        onClick={async () => {
                          if (!selectedAgent) return
                          await queueAPI.assignQueueItem(item._id, { assignedTo: selectedAgent.id, assignedName: selectedAgent.name })
                          await fetchLiveQueue()
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1D4ED8] text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap size={11} /> Assign
                      </button>

                      <button
                        onClick={async () => {
                          await queueAPI.skipQueueItem(item._id)
                          await fetchLiveQueue()
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] hover:bg-red-100 transition-colors"
                      >
                        <AlertTriangle size={11} /> Escalate
                      </button>

                      <button
                        onClick={() => navigate(`/leads/${item.leadId}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9] transition-colors"
                      >
                        View <ArrowUpRight size={11} />
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

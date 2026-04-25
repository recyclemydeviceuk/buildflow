import { useState, useEffect, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useFeatureControls } from '../../context/FeatureControlsContext'
import type { Call } from '../../api/calls'
import { followUpsAPI, type FollowUpRecord } from '../../api/followUps'
import { leadsAPI } from '../../api/leads'
import { PhoneIncoming, ArrowUpRight, CalendarClock, CheckCircle2, Clock3, UserCheck, Phone, MapPin } from 'lucide-react'

type PendingAssignment = {
  leadId: string
  leadName: string
  phone?: string
  city?: string
  source?: string
  disposition?: string
}

export default function Layout() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const featureControls = useFeatureControls()
  const [incomingCall, setIncomingCall] = useState<Call | null>(null)
  const [followUpPopup, setFollowUpPopup] = useState<FollowUpRecord | null>(null)
  const [assignmentQueue, setAssignmentQueue] = useState<PendingAssignment[]>([])
  const [assignmentResponding, setAssignmentResponding] = useState(false)
  const [demoToast, setDemoToast] = useState<string | null>(null)

  // Listen for demo-blocked events dispatched by the axios response interceptor
  // (api/client.ts) whenever the backend rejects a write because the account is
  // view-only. Surfaces a transient toast in the corner.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      setDemoToast(detail.message || 'Demo account is view-only.')
      window.setTimeout(() => setDemoToast(null), 4000)
    }
    window.addEventListener('buildflow:demo-blocked', handler as EventListener)
    return () => window.removeEventListener('buildflow:demo-blocked', handler as EventListener)
  }, [])

  const currentAssignment = assignmentQueue[0] ?? null

  const pushAssignment = useCallback((item: PendingAssignment) => {
    setAssignmentQueue((prev) => {
      if (prev.some((a) => a.leadId === item.leadId)) return prev
      return [...prev, item]
    })
  }, [])

  const popAssignment = useCallback(() => {
    setAssignmentQueue((prev) => prev.slice(1))
  }, [])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
      return next
    })
  }

  // Fetch any pending assignments on mount (for page reload persistence)
  useEffect(() => {
    if (!user?.id || user.role !== 'representative') return

    leadsAPI.getPendingAssignments().then((res) => {
      if (res.success && res.data.length) {
        res.data.forEach(pushAssignment)
      }
    }).catch(() => null)
  }, [user?.id, user?.role, pushAssignment])

  useEffect(() => {
    if (!socket) return

    const handleAssigned = (data: { leadId: string; leadName?: string; assignedTo: string; assignedToName: string }) => {
      if (data.assignedTo === user?.id) {
        pushAssignment({ leadId: data.leadId, leadName: data.leadName || 'New Lead' })
      }
    }

    const handleCallEvent = (call: Call) => {
      const representativeId = typeof call.representative === 'string' ? call.representative : String(call.representative)
      const shouldShowForUser = user?.role === 'manager' || representativeId === user?.id

      if (call.direction === 'incoming' && shouldShowForUser && ['initiated', 'ringing', 'in-progress'].includes(call.status)) {
        setIncomingCall(call)
      } else if (incomingCall?._id === call._id && !['initiated', 'ringing', 'in-progress'].includes(call.status)) {
        setIncomingCall(call)
      }
    }

    socket.on('lead:assigned', handleAssigned)
    socket.on('call:new', handleCallEvent)
    socket.on('call:status_updated', handleCallEvent)

    return () => {
      socket.off('lead:assigned', handleAssigned)
      socket.off('call:new', handleCallEvent)
      socket.off('call:status_updated', handleCallEvent)
    }
  }, [socket, user?.id, user?.role, incomingCall?._id, pushAssignment])

  useEffect(() => {
    if (user?.role !== 'representative' || !featureControls.followUpReminders) {
      setFollowUpPopup(null)
      return
    }

    let isMounted = true
    let autoHideTimeoutId: number | null = null

    const clearAutoHide = () => {
      if (autoHideTimeoutId) {
        window.clearTimeout(autoHideTimeoutId)
        autoHideTimeoutId = null
      }
    }

    const showPopup = (nextFollowUp: FollowUpRecord | null) => {
      if (!isMounted || !nextFollowUp) return

      setFollowUpPopup(nextFollowUp)
      clearAutoHide()
      autoHideTimeoutId = window.setTimeout(() => {
        setFollowUpPopup((current) => (current?._id === nextFollowUp._id ? null : current))
      }, 30000)
    }

    const fetchNextPopup = async () => {
      if (!isMounted || followUpPopup) return

      try {
        const response = await followUpsAPI.getNextPopup()
        if (response.success && response.data) {
          showPopup(response.data)
        }
      } catch (error) {
        console.error('Failed to fetch follow-up popup:', error)
      }
    }

    void fetchNextPopup()

    const pollIntervalId = window.setInterval(() => {
      void fetchNextPopup()
    }, 60000)

    const handleFocus = () => {
      void fetchNextPopup()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchNextPopup()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      clearAutoHide()
      window.clearInterval(pollIntervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [followUpPopup, user?.role, featureControls.followUpReminders])

  const handleAcknowledgeAssignment = async (openLead = false) => {
    if (!currentAssignment || assignmentResponding) return
    const leadId = currentAssignment.leadId
    try {
      setAssignmentResponding(true)
      // Optimistically remove from queue so the popup closes immediately
      popAssignment()
      // Fire-and-forget — acknowledge on backend so the popup doesn't come back on reload
      leadsAPI.respondToAssignment(leadId, 'accept').catch((err) => {
        console.error('Failed to acknowledge assignment:', err)
      })
      if (openLead) {
        navigate(`/leads/${leadId}`)
      }
    } finally {
      setAssignmentResponding(false)
    }
  }

  const handleConfirmFollowUpPopup = async () => {
    if (!followUpPopup) return

    try {
      await followUpsAPI.confirmPopup(followUpPopup._id)
      setFollowUpPopup(null)
    } catch (error) {
      console.error('Failed to confirm follow-up popup:', error)
    }
  }

  const handleSkipFollowUpPopup = async () => {
    if (!followUpPopup) return

    try {
      await followUpsAPI.skipPopup(followUpPopup._id)
      setFollowUpPopup(null)
    } catch (error) {
      console.error('Failed to skip follow-up popup:', error)
    }
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Demo blocked toast — bottom-center, fades automatically after 4s */}
      {demoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-xl bg-[#0F172A] text-white text-sm font-semibold shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          {demoToast}
        </div>
      )}
      <Sidebar role={user?.role || 'representative'} collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-[56px]' : 'ml-[200px]'}`}>
        {/* Demo / read-only banner. Always visible at the top of every page when
            the logged-in user is flagged as a demo account. The backend rejects
            every non-GET request for these users, so this banner is our chance
            to explain the restriction up front. */}
        {user?.isDemo && (
          <div className="sticky top-0 z-[60] bg-gradient-to-r from-[#F59E0B] via-[#F97316] to-[#EF4444] text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 shadow-md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>DEMO MODE</span>
            <span className="opacity-90 font-medium">— You're viewing BuildFlow in read-only mode. Editing, deleting, and creating are disabled.</span>
          </div>
        )}
        <Outlet />
      </main>

      {incomingCall && (
        <div className="fixed bottom-5 right-5 z-50 w-[360px] rounded-3xl border border-[#BFDBFE] bg-white shadow-2xl overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#EFF6FF] to-white border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <PhoneIncoming size={18} className="text-[#1D4ED8]" />
              <p className="text-sm font-bold text-[#0F172A]">Incoming Call</p>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              BuildFlow detected a live incoming call. Answer on the linked phone and use the CRM for context.
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-base font-bold text-[#0F172A]">{incomingCall.leadName}</p>
            <p className="text-sm text-[#64748B] mt-1">{incomingCall.phone}</p>
            <p className="text-xs text-[#94A3B8] mt-1">{incomingCall.representativeName}</p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => navigate('/dialer')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Open Dialer
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={() => setIncomingCall(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] rounded-xl hover:bg-[#F8FAFC] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {currentAssignment && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[6px] flex items-center justify-center p-4"
          onClick={() => handleAcknowledgeAssignment(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-3xl border border-[#BFDBFE] bg-white shadow-[0_32px_96px_rgba(15,23,42,0.4)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Header */}
            <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-[#EFF6FF] via-[#F0F7FF] to-white border-b border-[#DBEAFE]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-sm">
                    <UserCheck size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">New Lead Assigned</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">This lead has been added to your pipeline</p>
                  </div>
                </div>
                {assignmentQueue.length > 1 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[10px] font-bold">
                    +{assignmentQueue.length - 1} more
                  </span>
                )}
              </div>
            </div>

            {/* Lead info */}
            <div className="px-5 py-4">
              <p className="text-lg font-bold text-[#0F172A] leading-snug">{currentAssignment.leadName}</p>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {currentAssignment.phone && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#475569]">
                    <Phone size={11} className="text-[#94A3B8]" />
                    {currentAssignment.phone}
                  </span>
                )}
                {currentAssignment.city && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#475569]">
                    <MapPin size={11} className="text-[#94A3B8]" />
                    {currentAssignment.city}
                  </span>
                )}
              </div>

              {(currentAssignment.source || currentAssignment.disposition) && (
                <div className="flex items-center gap-2 mt-2">
                  {currentAssignment.source && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[10px] font-semibold">
                      {currentAssignment.source}
                    </span>
                  )}
                  {currentAssignment.disposition && (
                    <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-semibold border border-[#DBEAFE]">
                      {currentAssignment.disposition}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2.5 mt-4">
                <button
                  onClick={() => handleAcknowledgeAssignment(true)}
                  disabled={assignmentResponding}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ArrowUpRight size={14} />
                  View Lead
                </button>
                <button
                  onClick={() => handleAcknowledgeAssignment(false)}
                  disabled={assignmentResponding}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] rounded-xl hover:bg-[#F8FAFC] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={14} />
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {followUpPopup && (
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[6px] flex items-center justify-center p-4">
          <div className="w-full max-w-[420px] rounded-3xl border border-[#FED7AA] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#FFF7ED] to-white border-b border-[#FFEDD5]">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-[#D97706]" />
                <p className="text-sm font-bold text-[#0F172A]">Follow-up Due In 30 Minutes</p>
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Confirm this follow-up now, or skip it for five minutes. If it is still pending after the scheduled time, it will stay in ignored follow-ups until completed.
              </p>
            </div>

            <div className="px-5 py-4">
              <p className="text-base font-bold text-[#0F172A]">{followUpPopup.leadName}</p>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={12} />
                  {new Date(followUpPopup.scheduledAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  {new Date(followUpPopup.scheduledAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span>Owner: {followUpPopup.ownerName}</span>
              </div>

              {followUpPopup.notes ? (
                <div className="mt-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2">
                  <p className="text-xs text-[#475569]">{followUpPopup.notes}</p>
                </div>
              ) : null}

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  onClick={handleConfirmFollowUpPopup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#16A34A] text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 size={14} />
                  Confirm
                </button>
                <button
                  onClick={handleSkipFollowUpPopup}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] rounded-xl hover:bg-[#F8FAFC] transition-colors"
                >
                  Skip For Now
                </button>
                <button
                  onClick={() => navigate(`/leads/${followUpPopup.lead}`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#BFDBFE] bg-[#EFF6FF] text-sm font-semibold text-[#1D4ED8] rounded-xl hover:bg-[#DBEAFE] transition-colors"
                >
                  Open Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

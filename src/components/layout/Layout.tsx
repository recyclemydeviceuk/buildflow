import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import type { Call } from '../../api/calls'
import { followUpsAPI, type FollowUpRecord } from '../../api/followUps'
import { PhoneIncoming, ArrowUpRight, CalendarClock, CheckCircle2, Clock3 } from 'lucide-react'

export default function Layout() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [incomingCall, setIncomingCall] = useState<Call | null>(null)
  const [followUpPopup, setFollowUpPopup] = useState<FollowUpRecord | null>(null)

  useEffect(() => {
    if (!socket) return

    socket.on('lead:assigned', (data: { leadId: string; assignedTo: string; assignedToName: string }) => {
      if (data.assignedTo === user?.id) {
        console.log('A lead has been assigned to you!')
        // Optional: show a small toast or notification
      }
    })

    const handleCallEvent = (call: Call) => {
      const representativeId = typeof call.representative === 'string' ? call.representative : String(call.representative)
      const shouldShowForUser = user?.role === 'manager' || representativeId === user?.id

      if (call.direction === 'incoming' && shouldShowForUser && ['initiated', 'ringing', 'in-progress'].includes(call.status)) {
        setIncomingCall(call)
      } else if (incomingCall?._id === call._id && !['initiated', 'ringing', 'in-progress'].includes(call.status)) {
        setIncomingCall(call)
      }
    }

    socket.on('call:new', handleCallEvent)
    socket.on('call:status_updated', handleCallEvent)

    return () => {
      socket.off('lead:assigned')
      socket.off('call:new', handleCallEvent)
      socket.off('call:status_updated', handleCallEvent)
    }
  }, [socket, user?.id, user?.role, incomingCall?._id])

  useEffect(() => {
    if (user?.role !== 'representative') {
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
  }, [followUpPopup, user?.role])

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
      <Sidebar role={user?.role || 'representative'} />
      <main className="flex-1 ml-[200px] overflow-y-auto">
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

      {followUpPopup && (
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[6px] flex items-center justify-center p-4">
          <div className="w-full max-w-[420px] rounded-3xl border border-[#FED7AA] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#FFF7ED] to-white border-b border-[#FFEDD5]">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-[#D97706]" />
                <p className="text-sm font-bold text-[#0F172A]">Follow-up Due In 30 Minutes</p>
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                Confirm this follow-up now, or skip it for five minutes. If it is still pending after the scheduled time, it will stay in overdue follow-ups until completed.
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

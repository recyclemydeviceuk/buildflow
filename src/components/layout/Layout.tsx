import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import type { Call } from '../../api/calls'
import { PhoneIncoming, ArrowUpRight } from 'lucide-react'

export default function Layout() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const [incomingCall, setIncomingCall] = useState<Call | null>(null)

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
    </div>
  )
}

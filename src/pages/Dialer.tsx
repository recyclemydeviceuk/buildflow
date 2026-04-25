import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  Search,
  Users,
  Radio,
  ArrowUpRight,
  ArrowDownLeft,
  Clock3,
  AlertCircle,
  CircleDot,
  Delete,
  Calendar,
} from 'lucide-react'
import { callsAPI, type Call } from '../api/calls'
import { leadsAPI, type Lead, type PhoneLeadLookupItem } from '../api/leads'
import { remindersAPI } from '../api/reminders'
import { settingsAPI } from '../api/settings'
import { teamAPI, type TeamMember } from '../api/team'
import CallReminderModal from '../components/reminders/CallReminderModal'
import WhatsAppIcon from '../components/common/WhatsAppIcon'
import { openWhatsAppChat, sanitizePhoneForWhatsApp } from '../utils/whatsapp'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import {
  DEFAULT_FEATURE_CONTROLS,
  FEATURE_CONTROLS_STORAGE_KEY,
  FEATURE_CONTROLS_UPDATED_EVENT,
  normalizeFeatureControls,
} from '../utils/featureControls'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  initiated: { label: 'Dialing Rep', color: '#D97706', bg: '#FFFBEB' },
  ringing: { label: 'Bridging', color: '#D97706', bg: '#FFFBEB' },
  'in-progress': { label: 'Live', color: '#2563EB', bg: '#EFF6FF' },
  completed: { label: 'Completed', color: '#16A34A', bg: '#F0FDF4' },
  'no-answer': { label: 'No Answer', color: '#DC2626', bg: '#FEF2F2' },
  busy: { label: 'Busy', color: '#D97706', bg: '#FFFBEB' },
  canceled: { label: 'Canceled', color: '#DC2626', bg: '#FEF2F2' },
  failed: { label: 'Failed', color: '#DC2626', bg: '#FEF2F2' },
}

function formatCallTime(value?: string) {
  if (!value) return 'Just now'
  return new Date(value).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const isPlaceholderCallLabel = (value?: string) =>
  Boolean(value && (/^Exotel\s+\d{4,}$/i.test(value) || /^Lead\s+\d{4,}$/i.test(value) || /^Manual\s+\d{4,}$/i.test(value)))

const getRecentCallTitle = (call: Call) => {
  if (call.direction === 'outbound') {
    return call.representativeName || call.leadName
  }

  if (isPlaceholderCallLabel(call.leadName)) {
    return call.phone
  }

  return call.leadName
}

const isIncomingExotelCall = (call: Call) => call.direction === 'incoming' && Boolean(call.exophoneNumber)

const getRecentCallSubtitle = (call: Call) => {
  if (call.direction === 'outbound') {
    return call.phone
  }

  if (call.exophoneNumber) {
    return call.exophoneNumber
  }

  return call.phone
}

type DisplayAvailability = 'available' | 'dialing' | 'in-call' | 'offline'

const getDisplayAvailability = (input?: { callAvailabilityStatus?: string | null; activeCallSid?: string | null } | null): DisplayAvailability => {
  if (input?.callAvailabilityStatus === 'offline') return 'offline'
  if (input?.callAvailabilityStatus === 'in-call') return 'in-call'
  if (input?.activeCallSid) return 'dialing'
  return 'available'
}

const displayAvailabilityMeta: Record<DisplayAvailability, { label: string; dot: string; text: string }> = {
  available: { label: 'Available', dot: '#16A34A', text: '#16A34A' },
  dialing: { label: 'Dialing', dot: '#F59E0B', text: '#D97706' },
  'in-call': { label: 'In Call', dot: '#2563EB', text: '#2563EB' },
  offline: { label: 'Offline', dot: '#94A3B8', text: '#64748B' },
}

const dialPadButtons = [
  { value: '1', letters: '' },
  { value: '2', letters: 'ABC' },
  { value: '3', letters: 'DEF' },
  { value: '4', letters: 'GHI' },
  { value: '5', letters: 'JKL' },
  { value: '6', letters: 'MNO' },
  { value: '7', letters: 'PQRS' },
  { value: '8', letters: 'TUV' },
  { value: '9', letters: 'WXYZ' },
  { value: '*', letters: '' },
  { value: '0', letters: '+' },
  { value: '#', letters: '' },
]

const normalizePhone = (value?: string | null) => {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const stripped = digits.replace(/^0+/, '')
  return stripped.length <= 10 ? stripped : stripped.slice(-10)
}

export default function Dialer() {
  const { user, updateUser } = useAuth()
  const { socket, connected } = useSocket()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [recentCalls, setRecentCalls] = useState<Call[]>([])
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedRepresentativeId, setSelectedRepresentativeId] = useState('')
  const [manualLeadName, setManualLeadName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualCity, setManualCity] = useState('')
  const [featureControls, setFeatureControls] = useState(DEFAULT_FEATURE_CONTROLS)
  const [recordCall, setRecordCall] = useState(true)
  const [micState, setMicState] = useState<'idle' | 'checking' | 'ready' | 'blocked'>('idle')
  const [callingError, setCallingError] = useState('')
  const [calling, setCalling] = useState(false)
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false)
  const [phoneLeadLookup, setPhoneLeadLookup] = useState<Record<string, PhoneLeadLookupItem>>({})
  const [reminderContext, setReminderContext] = useState<{
    leadId: string
    leadName: string
    phone?: string | null
    contextLabel?: string | null
  } | null>(null)

  useEffect(() => {
    const fetchInitialData = async () => {
      const [callsRes, teamRes, appConfigRes] = await Promise.all([
        callsAPI.getCalls({ page: '1', limit: '12' }),
        user?.role === 'manager' ? teamAPI.getTeamMembers() : Promise.resolve(null),
        settingsAPI.getAppConfig(),
      ])

      if (callsRes.success) {
        setRecentCalls(callsRes.data)
        const current = callsRes.data.find((call) => ['initiated', 'ringing', 'in-progress'].includes(call.status))
        setActiveCall(current || null)
      }

      if (teamRes?.success) {
        setTeamMembers(teamRes.data.filter((member) => member.isActive))
      }

      if (appConfigRes.success) {
        setFeatureControls(normalizeFeatureControls(appConfigRes.data.featureControls))
      }
    }

    fetchInitialData().catch((error) => {
      console.error('Failed to load dialer data:', error)
    })
  }, [user?.role])

  useEffect(() => {
    if (featureControls.callRecording) return
    setRecordCall(false)
  }, [featureControls.callRecording])

  useEffect(() => {
    const handleFeatureControlsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent
      setFeatureControls(normalizeFeatureControls(customEvent.detail))
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== FEATURE_CONTROLS_STORAGE_KEY || !event.newValue) return

      try {
        const parsed = JSON.parse(event.newValue)
        setFeatureControls(normalizeFeatureControls(parsed?.featureControls))
      } catch (error) {
        console.error('Failed to sync feature controls in dialer:', error)
      }
    }

    window.addEventListener(FEATURE_CONTROLS_UPDATED_EVENT, handleFeatureControlsUpdated as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(FEATURE_CONTROLS_UPDATED_EVENT, handleFeatureControlsUpdated as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    const leadId = searchParams.get('leadId')
    if (!leadId) return

    leadsAPI
      .getLeadById(leadId)
      .then((res) => {
        if (res.success) {
          setSelectedLead(res.data)
          setSearch(res.data.name)
          setSearchResults([res.data])
        }
      })
      .catch((error) => {
        console.error('Failed to prefill dialer lead:', error)
      })
  }, [searchParams])

  useEffect(() => {
    const phones = [...recentCalls.map((call) => call.phone), activeCall?.phone || '']
      .map((phone) => normalizePhone(phone))
      .filter(Boolean)

    const uniquePhones = [...new Set(phones)]
    if (uniquePhones.length === 0) {
      setPhoneLeadLookup({})
      return
    }

    leadsAPI.lookupByPhone(uniquePhones).then((response) => {
      if (response.success) {
        setPhoneLeadLookup(response.data)
      }
    }).catch((error) => {
      console.error('Failed to look up reminder leads:', error)
    })
  }, [recentCalls, activeCall?.phone])

  useEffect(() => {
    if (user?.role !== 'manager') {
      setSelectedRepresentativeId(user?.id || '')
      return
    }

    setSelectedRepresentativeId((current) => {
      if (current) return current
      if (user?.phone) return user.id
      return teamMembers[0]?.id || ''
    })
  }, [teamMembers, user?.id, user?.phone, user?.role])

  useEffect(() => {
    if (!search.trim() || selectedLead?.name === search.trim()) {
      return
    }

    const timeout = setTimeout(async () => {
      try {
        setSearching(true)
        const response = await leadsAPI.getLeads({ search: search.trim(), page: '1', limit: '8' })
        if (response.success) {
          setSearchResults(response.data)
        }
      } catch (error) {
        console.error('Failed to search leads:', error)
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [search, selectedLead?.name])

  useEffect(() => {
    if (!socket || !connected) return

    const handleCallEvent = (event: Call) => {
      setRecentCalls((current) => {
        const next = [...current]
        const index = next.findIndex((item) => item._id === event._id)
        if (index >= 0) {
          next[index] = { ...next[index], ...event }
          return next
        }
        return [event, ...next].slice(0, 12)
      })

      setActiveCall((current) => {
        if (['initiated', 'ringing', 'in-progress'].includes(event.status)) {
          return event
        }
        if (current?._id === event._id) {
          return null
        }
        return current
      })
    }

    const handleAvailabilityUpdate = (payload: any) => {
      setTeamMembers((current) =>
        current.map((member) =>
          member.id === String(payload?.id)
            ? {
                ...member,
                phone: payload.phone ?? member.phone,
                callAvailabilityStatus: payload.callAvailabilityStatus || member.callAvailabilityStatus,
                callDeviceMode: payload.callDeviceMode || member.callDeviceMode,
                activeCallSid: payload.activeCallSid ?? member.activeCallSid ?? null,
                isActive: payload.isActive ?? member.isActive,
              }
            : member
        )
      )
    }

    socket.on('call:new', handleCallEvent)
    socket.on('call:status_updated', handleCallEvent)
    socket.on('user:availability_updated', handleAvailabilityUpdate)

    return () => {
      socket.off('call:new', handleCallEvent)
      socket.off('call:status_updated', handleCallEvent)
      socket.off('user:availability_updated', handleAvailabilityUpdate)
    }
  }, [socket, connected])

  useEffect(() => {
    if (!activeCall?.exotelCallSid || !['initiated', 'ringing', 'in-progress'].includes(activeCall.status)) {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await callsAPI.syncCall(activeCall.exotelCallSid!)
        const updatedCall = response.data
        if (!updatedCall) return

        setRecentCalls((current) => {
          const next = [...current]
          const index = next.findIndex((item) => item._id === updatedCall._id)
          if (index >= 0) {
            next[index] = { ...next[index], ...updatedCall }
            return next
          }
          return [updatedCall, ...next].slice(0, 12)
        })

        setActiveCall((current) => {
          if (['initiated', 'ringing', 'in-progress'].includes(updatedCall.status)) {
            return updatedCall
          }
          if (current?._id === updatedCall._id) {
            return null
          }
          return current
        })
      } catch (error) {
        console.error('Failed to sync active call status:', error)
      }
    }, 8000)

    return () => window.clearInterval(interval)
  }, [activeCall?.exotelCallSid, activeCall?.status])

  const representativeOptions = useMemo(() => {
    const selfOption =
      user?.id && user?.role === 'manager'
        ? [
            {
              id: user.id,
              name: 'My phone',
              phone: user.phone || '',
              callAvailabilityStatus: user.callAvailabilityStatus || 'available',
              activeCallSid: user.activeCallSid || null,
              role: user.role,
            },
          ]
        : []

    const repOptions = teamMembers
      .filter((member) => member.role === 'representative' || member.role === 'manager')
      .map((member) => ({
        id: member.id,
        name: member.name,
        phone: member.phone || '',
        callAvailabilityStatus: member.callAvailabilityStatus || 'available',
        activeCallSid: member.activeCallSid || null,
        role: member.role,
      }))

    return [...selfOption, ...repOptions.filter((member) => member.id !== user?.id)]
  }, [teamMembers, user?.callAvailabilityStatus, user?.id, user?.phone, user?.role])

  const selectedRepresentative =
    representativeOptions.find((member) => member.id === selectedRepresentativeId) ||
    (user
      ? {
          id: user.id,
          name: user.name,
          phone: user.phone || '',
          callAvailabilityStatus: user.callAvailabilityStatus || 'available',
          activeCallSid: user.activeCallSid || null,
          role: user.role,
        }
      : null)

  const selectedRepresentativeDisplayState = getDisplayAvailability(selectedRepresentative)
  const selectedRepresentativeMeta = displayAvailabilityMeta[selectedRepresentativeDisplayState]

  const canPlaceCall =
    featureControls.dialer &&
    Boolean(selectedRepresentative?.phone) &&
    !['offline', 'in-call'].includes(selectedRepresentative?.callAvailabilityStatus || '') &&
    !selectedRepresentative?.activeCallSid &&
    !calling

  const ownDisplayAvailability = getDisplayAvailability(user)
  const ownAvailabilityMeta = displayAvailabilityMeta[ownDisplayAvailability]

  const handleToggleMyAvailability = async () => {
    if (!user) return

    const nextStatus: 'available' | 'offline' =
      user.callAvailabilityStatus === 'offline' ? 'available' : 'offline'

    try {
      setAvailabilityUpdating(true)
      updateUser({ callAvailabilityStatus: nextStatus })
      const response = await settingsAPI.updateMyProfile({ callAvailabilityStatus: nextStatus })
      if (response.success) {
        updateUser(response.data)
      }
    } catch (error) {
      console.error('Failed to update calling availability:', error)
      updateUser({
        callAvailabilityStatus: user.callAvailabilityStatus || 'available',
        activeCallSid: user.activeCallSid || null,
      })
    } finally {
      setAvailabilityUpdating(false)
    }
  }

  const ensureMicrophoneReady = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState('blocked')
      throw new Error('Microphone access is not available in this browser')
    }

    setMicState('checking')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setMicState('ready')
    } catch {
      setMicState('blocked')
      throw new Error('Allow microphone access before dialing from BuildFlow')
    }
  }

  const placeCall = async (payload: Parameters<typeof callsAPI.initiateCall>[0], onSuccess?: () => void) => {
    if (!featureControls.dialer) {
      setCallingError('Dialer is currently disabled in Feature Controls.')
      return
    }

    try {
      setCalling(true)
      setCallingError('')
      await ensureMicrophoneReady()
      const response = await callsAPI.initiateCall(payload)
      if (response.success) {
        setActiveCall(response.data)
        setRecentCalls((current) => [response.data, ...current.filter((call) => call._id !== response.data._id)].slice(0, 12))
        onSuccess?.()
      }
    } catch (error: any) {
      setCallingError(error?.response?.data?.message || error?.message || 'Failed to start call')
    } finally {
      setCalling(false)
    }
  }

  const startLeadCall = async (useAlternatePhone = false) => {
    if (!selectedLead) return

    await placeCall(
      {
        leadId: selectedLead._id,
        representativeId: selectedRepresentativeId || undefined,
        recordCall,
        useAlternatePhone,
      }
    )
  }

  const startManualCall = async () => {
    if (!manualPhone.trim()) return

    await placeCall(
      {
        phone: manualPhone.trim(),
        leadName: manualLeadName.trim() || undefined,
        city: manualCity.trim() || undefined,
        representativeId: selectedRepresentativeId || undefined,
        recordCall,
      },
      () => {
        setManualLeadName('')
        setManualPhone('')
        setManualCity('')
      }
    )
  }

  const handleManualPhoneInputChange = (value: string) => {
    setManualPhone(value.replace(/[^0-9+*#()\-\s]/g, ''))
  }

  const appendManualPhoneDigit = (digit: string) => {
    setManualPhone((current) => `${current}${digit}`)
  }

  const deleteLastManualPhoneDigit = () => {
    setManualPhone((current) => current.slice(0, -1))
  }

  const activeCallChip = statusConfig[activeCall?.status || 'initiated'] || statusConfig.initiated

  const resolveCallLead = (call: Call) => {
    if (typeof call.lead === 'string' && call.lead) {
      return { leadId: call.lead, leadName: call.leadName || getRecentCallTitle(call) }
    }

    const populatedLeadId = (call.lead as { _id?: string } | undefined)?._id
    if (populatedLeadId) {
      return { leadId: populatedLeadId, leadName: call.leadName || getRecentCallTitle(call) }
    }

    const lookup = phoneLeadLookup[normalizePhone(call.phone)]
    if (lookup?.lead?._id) {
      return { leadId: lookup.lead._id, leadName: lookup.lead.name || getRecentCallTitle(call) }
    }

    return null
  }

  const openReminderForCall = (call: Call) => {
    const resolved = resolveCallLead(call)
    if (!resolved) return

    setReminderContext({
      leadId: resolved.leadId,
      leadName: resolved.leadName,
      phone: call.phone,
      contextLabel: `${call.direction === 'incoming' ? 'Incoming' : 'Outgoing'} call • ${formatCallTime(call.startedAt || call.createdAt)}`,
    })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#0F172A]">Dialer</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#EFF6FF] text-[#1D4ED8]">
                Live Calling
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-0.5">
              Launch outgoing calls and track incoming activity.
            </p>
          </div>

          {selectedRepresentative && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 min-w-[200px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Calling Device</p>
                  <p className="text-xs font-bold text-[#0F172A] mt-0.5">{selectedRepresentative.name}</p>
                  <p className="text-[10px] text-[#64748B]">{selectedRepresentative.phone || 'Phone not configured'}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedRepresentativeMeta.dot }} />
                    <span className="text-[10px] font-semibold" style={{ color: selectedRepresentativeMeta.text }}>
                      {selectedRepresentativeMeta.label}
                    </span>
                  </div>
                </div>

                {selectedRepresentative.id === user?.id ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-semibold text-[#94A3B8]">Availability</span>
                    <button
                      type="button"
                      onClick={handleToggleMyAvailability}
                      disabled={ownDisplayAvailability === 'dialing' || ownDisplayAvailability === 'in-call' || availabilityUpdating}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        ownDisplayAvailability === 'offline' ? 'bg-[#CBD5E1]' : 'bg-[#16A34A]'
                      } ${ownDisplayAvailability === 'dialing' || ownDisplayAvailability === 'in-call' || availabilityUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${ownDisplayAvailability === 'offline' ? 'left-0.5' : 'left-[18px]'}`} />
                    </button>
                    <span className="text-[9px] font-semibold" style={{ color: ownAvailabilityMeta.text }}>
                      {availabilityUpdating ? 'Updating...' : ownAvailabilityMeta.label}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <PhoneCall size={15} className="text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Start a Call</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1.5">
                    Lead Search
                  </label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value)
                        setSelectedLead(null)
                      }}
                      placeholder="Search lead name or phone"
                      className="w-full pl-8 pr-3 h-8 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                    />
                  </div>
                </div>

                <div className="border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] min-h-[160px]">
                  {selectedLead ? (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#0F172A]">{selectedLead.name}</p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-xs text-[#64748B]">
                              <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wide mr-1">Primary</span>
                              {selectedLead.phone}
                            </p>
                            {selectedLead.alternatePhone && (
                              <p className="text-xs text-[#64748B]">
                                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wide mr-1">Alternate</span>
                                {selectedLead.alternatePhone}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-[#94A3B8] mt-1">
                            {selectedLead.city} • {selectedLead.source} • {selectedLead.disposition}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedLead(null)}
                          className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                        >
                          Change
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => startLeadCall(false)}
                          disabled={!canPlaceCall || !selectedLead}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1D4ED8] text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Phone size={13} />
                          Call Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => openWhatsAppChat(selectedLead.phone)}
                          disabled={!sanitizePhoneForWhatsApp(selectedLead.phone)}
                          title={`Open WhatsApp chat with ${selectedLead.name}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#1EBE57] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <WhatsAppIcon size={13} />
                          WhatsApp
                        </button>
                        {selectedLead.alternatePhone && (
                          <>
                            <button
                              onClick={() => startLeadCall(true)}
                              disabled={!canPlaceCall || !selectedLead}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-bold rounded-lg hover:bg-[#1E293B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Phone size={13} />
                              Call Alternate
                            </button>
                            <button
                              type="button"
                              onClick={() => openWhatsAppChat(selectedLead.alternatePhone)}
                              disabled={!sanitizePhoneForWhatsApp(selectedLead.alternatePhone)}
                              title="Open WhatsApp chat (alternate number)"
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#128C7E] text-white text-xs font-bold rounded-lg hover:bg-[#0E6F64] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <WhatsAppIcon size={13} />
                              WhatsApp Alt
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => setReminderContext({
                          leadId: selectedLead._id,
                          leadName: selectedLead.name,
                          phone: selectedLead.phone,
                          contextLabel: 'Selected lead in dialer',
                        })}
                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-xs font-bold rounded-lg hover:bg-[#DBEAFE] transition-colors"
                      >
                        <Calendar size={15} />
                        Set Reminder
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {searching ? (
                        <p className="text-sm text-[#94A3B8] px-2 py-12 text-center">Searching leads...</p>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((lead) => (
                          <button
                            key={lead._id}
                            onClick={() => {
                              setSelectedLead(lead)
                              setSearch(lead.name)
                            }}
                            className="w-full text-left px-3 py-3 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#BFDBFE] hover:bg-[#EFF6FF] transition-all"
                          >
                            <p className="text-sm font-bold text-[#0F172A]">{lead.name}</p>
                            <p className="text-xs text-[#64748B] mt-0.5">{lead.phone}</p>
                            {lead.alternatePhone && (
                              <p className="text-[10px] text-[#94A3B8] mt-0.5">
                                <span className="font-bold">Alt:</span> {lead.alternatePhone}
                              </p>
                            )}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-[#94A3B8] px-2 py-12 text-center">
                          Search for a lead to call, or use the manual dialer.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#94A3B8] mb-2">
                    Manual Dial
                  </label>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        value={manualLeadName}
                        onChange={(event) => setManualLeadName(event.target.value)}
                        placeholder="Contact name (optional)"
                        className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                      />
                      <input
                        value={manualCity}
                        onChange={(event) => setManualCity(event.target.value)}
                        placeholder="City (optional)"
                        className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                      />
                    </div>

                    <div className="rounded-2xl border border-[#DBEAFE] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)] p-3 shadow-[0_12px_32px_-16px_rgba(29,78,216,0.35)]">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Phone Number</p>
                          <p className="text-xs text-[#94A3B8] mt-1">Type from keyboard or tap the keypad like a mobile dialer.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setManualPhone('')}
                            className="px-2.5 py-1 rounded-full border border-[#D8E1F0] bg-white text-[#64748B] text-xs font-semibold hover:bg-[#F8FAFC] transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={deleteLastManualPhoneDigit}
                            className="w-9 h-9 rounded-full border border-[#D8E1F0] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors flex items-center justify-center"
                            aria-label="Delete last digit"
                          >
                            <Delete size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#C7D8F8] bg-white px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        <div className="flex items-center gap-2 mb-3 text-[#64748B]">
                          <Phone size={15} />
                          <span className="text-xs font-semibold uppercase tracking-[0.14em]">Dial Number</span>
                        </div>

                        <input
                          value={manualPhone}
                          onChange={(event) => handleManualPhoneInputChange(event.target.value)}
                          placeholder="Phone number"
                          className="w-full bg-transparent border-none p-0 text-center text-[20px] leading-none tracking-[0.12em] font-semibold text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none"
                          inputMode="tel"
                        />

                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
                          <span>{manualPhone.length} characters</span>
                          <span>{manualLeadName.trim() || 'Manual dial'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        {dialPadButtons.map((button) => (
                          <button
                            key={button.value}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => appendManualPhoneDigit(button.value)}
                            className="rounded-xl bg-white border border-[#D9E5F7] px-2 py-2 text-center shadow-[0_4px_12px_-8px_rgba(15,23,42,0.3)] hover:-translate-y-0.5 hover:border-[#93C5FD] hover:shadow-[0_8px_16px_-10px_rgba(29,78,216,0.4)] transition-all"
                          >
                            <span className="block text-[16px] leading-none font-semibold text-[#0F172A]">{button.value}</span>
                            <span className="block mt-0.5 min-h-[10px] text-[9px] font-bold tracking-[0.14em] text-[#94A3B8]">
                              {button.letters}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {user?.role === 'manager' && representativeOptions.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#94A3B8] mb-2">
                      Route Through
                    </label>
                    <select
                      value={selectedRepresentativeId}
                      onChange={(event) => setSelectedRepresentativeId(event.target.value)}
                      className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                    >
                      {representativeOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} • {member.phone || 'No phone'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A]">Record this call</p>
                      <p className="text-[10px] text-[#64748B] mt-0.5">Choose before dialing. Exotel applies recording when the call starts.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecordCall((current) => !current)}
                      disabled={!featureControls.callRecording || calling || Boolean(activeCall)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        recordCall ? 'bg-[#1D4ED8]' : 'bg-[#CBD5E1]'
                      } ${(!featureControls.callRecording || calling || Boolean(activeCall)) ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${recordCall ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  {!featureControls.callRecording ? (
                    <p className="mt-2 text-xs font-medium text-[#94A3B8]">
                      Recording is disabled from Feature Controls.
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={startManualCall}
                  disabled={!canPlaceCall || !manualPhone.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#16A34A] text-white text-xs font-bold shadow-[0_10px_20px_-12px_rgba(22,163,74,0.7)] hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone size={15} />
                  Dial Number
                </button>

                {callingError && (
                  <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-[#DC2626]" />
                      <p className="text-sm font-medium text-[#B91C1C]">{callingError}</p>
                    </div>
                  </div>
                )}

                {!featureControls.dialer ? (
                  <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-[#D97706]" />
                      <p className="text-sm font-medium text-[#B45309]">
                        Dialer is disabled in Feature Controls. Calls cannot be started until it is turned back on.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Microphone Check</p>
                  <p className="text-xs mt-1 font-medium text-[#0F172A]">
                    {micState === 'ready'
                      ? 'Microphone access is ready.'
                      : micState === 'checking'
                        ? 'Checking microphone access...'
                        : micState === 'blocked'
                          ? 'Microphone permission is blocked. Allow access before dialing.'
                          : 'BuildFlow will check microphone access before every call.'}
                  </p>
                </div>

                {!selectedRepresentative?.phone && (
                  <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                    <p className="text-sm font-medium text-[#92400E]">
                      Add a phone number in <Link to="/settings" className="underline font-bold">Settings</Link> before placing calls.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <Radio size={14} className="text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Active Call Workspace</h2>
            </div>

            {activeCall ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">{activeCall.leadName}</p>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-[#64748B]">{activeCall.phone}</p>
                      {isIncomingExotelCall(activeCall) ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                          Exotel {activeCall.exophoneNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                        style={{ background: activeCallChip.bg, color: activeCallChip.color }}
                      >
                        {activeCallChip.label}
                      </span>
                      <span className="text-xs text-[#94A3B8]">{formatCallTime(activeCall.startedAt)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-[#E2E8F0] px-3 py-2 min-w-[180px]">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">
                      {isIncomingExotelCall(activeCall) ? 'Exotel Number' : 'Operator'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#0F172A]">
                        {isIncomingExotelCall(activeCall)
                          ? activeCall.exophoneNumber
                          : activeCall.representativeName}
                      </p>
                      {isIncomingExotelCall(activeCall) ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                          Exotel
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">
                      {isIncomingExotelCall(activeCall)
                        ? 'This inbound call came through the Exotel number shown above.'
                        : ['initiated', 'ringing'].includes(activeCall.status)
                          ? 'BuildFlow is dialing the representative phone first. The customer rings after the rep answers.'
                          : activeCall.status === 'in-progress'
                            ? 'Conversation is live on the linked phone. Hang up on that phone to end the call.'
                            : 'Call has finished. Review it in the log or return to the lead.'}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-2">
                      Recording: {activeCall.recordingRequested ? 'On for this call' : 'Off for this call'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Link
                    to="/call-log"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
                  >
                    Open Call Log
                    <ArrowUpRight size={14} />
                  </Link>
                  {typeof activeCall.lead === 'string' ? (
                    <Link
                      to={`/leads/${activeCall.lead}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                      Open Lead
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : null}
                  {resolveCallLead(activeCall) ? (
                    <button
                      type="button"
                      onClick={() => openReminderForCall(activeCall)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                    >
                      <Calendar size={12} />
                      Set Reminder
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center">
                <p className="text-xs font-semibold text-[#0F172A]">No live call right now</p>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Start from a lead or dial a manual number to open the live workspace.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-3">
          <section className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <Users size={14} className="text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Calling Team</h2>
            </div>

            <div className="space-y-1.5">
              {(user?.role === 'manager' ? representativeOptions : []).map((member) => (
                <div
                  key={member.id}
                  className={`rounded-lg border px-3 py-2 transition-all ${
                    selectedRepresentativeId === member.id
                      ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">{member.name}</p>
                      <p className="text-[10px] text-[#64748B] mt-0.5">{member.phone || 'Phone not configured'}</p>
                    </div>
                    {member.id === user?.id ? (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold capitalize" style={{ color: ownAvailabilityMeta.text }}>
                          {availabilityUpdating ? 'Updating...' : ownAvailabilityMeta.label}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleToggleMyAvailability()
                          }}
                          disabled={ownDisplayAvailability === 'dialing' || ownDisplayAvailability === 'in-call' || availabilityUpdating}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            ownDisplayAvailability === 'offline' ? 'bg-[#CBD5E1]' : 'bg-[#16A34A]'
                          } ${ownDisplayAvailability === 'dialing' || ownDisplayAvailability === 'in-call' || availabilityUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${ownDisplayAvailability === 'offline' ? 'left-1' : 'left-6'}`} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold capitalize text-[#475569]">
                        {displayAvailabilityMeta[getDisplayAvailability(member)].label}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {user?.role !== 'manager' && (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                  <p className="text-xs font-bold text-[#0F172A]">{user?.name}</p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">{user?.phone || 'Phone not configured'}</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <div className="flex items-center gap-2">
                <Clock3 size={14} className="text-[#1D4ED8]" />
                <h2 className="text-sm font-bold text-[#0F172A]">Recent Calls</h2>
              </div>
              <Link to="/call-log" className="text-xs font-bold text-[#1D4ED8] hover:underline">
                View full log
              </Link>
            </div>

            <div className="space-y-1.5">
              {recentCalls.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No recent call activity yet.</p>
              ) : (
                recentCalls.map((call) => {
                  const chip = statusConfig[call.status] || statusConfig.initiated
                  const reminderLead = resolveCallLead(call)
                  return (
                    <div key={call._id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {call.direction === 'incoming' ? (
                              <ArrowDownLeft size={12} className="text-[#16A34A]" />
                            ) : (
                              <ArrowUpRight size={12} className="text-[#1D4ED8]" />
                            )}
                            <p className="text-xs font-bold text-[#0F172A]">{getRecentCallTitle(call)}</p>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] text-[#64748B]">{getRecentCallSubtitle(call)}</p>
                            {isIncomingExotelCall(call) ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                Exotel
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[9px] text-[#94A3B8] mt-0.5">{formatCallTime(call.startedAt)}</p>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                          style={{ background: chip.bg, color: chip.color }}
                        >
                          {chip.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Link
                          to="/call-log"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-[11px] font-bold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
                        >
                          Open Log
                          <ArrowUpRight size={12} />
                        </Link>
                        {reminderLead ? (
                          <button
                            type="button"
                            onClick={() => openReminderForCall(call)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[11px] font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                          >
                            <Calendar size={12} />
                            Set Reminder
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="bg-gradient-to-br from-[#EFF6FF] to-white rounded-xl border border-[#BFDBFE] p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <PhoneIncoming size={14} className="text-[#1D4ED8]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Incoming Calls</h2>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              Incoming Exotel activity is mirrored into BuildFlow in real time. The actual answer happens on the linked phone.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-[#1D4ED8]">
              <CircleDot size={12} />
              <span>Webphone mode can be added later without changing this workflow.</span>
            </div>
          </section>
        </div>
      </div>

      {reminderContext ? (
        <CallReminderModal
          leadName={reminderContext.leadName}
          phone={reminderContext.phone}
          contextLabel={reminderContext.contextLabel}
          onClose={() => setReminderContext(null)}
          onSubmit={async (payload) => {
            await remindersAPI.createReminder({
              leadId: reminderContext.leadId,
              title: payload.title,
              dueAt: payload.dueAt,
              notes: payload.notes,
              priority: payload.priority,
            })
            setReminderContext(null)
          }}
        />
      ) : null}
    </div>
  )
}

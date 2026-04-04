import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, PhoneOff, PhoneCall, MapPin, Building2,
  DollarSign, CheckCircle2, CheckCircle, Mic, ChevronDown, Edit3, User, Delete, Pencil, Trash2, X, History, MessageSquare, Clock, Calendar, ArrowUpRight, ArrowDownLeft, AlertCircle, Voicemail, Mail
} from 'lucide-react'
import { leadsAPI, type Lead, type Disposition, type LeadStatusNote, type FollowUp } from '../api/leads'
import { callsAPI, type Call } from '../api/calls'
import { remindersAPI } from '../api/reminders'
import { teamAPI } from '../api/team'
import PostCallFeedbackModal from '../components/leads/PostCallFeedbackModal'
import RepresentativePicker, { type RepresentativePickerOption } from '../components/leads/RepresentativePicker'
import CallReminderModal from '../components/reminders/CallReminderModal'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { settingsAPI, type LeadFieldConfig } from '../api/settings'
import { LEAD_FIELDS_STORAGE_KEY, LEAD_FIELDS_UPDATED_EVENT, normalizeLeadFieldConfigs } from '../utils/leadFields'
import {
  DEFAULT_FEATURE_CONTROLS,
  FEATURE_CONTROLS_STORAGE_KEY,
  FEATURE_CONTROLS_UPDATED_EVENT,
  normalizeFeatureControls,
} from '../utils/featureControls'

type CallState = 'idle' | 'dialing' | 'connected' | 'completed'
type MicState = 'idle' | 'checking' | 'ready' | 'blocked'

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

const isIncomingExotelCall = (call?: Call | null) => Boolean(call?.direction === 'incoming' && call?.exophoneNumber)

const getCallContextLabel = (call?: Call | null) => {
  if (!call) return ''
  if (isIncomingExotelCall(call)) {
    return call.exophoneNumber || call.phone
  }
  return call.representativeName || call.phone
}

const getCallFromLabel = (call?: Call | null) => {
  if (!call) return ''
  if (call.direction === 'outbound') {
    return call.representativeName || call.leadName
  }
  return call.leadName || call.phone
}

const getCallSecondaryLabel = (call?: Call | null) => {
  if (!call) return ''
  if (call.direction === 'outbound') {
    return call.phone
  }
  return call.exophoneNumber || call.phone
}

const legStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Picked', color: '#16A34A', bg: '#F0FDF4' },
  unanswered: { label: 'No Answer', color: '#DC2626', bg: '#FEF2F2' },
  'not-answered': { label: 'No Answer', color: '#DC2626', bg: '#FEF2F2' },
  busy: { label: 'Busy', color: '#D97706', bg: '#FFFBEB' },
  failed: { label: 'Failed', color: '#DC2626', bg: '#FEF2F2' },
  cancelled: { label: 'Cancelled', color: '#64748B', bg: '#F1F5F9' },
  canceled: { label: 'Cancelled', color: '#64748B', bg: '#F1F5F9' },
  dialing: { label: 'Dialing', color: '#2563EB', bg: '#EFF6FF' },
  ringing: { label: 'Ringing', color: '#D97706', bg: '#FFFBEB' },
  waiting: { label: 'Waiting', color: '#64748B', bg: '#F8FAFC' },
  'not-dialed': { label: 'Not Dialed', color: '#64748B', bg: '#F8FAFC' },
}

const getLegStatusMeta = (status?: string | null, answered?: boolean | null) => {
  if (!status) {
    if (answered === true) return legStatusConfig.completed
    if (answered === false) return legStatusConfig.unanswered
    return null
  }

  return legStatusConfig[status.toLowerCase()] || {
    label: status.replace(/_/g, ' '),
    color: '#475569',
    bg: '#F8FAFC',
  }
}

const getRepresentativeLegMeta = (call: Call) =>
  getLegStatusMeta(call.representativeLegStatus, call.representativeAnswered)

const getCustomerLegMeta = (call: Call) =>
  getLegStatusMeta(call.customerLegStatus, call.customerAnswered)

const outcomeConfig: Record<string, { icon: typeof CheckCircle2 }> = {
  Connected: { icon: CheckCircle2 },
  'Not Answered': { icon: PhoneOff },
  'No Answer': { icon: PhoneOff },
  'Call Back Later': { icon: Clock },
  'Callback Requested': { icon: Clock },
  Voicemail: { icon: Voicemail },
  'Wrong Number': { icon: AlertCircle },
  Busy: { icon: PhoneOff },
  'On Call': { icon: Phone },
  Ringing: { icon: Phone },
  Failed: { icon: AlertCircle },
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [featureControls, setFeatureControls] = useState(DEFAULT_FEATURE_CONTROLS)
  const [calls, setCalls] = useState<Call[]>([])
  const [callState, setCallState] = useState<CallState>('idle')
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [disposition, setDisposition] = useState<string>('')
  const [dispositionDraft, setDispositionDraft] = useState<string>('')
  const [dispositionNoteDraft, setDispositionNoteDraft] = useState('')
  const [dispositionNoteError, setDispositionNoteError] = useState('')
  const [isUpdatingDisposition, setIsUpdatingDisposition] = useState(false)
  const [dispositionOptions, setDispositionOptions] = useState<string[]>(['New', 'Contacted/Open', 'Qualified', 'Visit Done', 'Meeting Done', 'Negotiation Done', 'Booking Done', 'Agreement Done', 'Failed'])
  const [cityOptions, setCityOptions] = useState<string[]>(['Ahmedabad', 'Gandhinagar', 'Vadodara', 'Surat', 'Rajkot'])
  const [buildTypeOptions, setBuildTypeOptions] = useState<string[]>(['Residential', 'Commercial', 'Villa', 'Apartment', 'Plot'])
  const [leadFields, setLeadFields] = useState<LeadFieldConfig[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [selectedNoteStatus, setSelectedNoteStatus] = useState<string>('')
  const [isSavingStatusNote, setIsSavingStatusNote] = useState(false)
  const [editingStatusNoteId, setEditingStatusNoteId] = useState<string | null>(null)
  const [deletingStatusNoteId, setDeletingStatusNoteId] = useState<string | null>(null)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [plotSize, setPlotSize] = useState('')
  const [plotUnit, setPlotUnit] = useState('Sq Yard')
  const [meetingType, setMeetingType] = useState<'VC' | 'Client Place' | ''>('')
  const [meetingLocation, setMeetingLocation] = useState('')
  const [failedReason, setFailedReason] = useState('')
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [representatives, setRepresentatives] = useState<RepresentativePickerOption[]>([])
  const [selectedRepresentativeId, setSelectedRepresentativeId] = useState<string>('')
  const [micState, setMicState] = useState<MicState>('idle')
  const [editableName, setEditableName] = useState('')
  const [editablePhone, setEditablePhone] = useState('')
  const [isDeletingLead, setIsDeletingLead] = useState(false)
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const syncIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (activeCall?.exotelCallSid && ['initiated', 'ringing', 'in-progress'].includes(activeCall.status)) {
      if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current)
      
      syncIntervalRef.current = window.setInterval(async () => {
        try {
          const response = await callsAPI.syncCall(activeCall.exotelCallSid!)
          if (response.success && response.data) {
            const updatedCall = response.data
            
            setCalls(current => {
              const next = [...current]
              const idx = next.findIndex(c => c._id === updatedCall._id)
              if (idx >= 0) {
                next[idx] = updatedCall
                return next
              }
              return [updatedCall, ...next]
            })

            setActiveCall(updatedCall)
            setCallState(
              updatedCall.status === 'in-progress' 
                ? 'connected' 
                : ['initiated', 'ringing'].includes(updatedCall.status)
                  ? 'dialing'
                  : 'completed'
            )

            if (!['initiated', 'ringing', 'in-progress'].includes(updatedCall.status)) {
              if (syncIntervalRef.current) {
                window.clearInterval(syncIntervalRef.current)
                syncIntervalRef.current = null
              }
            }
          }
        } catch (err) {
          console.error('Failed to sync call:', err)
        }
      }, 5000)
    } else {
      if (syncIntervalRef.current) {
        window.clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }

    return () => {
      if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current)
    }
  }, [activeCall?.exotelCallSid, activeCall?.status])

  useEffect(() => {
    settingsAPI
      .getAppConfig()
      .then((response) => {
        if (response.success) {
          setFeatureControls(normalizeFeatureControls(response.data.featureControls))
        }
      })
      .catch((error) => {
        console.error('Failed to load lead detail feature controls:', error)
      })

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
        console.error('Failed to sync lead detail feature controls:', error)
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
    if (id) {
      fetchLeadData()
      fetchCallLogs()
      fetchFilters()
      if (user?.role === 'manager') {
        fetchRepresentatives()
      }
    }
  }, [id, user?.role])

  useEffect(() => {
    if (lead?._id) {
      fetchFollowUps()
    }
  }, [lead?._id])

  useEffect(() => {
    const handleLeadFieldsUpdated = () => {
      void fetchFilters()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LEAD_FIELDS_STORAGE_KEY) {
        void fetchFilters()
      }
    }

    window.addEventListener(LEAD_FIELDS_UPDATED_EVENT, handleLeadFieldsUpdated as EventListener)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(LEAD_FIELDS_UPDATED_EVENT, handleLeadFieldsUpdated as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    if (!socket || !connected || user?.role !== 'manager') return

    const handleAvailabilityUpdate = (payload: any) => {
      setRepresentatives((current) =>
        current.map((member) =>
          String(member.id) === String(payload?.id)
            ? {
                ...member,
                phone: payload?.phone ?? member.phone,
                callAvailabilityStatus: payload?.callAvailabilityStatus ?? member.callAvailabilityStatus,
                activeCallSid: payload?.activeCallSid ?? null,
              }
            : member
        )
      )
    }

    socket.on('user:availability_updated', handleAvailabilityUpdate)

    return () => {
      socket.off('user:availability_updated', handleAvailabilityUpdate)
    }
  }, [socket, connected, user?.role])

  const fetchLeadData = async () => {
    try {
      setLoading(true)
      const res = await leadsAPI.getLeadById(id!)
      if (res.success) {
        setLead(res.data)
        setDisposition(res.data.disposition)
        setDispositionDraft(res.data.disposition)
        setPlotSize(res.data.plotSize?.toString() || '')
        setPlotUnit(res.data.plotSizeUnit || 'Sq Yard')
        setMeetingType((res.data.meetingType as 'VC' | 'Client Place' | '') || '')
        setMeetingLocation(res.data.meetingLocation || '')
        setFailedReason(res.data.failedReason || '')
        setEditableName(res.data.name || '')
        setEditablePhone(res.data.phone || '')
        setSelectedNoteStatus((current) => current || res.data.disposition)
      }
    } catch (err) {
      console.error('Failed to fetch lead:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCallLogs = async () => {
    try {
      const res = await callsAPI.getCallsByLead(id!)
      if (res.success) {
        setCalls(res.data)
        const current = res.data.find(c => ['initiated', 'ringing', 'in-progress'].includes(c.status))
        if (current) {
          setActiveCall(current)
          setCallState(
            current.status === 'in-progress'
              ? 'connected'
              : ['initiated', 'ringing'].includes(current.status)
                ? 'dialing'
                : 'completed'
          )
        } else {
          setActiveCall(null)
          setCallState('idle')
        }
      }
    } catch (err) {
      console.error('Failed to fetch call logs:', err)
    }
  }

  const fetchFilters = async () => {
    try {
      const res = await leadsAPI.getLeadFilters()
      if (res.success) {
        setDispositionOptions(res.data.dispositions)
        if (res.data.cities) {
          setCityOptions(res.data.cities.filter((c: string) => c !== 'All'))
        }
        if (res.data.leadFields?.fields) {
          const normalizedFields = normalizeLeadFieldConfigs(res.data.leadFields.fields)
          setLeadFields(normalizedFields)
          setBuildTypeOptions(
            normalizedFields.find((field) => field.key === 'buildType')?.options || []
          )
        }
      }
    } catch (err) {
      console.error('Failed to fetch filters:', err)
    }
  }

  const fetchRepresentatives = async () => {
    try {
      const res = await teamAPI.getTeamMembers()
      if (res.success) {
        setRepresentatives(
          res.data
            .filter((member) => member.role === 'representative' && member.isActive)
            .map((member) => ({
              id: member.id,
              name: member.name,
              phone: member.phone,
              callAvailabilityStatus: member.callAvailabilityStatus,
              activeCallSid: member.activeCallSid,
            }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch representatives:', err)
    }
  }

  const handleUpdateDisposition = async () => {
    const nextDisp = dispositionDraft
    const note = dispositionNoteDraft.trim()

    if (!lead || nextDisp === disposition) {
      setDispositionNoteError('')
      return
    }

    if (!note) {
      setDispositionNoteError('Add a status note before changing the lead status.')
      setSelectedNoteStatus(nextDisp)
      return
    }

    if (nextDisp === 'Meeting Done' && !meetingType) {
      setDispositionNoteError('Select Meeting Type (VC or Client Place) before saving.')
      return
    }

    try {
      setIsUpdatingDisposition(true)
      setDispositionNoteError('')
      setSelectedNoteStatus(nextDisp)
      const res = await leadsAPI.updateDisposition(id!, nextDisp, note)
      if (res.success) {
        setLead(res.data)
        setDisposition(res.data.disposition)
        setDispositionDraft(res.data.disposition)
        setDispositionNoteDraft('')
        setNoteDraft('')
        const extraFields: Record<string, unknown> = {}
        if (nextDisp === 'Meeting Done') {
          extraFields.meetingType = meetingType || null
          extraFields.meetingLocation = meetingLocation.trim() || null
        }
        if (nextDisp === 'Failed') {
          extraFields.failedReason = failedReason.trim() || null
        }
        if (Object.keys(extraFields).length > 0) {
          const updRes = await leadsAPI.updateLead(id!, extraFields)
          if (updRes.success) {
            setLead(updRes.data)
            setMeetingType((updRes.data.meetingType as 'VC' | 'Client Place' | '') || '')
            setMeetingLocation(updRes.data.meetingLocation || '')
            setFailedReason(updRes.data.failedReason || '')
          }
        }
      }
    } catch (err: any) {
      setDispositionDraft(disposition)
      setDispositionNoteError(err?.response?.data?.message || 'Failed to update lead status. Add a note and try again.')
      console.error('Failed to update disposition:', err)
    } finally {
      setIsUpdatingDisposition(false)
    }
  }

  const handleSaveQualification = async (field: string, value: any) => {
    try {
      const res = await leadsAPI.updateLead(id!, { [field]: value })
      if (res.success) {
        setLead(res.data)
        setEditableName(res.data.name || '')
        setEditablePhone(res.data.phone || '')
      }
    } catch (err) {
      console.error('Failed to update lead:', err)
    }
  }

  const handleAssignLead = async (assignedTo: string | null) => {
    try {
      const res = await leadsAPI.assignLead(id!, assignedTo)
      if (res.success) {
        setLead(res.data)
      }
    } catch (err) {
      console.error('Failed to assign lead:', err)
    }
  }

  const handlePhoneInputChange = (value: string) => {
    setEditablePhone(value.replace(/[^0-9+*#()\-\s]/g, ''))
  }

  const appendPhoneDigit = (digit: string) => {
    setEditablePhone((current) => `${current}${digit}`)
  }

  const deleteLastPhoneDigit = () => {
    setEditablePhone((current) => current.slice(0, -1))
  }

  const savePhoneNumber = async () => {
    const nextPhone = editablePhone.trim()
    const currentPhone = lead?.phone?.trim() || ''
    if (!nextPhone || nextPhone === currentPhone) {
      setEditablePhone(lead?.phone || '')
      return
    }
    await handleSaveQualification('phone', nextPhone)
  }

  const resetStatusNoteComposer = () => {
    setNoteDraft('')
    setEditingStatusNoteId(null)
    setDeletingStatusNoteId(null)
  }

  const saveStatusNote = async () => {
    const nextNote = noteDraft.trim()
    const targetStatus = selectedNoteStatus || disposition || lead?.disposition

    if (!lead || !targetStatus || !nextNote) {
      return
    }

    try {
      setIsSavingStatusNote(true)
      const res = editingStatusNoteId
        ? await leadsAPI.updateStatusNote(id!, editingStatusNoteId, targetStatus, nextNote)
        : await leadsAPI.addStatusNote(id!, targetStatus, nextNote)
      if (res.success) {
        setLead(res.data)
        resetStatusNoteComposer()
        setSelectedNoteStatus(targetStatus)
      }
    } catch (err) {
      console.error('Failed to save status note:', err)
    } finally {
      setIsSavingStatusNote(false)
    }
  }

  const startEditingStatusNote = (entry: LeadStatusNote) => {
    if (!entry._id || entry._id === 'legacy-note') return
    setSelectedNoteStatus(entry.status)
    setNoteDraft(entry.note)
    setEditingStatusNoteId(entry._id)
  }

  const handleDeleteStatusNote = async (entry: LeadStatusNote) => {
    if (!entry._id || entry._id === 'legacy-note' || !lead) return

    try {
      setDeletingStatusNoteId(entry._id)
      const res = await leadsAPI.deleteStatusNote(lead._id, entry._id)
      if (res.success) {
        setLead(res.data)
        if (editingStatusNoteId === entry._id) {
          resetStatusNoteComposer()
        }
      }
    } catch (err) {
      console.error('Failed to delete status note:', err)
    } finally {
      setDeletingStatusNoteId(null)
    }
  }

  useEffect(() => {
    if (user?.role !== 'manager') {
      setSelectedRepresentativeId(user?.id || '')
      return
    }

    setSelectedRepresentativeId((current) => {
      if (current) return current
      if (user?.phone) return user.id
      // Default to lead owner if they exist in representatives list
      if (lead?.owner && representatives.some(r => String(r.id) === String(lead.owner))) {
        return String(lead.owner)
      }
      return representatives[0]?.id || ''
    })
  }, [representatives, user, lead?.owner])

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

  const startCall = async () => {
    if (!featureControls.dialer) {
      alert('Dialer is disabled in Feature Controls.')
      return
    }

    // Check if selected representative can call
    const callingMember = user?.id === selectedRepresentativeId 
      ? { ...user, id: user.id } 
      : representatives.find(r => String(r.id) === String(selectedRepresentativeId))

    if (!callingMember?.phone) {
      alert('Selected representative has no phone number set up.')
      return
    }

    if (['offline', 'in-call'].includes(callingMember.callAvailabilityStatus || '')) {
      alert(`Representative is currently ${callingMember.callAvailabilityStatus}.`)
      return
    }

    try {
      await ensureMicrophoneReady()
      setCallState('dialing')

      const res = await callsAPI.initiateCall({
        leadId: id!,
        representativeId: selectedRepresentativeId,
        recordCall: featureControls.callRecording,
      })
      if (res.success) {
        setActiveCall(res.data)
        setCallState(['initiated', 'ringing'].includes(res.data.status) ? 'dialing' : 'connected')
      }
    } catch (err: any) {
      console.error('Failed to initiate call:', err)
      alert(err.message || 'Failed to initiate call')
      setCallState('idle')
    }
  }

  const openFeedback = () => {
    setShowFeedbackModal(true)
  }

  useEffect(() => {
    if (!socket || !connected || !id) return

    const handleCallEvent = (event: Call) => {
      const eventLeadId =
        typeof event.lead === 'string'
          ? event.lead
          : ((event.lead as any)?._id || (event.lead as any)?.id || '')

      if (String(eventLeadId) !== String(id)) return

      setCalls((current) => {
        const next = [...current]
        const index = next.findIndex((item) => item._id === event._id)
        if (index >= 0) {
          next[index] = { ...next[index], ...event }
          return next.sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
        }
        return [event, ...next].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
      })

      setActiveCall(event)
      setCallState(
        event.status === 'in-progress'
          ? 'connected'
          : ['initiated', 'ringing'].includes(event.status)
            ? 'dialing'
            : 'completed'
      )
    }

    socket.on('call:new', handleCallEvent)
    socket.on('call:status_updated', handleCallEvent)

    return () => {
      socket.off('call:new', handleCallEvent)
      socket.off('call:status_updated', handleCallEvent)
    }
  }, [socket, connected, id])

  const selectedCallingMember = useMemo(() => {
    return user?.id === selectedRepresentativeId 
      ? { ...user, id: user.id } 
      : representatives.find(r => String(r.id) === String(selectedRepresentativeId))
  }, [user, representatives, selectedRepresentativeId])

  const activeLeadFields = useMemo(
    () => normalizeLeadFieldConfigs(leadFields).filter((field) => field.active),
    [leadFields]
  )
  const contactNameField = activeLeadFields.find((field) => field.key === 'name')
  const phoneField = activeLeadFields.find((field) => field.key === 'phone')
  const plotSizeField = activeLeadFields.find((field) => field.key === 'plotSize')
  const plotSizeUnitField = activeLeadFields.find((field) => field.key === 'plotSizeUnit')
  const qualificationFields = activeLeadFields.filter(
    (field) => field.section === 'qualification' && !['plotSize', 'plotSizeUnit'].includes(field.key)
  )

  const latestRecordingCall = useMemo(
    () => calls.find((call) => Boolean(call.recordingUrl)),
    [calls]
  )
  const sortedCallHistory = useMemo(
    () => [...calls].sort((a, b) => +new Date(b.startedAt || b.createdAt) - +new Date(a.startedAt || a.createdAt)),
    [calls]
  )
  const latestReminderCall = activeCall || sortedCallHistory[0] || null

  if (loading || !lead) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-[#94A3B8] italic">Loading lead details...</p>
      </div>
    )
  }

  const callStateConfig: Record<CallState, { label: string; color: string; bg: string }> = {
    idle: { label: 'Ready to Call', color: '#475569', bg: '#F1F5F9' },
    dialing: { label: 'Calling via Exotel', color: '#F59E0B', bg: '#FFFBEB' },
    connected: { label: 'Live on Phone', color: '#16A34A', bg: '#F0FDF4' },
    completed: { label: 'Latest Call Updated', color: '#1D4ED8', bg: '#EFF6FF' },
  }
  const csc = callStateConfig[callState]

  const canPlaceCall =
    featureControls.dialer &&
    Boolean(selectedCallingMember?.phone) &&
    !['offline', 'in-call'].includes(selectedCallingMember?.callAvailabilityStatus || '') &&
    !selectedCallingMember?.activeCallSid

  const callActionLabel = !canPlaceCall
    ? !featureControls.dialer
      ? 'Dialer disabled'
      : user?.role === 'manager' && !user?.phone && !lead.owner
      ? 'Assign a rep to call'
      : 'Device not available'
    : 'Call Now'
  const statusNotes: LeadStatusNote[] = [...(lead.statusNotes || [])]

  // Only add the "legacy-note" if the content in lead.notes isn't already 
  // captured in any of the existing status-wise notes. This prevents 
  // duplicate notes appearing in different status buckets.
  if (
    lead.notes &&
    !statusNotes.some((entry) => entry.note === lead.notes)
  ) {
    statusNotes.unshift({
      _id: 'legacy-note',
      status: lead.disposition,
      note: lead.notes,
      createdAt: lead.updatedAt,
      createdByName: lead.lastActivityNote === lead.notes ? 'Latest activity note' : 'Existing note',
    })
  }

  const noteCounts = dispositionOptions.reduce<Record<string, number>>((acc, status) => {
    acc[status] = statusNotes.filter((entry) => entry.status === status).length
    return acc
  }, {})

  const activeNoteStatus = selectedNoteStatus || disposition
  const filteredStatusNotes = statusNotes
    .filter((entry) => entry.status === activeNoteStatus)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const isEditingStatusNote = Boolean(editingStatusNoteId)

  const createLeadReminder = async (payload: { title: string; dueAt: string; notes?: string | null; priority: 'high' | 'medium' | 'low' }) => {
    await remindersAPI.createReminder({
      leadId: lead._id,
      title: payload.title,
      dueAt: payload.dueAt,
      notes: payload.notes,
      priority: payload.priority,
    })
    setShowReminderForm(false)
    await fetchLeadData()
  }

  const handleDeleteLead = async () => {
    if (!lead || isDeletingLead) return

    const confirmed = window.confirm(`Delete lead "${lead.name}"? This will also remove related reminders, queue items, and call history.`)
    if (!confirmed) return

    try {
      setIsDeletingLead(true)
      const response = await leadsAPI.deleteLead(lead._id)
      if (!response.success) return
      navigate('/leads')
    } catch (error) {
      console.error('Failed to delete lead:', error)
    } finally {
      setIsDeletingLead(false)
    }
  }

  // Follow-up functions
  const fetchFollowUps = async () => {
    if (!lead?._id) return
    try {
      const response = await leadsAPI.getLeadFollowUps(lead._id)
      if (response.success) {
        setFollowUps(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error)
    }
  }

  const handleCreateFollowUp = async () => {
    if (!lead?._id || !followUpDate || !followUpTime) return
    
    try {
      setFollowUpLoading(true)
      const scheduledAt = new Date(`${followUpDate}T${followUpTime}`).toISOString()
      await leadsAPI.createFollowUp(lead._id, {
        scheduledAt,
        notes: followUpNotes,
      })
      setShowFollowUpForm(false)
      setFollowUpDate('')
      setFollowUpTime('')
      setFollowUpNotes('')
      await fetchFollowUps()
    } catch (error) {
      console.error('Failed to create follow-up:', error)
    } finally {
      setFollowUpLoading(false)
    }
  }

  const handleUpdateFollowUp = async (followUpId: string, updates: { status?: 'pending' | 'completed' | 'cancelled', scheduledAt?: string, notes?: string }) => {
    if (!lead?._id) return
    
    try {
      setFollowUpLoading(true)
      await leadsAPI.updateFollowUp(lead._id, followUpId, updates)
      await fetchFollowUps()
    } catch (error) {
      console.error('Failed to update follow-up:', error)
    } finally {
      setFollowUpLoading(false)
    }
  }

  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!lead?._id) return
    
    const confirmed = window.confirm('Delete this follow-up?')
    if (!confirmed) return

    try {
      setFollowUpLoading(true)
      await leadsAPI.deleteFollowUp(lead._id, followUpId)
      await fetchFollowUps()
    } catch (error) {
      console.error('Failed to delete follow-up:', error)
    } finally {
      setFollowUpLoading(false)
    }
  }

  const openEditFollowUp = (followUp: FollowUp) => {
    setEditingFollowUpId(followUp._id)
    const date = new Date(followUp.scheduledAt)
    setFollowUpDate(date.toISOString().split('T')[0])
    setFollowUpTime(date.toTimeString().slice(0, 5))
    setFollowUpNotes(followUp.notes || '')
    setShowFollowUpForm(true)
  }

  const resetFollowUpForm = () => {
    setEditingFollowUpId(null)
    setFollowUpDate('')
    setFollowUpTime('')
    setFollowUpNotes('')
    setShowFollowUpForm(false)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-2.5 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/leads')} className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors">
            <ArrowLeft size={15} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-bold text-[#0F172A]">{lead.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8]">{lead.source}</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">Lead ID: {lead._id} · Created {new Date(lead.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Left — primary work area */}
        <div className="flex-1 p-3 space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleDeleteLead()}
              disabled={isDeletingLead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-xs font-bold hover:bg-[#FEE2E2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={15} />
              {isDeletingLead ? 'Deleting...' : 'Delete Lead'}
            </button>
          </div>

          {/* Top Attribute Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { label: 'Budget', value: lead.budget || '—', icon: DollarSign, color: '#16A34A' },
              { label: 'Build', value: lead.buildType || '—', icon: Building2, color: '#7C3AED' },
              { label: 'Plot', value: lead.plotOwned ? 'Owned' : 'Not Owned', icon: CheckCircle2, color: lead.plotOwned ? '#16A34A' : '#94A3B8' },
              { label: 'Source', value: lead.source || '—', icon: Phone, color: '#1D4ED8' },
            ].map((item) => (
              <div key={item.label} className="group flex flex-col gap-1 p-2 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#1D4ED8] hover:shadow-sm transition-all duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider">{item.label}</span>
                  <div className="p-1 rounded-md group-hover:scale-110 transition-transform" style={{ background: `${item.color}10` }}>
                    <item.icon size={10} style={{ color: item.color }} />
                  </div>
                </div>
                <p className="text-sm font-bold text-[#0F172A] tracking-tight truncate">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Lead Overview & Detailed Qualification Merged */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-3 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">
              <div className="space-y-5">
                {/* Primary Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1 h-3 bg-[#1D4ED8] rounded-full" />
                    <h2 className="text-xs font-bold text-[#0F172A]">Core Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] gap-3 items-start">
                    <div>
                      <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">
                        {contactNameField?.label || 'Contact Name'}
                      </label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#1D4ED8] transition-colors">
                          <User size={16} />
                        </div>
                        <input
                          value={editableName}
                          onChange={(e) => setEditableName(e.target.value)}
                          onBlur={(e) => {
                            const nextName = e.target.value.trim()
                            if (nextName && nextName !== lead.name) {
                              handleSaveQualification('name', nextName)
                            } else {
                              setEditableName(lead.name || '')
                            }
                          }}
                          placeholder={contactNameField?.placeholder || 'Customer name'}
                          className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm leading-tight text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Lead Status</label>
                      <div className="space-y-2">
                        <div className="relative group">
                          <select
                            value={dispositionDraft}
                            onChange={(e) => {
                              setDispositionDraft(e.target.value)
                              setSelectedNoteStatus(e.target.value)
                              setDispositionNoteError('')
                            }}
                            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer"
                          >
                            {dispositionOptions.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
                        </div>
                        {/* Meeting Done sub-options */}
                        {dispositionDraft === 'Meeting Done' && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Meeting Type <span className="text-[#DC2626]">*</span></label>
                              <div className="flex gap-2">
                                {(['VC', 'Client Place'] as const).map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => { setMeetingType(type); if (dispositionNoteError) setDispositionNoteError('') }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                      meetingType === type
                                        ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-md'
                                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:border-[#7C3AED] hover:text-[#7C3AED]'
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {meetingType === 'Client Place' && (
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Client Location</label>
                                <input
                                  value={meetingLocation}
                                  onChange={(e) => setMeetingLocation(e.target.value)}
                                  placeholder="Enter client address or Google Maps link..."
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/10 focus:border-[#7C3AED] focus:bg-white transition-all"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Failed sub-reason */}
                        {dispositionDraft === 'Failed' && (
                          <div>
                            <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Failed Reason</label>
                            <div className="relative">
                              <select
                                value={failedReason}
                                onChange={(e) => setFailedReason(e.target.value)}
                                className="w-full appearance-none pl-3 pr-8 py-1.5 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-xs font-semibold text-[#DC2626] focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#DC2626] transition-all cursor-pointer"
                              >
                                <option value="">Select reason...</option>
                                {['Budget Issue', 'Not Interested', 'Location Issue', 'Timeline Issue', 'Competition', 'Other'].map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#DC2626] pointer-events-none" />
                            </div>
                          </div>
                        )}

                        {/* Show existing meeting/failed info when viewing */}
                        {dispositionDraft === disposition && disposition === 'Meeting Done' && (lead.meetingType || lead.meetingLocation) && (
                          <div className="flex flex-wrap gap-2">
                            {lead.meetingType && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-xs font-bold">
                                📅 {lead.meetingType}
                              </span>
                            )}
                            {lead.meetingLocation && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-xs font-medium max-w-full truncate">
                                📍 {lead.meetingLocation}
                              </span>
                            )}
                          </div>
                        )}

                        {dispositionDraft === disposition && disposition === 'Failed' && lead.failedReason && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs font-bold">
                              ❌ {lead.failedReason}
                            </span>
                          </div>
                        )}

                        <textarea
                          value={dispositionNoteDraft}
                          onChange={(e) => {
                            setDispositionNoteDraft(e.target.value)
                            if (dispositionNoteError) setDispositionNoteError('')
                          }}
                          rows={2}
                          placeholder={dispositionDraft === disposition ? 'Add note if you plan to change the status...' : `Add a required note for ${dispositionDraft}...`}
                          className={`w-full px-3 py-1.5 bg-[#F8FAFC] border rounded-lg text-xs text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                            dispositionNoteError
                              ? 'border-[#FCA5A5] focus:ring-red-100 focus:border-[#DC2626]'
                              : 'border-[#E2E8F0] focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8]'
                          }`}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-[10px] ${dispositionNoteError ? 'text-[#DC2626] font-semibold' : 'text-[#64748B]'}`}>
                            {dispositionNoteError || (dispositionDraft === disposition
                              ? 'Changing the lead status requires a note.'
                              : 'Status change will only save together with this note.')}
                          </p>
                          <button
                            type="button"
                            onClick={handleUpdateDisposition}
                            disabled={isUpdatingDisposition || dispositionDraft === disposition || !dispositionNoteDraft.trim()}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-[10px] font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUpdatingDisposition ? 'Updating...' : 'Update Status'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Qualification Section */}
                <div className="pt-2 border-t border-[#F1F5F9]">
                  <div className="flex items-center gap-2 mb-3 px-1 pt-2">
                    <div className="w-1 h-3 bg-[#7C3AED] rounded-full" />
                    <h2 className="text-xs font-bold text-[#0F172A]">Detailed Qualification</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                    {qualificationFields.map((field) => {
                      const Icon =
                        field.key === 'city'
                          ? MapPin
                          : field.key === 'budget'
                            ? DollarSign
                            : field.key === 'buildType'
                              ? Building2
                              : field.key === 'plotOwned'
                                ? CheckCircle2
                                : field.key === 'campaign'
                                  ? Phone
                                  : field.key === 'email'
                                    ? Mail
                                    : User

                      const fieldValue =
                        field.key === 'city'
                          ? lead.city
                          : field.key === 'budget'
                            ? lead.budget
                            : field.key === 'buildType'
                              ? lead.buildType
                              : field.key === 'plotOwned'
                                ? lead.plotOwned
                                  ? 'Yes'
                                  : 'No'
                                : field.key === 'campaign'
                                  ? lead.campaign
                                  : lead.email

                      const fieldOptions =
                        field.key === 'city'
                          ? cityOptions
                          : field.key === 'buildType'
                            ? buildTypeOptions
                            : field.key === 'plotOwned'
                              ? ['Yes', 'No']
                              : field.options || []

                      return (
                        <div key={field.key} className="group">
                          <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1 group-focus-within:text-[#1D4ED8] transition-colors">
                            {field.label}
                          </label>
                          <div className="relative">
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-focus-within:text-[#1D4ED8] transition-colors pointer-events-none z-10">
                              <Icon size={12} />
                            </div>
                            {field.type === 'select' || field.type === 'boolean' ? (
                              <div className="relative">
                                <select
                                  value={fieldValue || ''}
                                  onChange={(e) => {
                                    const nextValue =
                                      field.key === 'plotOwned' ? e.target.value === 'Yes' : e.target.value
                                    handleSaveQualification(field.key, nextValue)
                                  }}
                                  className="w-full pl-8 pr-7 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all appearance-none cursor-pointer"
                                >
                                  <option value="">{field.placeholder || 'Select...'}</option>
                                  {fieldOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
                              </div>
                            ) : (
                              <input
                                key={`${field.key}-${fieldValue ?? ''}`}
                                type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                                defaultValue={fieldValue || ''}
                                onBlur={(e) => {
                                  const nextValue =
                                    field.type === 'number'
                                      ? e.target.value
                                        ? Number(e.target.value)
                                        : null
                                      : e.target.value
                                  handleSaveQualification(field.key, nextValue)
                                }}
                                placeholder={field.placeholder || ''}
                                className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {plotSizeField || plotSizeUnitField ? (
                      <div className="md:col-span-2 lg:col-span-2 group">
                        <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1 group-focus-within:text-[#1D4ED8] transition-colors">
                          {plotSizeField?.label || 'Plot Size'}
                          {plotSizeUnitField ? ' & Units' : ''}
                        </label>
                        <div className="flex gap-2">
                          {plotSizeField ? (
                            <input
                              type="text"
                              value={plotSize}
                              onChange={(e) => setPlotSize(e.target.value)}
                              onBlur={(e) => handleSaveQualification('plotSize', e.target.value || null)}
                              placeholder={plotSizeField.placeholder || 'Size...'}
                              className="flex-1 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all"
                            />
                          ) : (
                            <div className="flex-1" />
                          )}
                          {plotSizeUnitField ? (
                            <div className="relative w-28">
                              <select
                                value={plotUnit}
                                onChange={(e) => {
                                  setPlotUnit(e.target.value)
                                  handleSaveQualification('plotSizeUnit', e.target.value)
                                }}
                                className="w-full appearance-none px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer"
                              >
                                {(plotSizeUnitField.options || []).map((unit) => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Assigned To</label>
                      {user?.role === 'manager' ? (
                        <RepresentativePicker
                          value={lead.owner ? String(lead.owner) : null}
                          onChange={(nextValue) => handleAssignLead(nextValue)}
                          options={representatives}
                        />
                      ) : (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                          <div className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-[8px] font-bold ring-2 ring-white">
                            {lead.ownerName ? lead.ownerName.split(' ').map(n => n[0]).join('') : 'U'}
                          </div>
                          <span className="text-[11px] font-semibold text-[#0F172A]">{lead.ownerName || 'Unassigned'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dialpad Section - Compacted */}
              <div className="flex flex-col rounded-lg border border-[#E2E8F0] bg-white p-2 shadow-sm">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-[11px] font-bold text-[#0F172A]">Dialer</h3>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={savePhoneNumber}
                    disabled={!editablePhone.trim() || editablePhone.trim() === (lead.phone || '').trim()}
                    className="px-2.5 py-1 rounded-md bg-[#0F172A] text-white text-[9px] font-bold hover:bg-[#1E293B] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>

                {/* Representative Selector for Managers */}
                {user?.role === 'manager' && !activeCall && (
                  <div className="mb-2 px-1">
                    <label className="text-[8px] font-bold text-[#64748B] uppercase tracking-wider mb-0.5 block px-1">Calling As</label>
                    <div className="relative group">
                      <select
                        value={selectedRepresentativeId}
                        onChange={(e) => setSelectedRepresentativeId(e.target.value)}
                        className="w-full appearance-none pl-2.5 pr-7 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[10px] font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer"
                      >
                        {[
                          ...(user?.id ? [{ id: user.id, name: 'My phone' }] : []),
                          ...representatives.filter(r => r.id !== user?.id)
                        ].map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-2 shadow-inner mb-2">
                  <div className="flex flex-col items-center">
                    {activeCall && ['initiated', 'ringing', 'in-progress'].includes(activeCall.status) ? (
                      <div className="w-full flex flex-col items-center">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${activeCall.status === 'in-progress' ? 'bg-[#16A34A] animate-pulse' : 'bg-[#F59E0B]'}`} />
                          <span className="text-[9px] font-bold text-[#475569] uppercase tracking-wider">
                            {activeCall.status === 'in-progress' ? 'Live Call' : 'Dialing...'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[#0F172A] mb-1">{activeCall.phone}</p>
                        <button
                          onClick={async () => {
                            if (activeCall.exotelCallSid) {
                              await callsAPI.syncCall(activeCall.exotelCallSid)
                              fetchCallLogs()
                            }
                          }}
                          className="w-full py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <PhoneOff size={12} /> End Call
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={editablePhone}
                          onChange={(e) => handlePhoneInputChange(e.target.value)}
                          onBlur={savePhoneNumber}
                          placeholder={phoneField?.placeholder || 'Number...'}
                          className="w-full bg-transparent border-none p-0 text-center text-sm leading-none tracking-tight font-bold text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none"
                          inputMode="tel"
                        />
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" onClick={() => setEditablePhone('')} className="text-[8px] font-bold text-[#64748B] hover:text-[#0F172A]">Clear</button>
                          <div className="w-px h-2 bg-[#E2E8F0]" />
                          <button type="button" onClick={deleteLastPhoneDigit} className="text-[8px] font-bold text-[#64748B] hover:text-[#0F172A]">Back</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {activeCall && ['initiated', 'ringing', 'in-progress'].includes(activeCall.status) ? (
                    <div className="col-span-3 py-2 text-center">
                      <p className="text-[9px] text-[#94A3B8] font-medium leading-relaxed">
                        Call in progress via Exotel.<br/>Controls will reset once the call ends.
                      </p>
                    </div>
                  ) : (
                    <>
                      {dialPadButtons.map((button) => (
                        <button
                          key={button.value}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => appendPhoneDigit(button.value)}
                          className="group flex flex-col items-center justify-center h-7 rounded-md bg-white border border-[#F1F5F9] hover:border-[#1D4ED8] hover:bg-[#F8FBFF] transition-all duration-200"
                        >
                          <span className="text-sm font-bold text-[#0F172A] group-hover:text-[#1D4ED8] leading-none">{button.value}</span>
                          {button.letters && (
                            <span className="text-[6px] font-bold text-[#94A3B8] group-hover:text-[#1D4ED8]/60 uppercase tracking-tighter">{button.letters}</span>
                          )}
                        </button>
                      ))}
                      <button
                        onClick={startCall}
                        disabled={!canPlaceCall || callState === 'dialing'}
                        className="col-span-3 mt-1 h-9 rounded-lg bg-[#16A34A] text-white text-[11px] font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <PhoneCall size={14} /> {callState === 'dialing' ? 'Dialing...' : 'Start Call'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReminderForm(true)}
                        className="col-span-3 h-8 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-[11px] font-bold hover:bg-[#DBEAFE] transition-all flex items-center justify-center gap-1.5"
                      >
                        <Calendar size={14} />
                        Set Call Reminder
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Notes Section */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-3 shadow-sm">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-[#0F172A]">Status Notes</h2>
                  <p className="text-[10px] text-[#64748B] mt-0.5 font-medium">Document and track lead progression.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#475569]">Current: {disposition}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {dispositionOptions.map((status) => {
                  const isSelected = activeNoteStatus === status
                  const isCurrent = disposition === status
                  const noteCount = noteCounts[status] || 0

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedNoteStatus(status)}
                      className={`group relative inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-all duration-200 ${
                        isSelected
                          ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-sm'
                          : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#1D4ED8] hover:bg-[#F8FBFF] hover:text-[#1D4ED8]'
                      }`}
                    >
                      <span>{status}</span>
                      {noteCount > 0 && (
                        <span
                          className={`flex items-center justify-center min-w-[16px] h-[16px] rounded px-0.5 text-[9px] font-extrabold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#E0E7FF] group-hover:text-[#1D4ED8]'
                          }`}
                        >
                          {noteCount}
                        </span>
                      )}
                      {isCurrent && !isSelected && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10B981] rounded-full border border-white shadow-sm" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-3">
              {/* Add New Note Card */}
              <div className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white p-3.5 hover:border-[#CBD5E1] transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-1.5 h-4 rounded-full ${editingStatusNoteId ? 'bg-amber-500' : 'bg-[#1D4ED8]'}`} />
                      <p className={`text-[11px] font-extrabold uppercase tracking-wider ${editingStatusNoteId ? 'text-amber-600' : 'text-[#1D4ED8]'}`}>
                        {editingStatusNoteId ? 'Edit Note' : 'Add Note'}
                      </p>
                    </div>
                    <h3 className="text-xl font-bold text-[#0F172A]">{activeNoteStatus}</h3>
                  </div>
                  {editingStatusNoteId ? (
                    <button 
                      onClick={resetStatusNoteComposer}
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      title="Cancel Edit"
                    >
                      <X size={16} />
                    </button>
                  ) : noteCounts[activeNoteStatus] > 0 && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-tighter mb-0.5">Stored</span>
                      <span className="text-lg font-black text-[#1D4ED8] leading-none">
                        {noteCounts[activeNoteStatus]}
                      </span>
                    </div>
                  )}
                </div>

                <div className="relative group">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={`What happened in ${activeNoteStatus} stage?`}
                    rows={6}
                    className={`w-full px-4 py-4 border rounded-2xl text-sm text-[#0F172A] placeholder-[#94A3B8] resize-none focus:outline-none focus:ring-4 transition-all shadow-inner ${
                      editingStatusNoteId 
                        ? 'bg-amber-50/30 border-amber-200 focus:ring-amber-500/5 focus:border-amber-500 focus:bg-white' 
                        : 'bg-[#F8FAFC] border-[#E2E8F0] focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white'
                    }`}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-start gap-2.5 px-1">
                    <div className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center shrink-0 ${editingStatusNoteId ? 'bg-amber-100' : 'bg-blue-50'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${editingStatusNoteId ? 'bg-amber-600' : 'bg-[#1D4ED8]'}`} />
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#64748B] font-medium">
                      {editingStatusNoteId 
                        ? 'Updating this note will modify the existing entry in the history.' 
                        : 'Notes are timestamped and linked to your profile for a clear audit trail.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {noteDraft && (
                      <button
                        type="button"
                        onClick={resetStatusNoteComposer}
                        className="flex-1 h-11 rounded-xl border border-[#E2E8F0] bg-white text-xs font-bold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-all"
                      >
                        {editingStatusNoteId ? 'Cancel' : 'Clear'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveStatusNote}
                      disabled={!noteDraft.trim() || isSavingStatusNote}
                      className={`flex-[2] h-11 rounded-xl text-white text-xs font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 ${
                        editingStatusNoteId 
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' 
                          : 'bg-[#0F172A] hover:bg-[#1E293B] shadow-slate-100'
                      }`}
                    >
                      {isSavingStatusNote ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{editingStatusNoteId ? 'Updating...' : 'Saving...'}</span>
                        </>
                      ) : (
                        <span>{editingStatusNoteId ? 'Update Note' : `Save to ${activeNoteStatus}`}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status History Card */}
              <div className="flex flex-col rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/50 p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] shadow-sm">
                      <History size={13} className="text-[#1D4ED8]" />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#64748B]">History</p>
                      <h3 className="text-xs font-bold text-[#0F172A]">{activeNoteStatus} Activity</h3>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] shadow-sm">
                    <span className="text-[11px] font-bold text-[#475569]">{filteredStatusNotes.length} Entries</span>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {filteredStatusNotes.length ? (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {filteredStatusNotes.map((entry, index) => (
                        <div key={entry._id || `${entry.status}-${entry.createdAt}-${index}`} className="group relative bg-white rounded-xl border border-[#E2E8F0] p-3 transition-all hover:border-[#1D4ED8] hover:shadow-md hover:shadow-blue-50/50">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-extrabold uppercase border border-[#DBEAFE]">
                                {entry.status}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-[#94A3B8]">{new Date(entry.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-[#334155] font-medium whitespace-pre-wrap">{entry.note}</p>
                          <div className="mt-2.5 pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] flex items-center justify-center overflow-hidden">
                                <User size={12} />
                              </div>
                              <span className="text-[11px] font-bold text-[#475569]">{entry.createdByName || 'BuildFlow user'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEditingStatusNote(entry)}
                                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1D4ED8] transition-all"
                                title="Edit Note"
                              >
                                <Pencil size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteStatusNote(entry)}
                                disabled={deletingStatusNoteId === entry._id}
                                className="p-1.5 rounded-lg text-[#64748B] hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                                title="Delete Note"
                              >
                                {deletingStatusNoteId === entry._id ? (
                                  <div className="w-3 h-3 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                              <div className="w-px h-3 bg-[#E2E8F0] mx-0.5" />
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(entry.note)
                                }}
                                className="text-[10px] font-bold text-[#1D4ED8] hover:underline px-1"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-12 px-6 rounded-[20px] border-2 border-dashed border-[#E2E8F0] bg-white/50 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-4">
                        <MessageSquare size={20} className="text-[#94A3B8]" />
                      </div>
                      <p className="text-sm font-bold text-[#0F172A]">No notes recorded yet</p>
                      <p className="text-xs text-[#64748B] mt-1.5 max-w-[200px] leading-relaxed">
                        Select a status and use the composer to start building the history.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Post Call Feedback Modal */}
          {showFeedbackModal && (
            <PostCallFeedbackModal
              leadName={lead.name}
              onSubmit={async (data) => {
                const latestCall = activeCall || calls[0]
                if (latestCall) {
                  await callsAPI.postCallFeedback(latestCall._id, {
                    outcome: data.outcome,
                    disposition: data.stage,
                    notes: data.notes,
                    nextFollowUp: data.followUpAt,
                  })
                  fetchCallLogs()
                  fetchLeadData()
                }
                setShowFeedbackModal(false)
                setCallState('idle')
              }}
              onClose={() => {
                setShowFeedbackModal(false)
                setCallState('idle')
              }}
            />
          )}

          {showReminderForm && (
            <CallReminderModal
              leadName={lead.name}
              phone={latestReminderCall?.phone || lead.phone}
              contextLabel={latestReminderCall ? `Last call ${new Date(latestReminderCall.startedAt || latestReminderCall.createdAt).toLocaleString('en-IN')}` : 'Lead follow-up'}
              onClose={() => setShowReminderForm(false)}
              onSubmit={createLeadReminder}
            />
          )}
        </div>

        {/* Right — Intelligence & Timeline */}
        <div className="w-80 border-l border-[#E2E8F0] bg-white overflow-y-auto">
          {/* Recording Player */}
          <div className="p-5 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-md">
                <Mic size={14} className="text-white" />
              </div>
              <p className="text-xs font-bold text-[#0F172A]">Latest Recording</p>
            </div>
            {!featureControls.callRecording ? (
              <div className="text-center py-6 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="w-10 h-10 rounded-full bg-[#E2E8F0] flex items-center justify-center mx-auto mb-2">
                  <Mic size={18} className="text-[#94A3B8]" />
                </div>
                <p className="text-xs text-[#64748B]">Recording playback is disabled</p>
              </div>
            ) : latestRecordingCall ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-[#EFF6FF] to-[#DBEAFE] px-4 py-3.5 border-b border-[#BFDBFE]">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center text-white shrink-0 shadow-md">
                      <Mic size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#0F172A] truncate">{getCallFromLabel(latestRecordingCall)}</p>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] text-[#64748B] font-medium">{getCallSecondaryLabel(latestRecordingCall)}</p>
                        {isIncomingExotelCall(latestRecordingCall) ? (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#1D4ED8] text-white shadow-sm">
                            Exotel
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#64748B]">
                        <Clock size={11} className="text-[#3B82F6]" />
                        <span className="font-medium">{new Date(latestRecordingCall.startedAt || latestRecordingCall.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status badges */}
                <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getRepresentativeLegMeta(latestRecordingCall) && (
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full border-2 shadow-sm"
                        style={{
                          color: getRepresentativeLegMeta(latestRecordingCall)!.color,
                          background: getRepresentativeLegMeta(latestRecordingCall)!.bg,
                          borderColor: `${getRepresentativeLegMeta(latestRecordingCall)!.color}40`,
                        }}
                      >
                        Rep: {getRepresentativeLegMeta(latestRecordingCall)!.label}
                      </span>
                    )}
                    {getCustomerLegMeta(latestRecordingCall) && (
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full border-2 shadow-sm"
                        style={{
                          color: getCustomerLegMeta(latestRecordingCall)!.color,
                          background: getCustomerLegMeta(latestRecordingCall)!.bg,
                          borderColor: `${getCustomerLegMeta(latestRecordingCall)!.color}40`,
                        }}
                      >
                        Client: {getCustomerLegMeta(latestRecordingCall)!.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Audio player */}
                <div className="p-4 bg-white">
                  <audio
                    controls
                    preload="metadata"
                    src={callsAPI.getRecordingUrl(latestRecordingCall._id)}
                    crossOrigin="anonymous"
                    className="w-full h-10"
                    style={{ 
                      borderRadius: '8px',
                    }}
                  />
                  <div className="mt-3 flex justify-end">
                    <a 
                      href={callsAPI.getRecordingUrl(latestRecordingCall._id)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#1D4ED8] hover:text-white hover:bg-[#1D4ED8] flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:shadow-md transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      Open in new tab
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="w-10 h-10 rounded-full bg-[#E2E8F0] flex items-center justify-center mx-auto mb-2">
                  <Mic size={18} className="text-[#94A3B8]" />
                </div>
                <p className="text-xs text-[#64748B]">No recordings available</p>
              </div>
            )}
          </div>

          {/* Follow-up Timeline */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-[#0F172A]">Follow-up Timeline</p>
              <button
                onClick={() => setShowFollowUpForm(true)}
                className="text-[10px] font-semibold px-2.5 py-1 bg-[#1D4ED8] text-white rounded hover:bg-[#1E40AF] transition-colors"
              >
                + Add
              </button>
            </div>

            {/* Follow-up Form */}
            {showFollowUpForm && (
              <div className="mb-4 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <p className="text-xs font-semibold text-[#0F172A] mb-2">
                  {editingFollowUpId ? 'Edit Follow-up' : 'New Follow-up'}
                </p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="flex-1 text-xs px-2 py-1.5 border border-[#E2E8F0] rounded focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                    />
                    <input
                      type="time"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      className="flex-1 text-xs px-2 py-1.5 border border-[#E2E8F0] rounded focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                    />
                  </div>
                  <textarea
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                    className="w-full text-xs px-2 py-1.5 border border-[#E2E8F0] rounded resize-none focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={editingFollowUpId ? () => handleUpdateFollowUp(editingFollowUpId, { scheduledAt: new Date(`${followUpDate}T${followUpTime}`).toISOString(), notes: followUpNotes }) : handleCreateFollowUp}
                      disabled={followUpLoading || !followUpDate || !followUpTime}
                      className="flex-1 text-[10px] font-semibold px-3 py-1.5 bg-[#1D4ED8] text-white rounded hover:bg-[#1E40AF] disabled:opacity-50 transition-colors"
                    >
                      {followUpLoading ? 'Saving...' : editingFollowUpId ? 'Update' : 'Save'}
                    </button>
                    <button
                      onClick={resetFollowUpForm}
                      className="text-[10px] font-semibold px-3 py-1.5 bg-[#F1F5F9] text-[#64748B] rounded hover:bg-[#E2E8F0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up List */}
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-[#E2E8F0]" />
              <div className="space-y-4">
                {followUps.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar size={20} className="text-[#94A3B8] mx-auto mb-2" />
                    <p className="text-xs text-[#64748B]">No follow-ups scheduled</p>
                  </div>
                ) : (
                  followUps.map((followUp) => {
                    const isPending = followUp.status === 'pending'
                    const isCompleted = followUp.status === 'completed'
                    const scheduledDate = new Date(followUp.scheduledAt)
                    const isPast = scheduledDate < new Date() && isPending

                    return (
                      <div key={followUp._id} className="flex gap-3 relative animate-fade-in">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm ${
                          isCompleted ? 'bg-green-100 border-2 border-green-300' :
                          isPast ? 'bg-red-100 border-2 border-red-300' :
                          'bg-amber-100 border-2 border-amber-300'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle size={12} className="text-green-600" />
                          ) : isPast ? (
                            <AlertCircle size={12} className="text-red-600" />
                          ) : (
                            <Clock size={12} className="text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold ${isPast ? 'text-red-600' : 'text-[#0F172A]'}`}>
                              {scheduledDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              isCompleted ? 'bg-green-100 text-green-700' :
                              isPast ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {followUp.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#475569] mt-0.5">
                            {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {followUp.notes && (
                            <p className="text-[10px] text-[#64748B] mt-1.5 bg-[#F8FAFC] p-2 rounded">
                              {followUp.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {isPending && (
                              <button
                                onClick={() => handleUpdateFollowUp(followUp._id, { status: 'completed' })}
                                className="text-[9px] font-medium px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                              >
                                Mark Done
                              </button>
                            )}
                            <button
                              onClick={() => openEditFollowUp(followUp)}
                              className="text-[9px] font-medium px-2 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded hover:bg-[#E2E8F0] transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFollowUp(followUp._id)}
                              className="text-[9px] font-medium px-2 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

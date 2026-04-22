import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, PhoneOff, PhoneCall, MapPin, Building2,
  IndianRupee, CheckCircle2, CheckCircle, Mic, ChevronDown, Edit3, User, Delete, Pencil, Trash2, X, History, MessageSquare, Clock, Calendar, ArrowUpRight, ArrowDownLeft, AlertCircle, Voicemail, Mail, Lock, Video, XCircle
} from 'lucide-react'
import { leadsAPI, type Lead, type Disposition, type LeadStatusNote, type FollowUp } from '../api/leads'
import { callsAPI, type Call } from '../api/calls'
import { remindersAPI } from '../api/reminders'
import { teamAPI } from '../api/team'
import PostCallFeedbackModal from '../components/leads/PostCallFeedbackModal'
import RecordingPlayer from '../components/calls/RecordingPlayer'
import RepresentativePicker, { type RepresentativePickerOption } from '../components/leads/RepresentativePicker'
import CreatedAtEditor, { formatDateTimeLocalInput } from '../components/leads/CreatedAtEditor'
import CallReminderModal from '../components/reminders/CallReminderModal'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useFeatureControls } from '../context/FeatureControlsContext'
import { settingsAPI, type LeadFieldConfig } from '../api/settings'
import { LEAD_FIELDS_STORAGE_KEY, LEAD_FIELDS_UPDATED_EVENT, normalizeLeadFieldConfigs } from '../utils/leadFields'

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

const formatLeadCreatedAtLabel = (value?: string | null) => {
  if (!value) return 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
  // Whether this user type ever needs the representative list (for picker & "Calling As" selector)
  const isRepOrManager = user?.role === 'manager' || user?.role === 'representative'
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const featureControls = useFeatureControls()
  const [calls, setCalls] = useState<Call[]>([])
  const [callState, setCallState] = useState<CallState>('idle')
  const [isStartingCall, setIsStartingCall] = useState(false)
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [disposition, setDisposition] = useState<string>('')
  const [dispositionDraft, setDispositionDraft] = useState<string>('')
  const [dispositionNoteDraft, setDispositionNoteDraft] = useState('')
  const [dispositionNoteError, setDispositionNoteError] = useState('')
  const [isUpdatingDisposition, setIsUpdatingDisposition] = useState(false)
  const [dispositionOptions, setDispositionOptions] = useState<string[]>(['New', 'Contacted/Open', 'Qualified', 'Visit Done', 'Meeting Done', 'Negotiation Done', 'Booking Done', 'Agreement Done', 'Failed'])
  const [cityOptions, setCityOptions] = useState<string[]>(['Ahmedabad', 'Gandhinagar', 'Vadodara', 'Surat', 'Rajkot'])
  const [sourceOptions, setSourceOptions] = useState<string[]>(['Direct', 'Manual', 'Meta', 'Website', 'Google ADS'])
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
  const [showStatusNoteModal, setShowStatusNoteModal] = useState(false)
  const [modalNoteText, setModalNoteText] = useState('')
  const [meetingType, setMeetingType] = useState<'VC' | 'Client Place' | ''>('')
  const [meetingLocation, setMeetingLocation] = useState('')
  const [failedReason, setFailedReason] = useState('')
  // Booking Done fields
  const [bookingPackage, setBookingPackage] = useState('')
  const [proposedProjectValue, setProposedProjectValue] = useState('')
  const [bookingAmountCollected, setBookingAmountCollected] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [numberOfFloors, setNumberOfFloors] = useState('')
  const [assignedArchitect, setAssignedArchitect] = useState('')
  // Agreement Done fields
  const [agreementProjectValue, setAgreementProjectValue] = useState('')
  const [agreementDate, setAgreementDate] = useState('')
  const [agreementAmount, setAgreementAmount] = useState('')
  const [totalCollection, setTotalCollection] = useState('')
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [representatives, setRepresentatives] = useState<RepresentativePickerOption[]>([])
  const [selectedRepresentativeId, setSelectedRepresentativeId] = useState<string>('')
  const [micState, setMicState] = useState<MicState>('idle')
  const [editableName, setEditableName] = useState('')
  const [editablePhone, setEditablePhone] = useState('')
  const [editableAlternatePhone, setEditableAlternatePhone] = useState('')
  const [dialingAlternate, setDialingAlternate] = useState(false)
  const [editableCreatedAt, setEditableCreatedAt] = useState('')
  const [createdAtEditorKey, setCreatedAtEditorKey] = useState(0)
  const [isDeletingLead, setIsDeletingLead] = useState(false)
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false)
  const sourceDropdownRef = useRef<HTMLDivElement>(null)
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

  // featureControls are now provided by FeatureControlsContext (loaded once app-wide)

  useEffect(() => {
    if (id) {
      fetchLeadData()
      fetchCallLogs()
      fetchFilters()
      if (isRepOrManager) {
        fetchRepresentatives()
      }
    }
  }, [id, isRepOrManager])

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
    if (!socket || !connected || !isRepOrManager) return

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
  }, [socket, connected, isRepOrManager])

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
        // Booking Done fields
        setBookingPackage(res.data.bookingPackage || '')
        setProposedProjectValue(res.data.proposedProjectValue || '')
        setBookingAmountCollected(res.data.bookingAmountCollected || '')
        setBookingDate(res.data.bookingDate ? res.data.bookingDate.split('T')[0] : '')
        setNumberOfFloors(res.data.numberOfFloors || '')
        setAssignedArchitect(res.data.assignedArchitect || '')
        // Agreement Done fields
        setAgreementProjectValue(res.data.agreementProjectValue || '')
        setAgreementDate(res.data.agreementDate ? res.data.agreementDate.split('T')[0] : '')
        setAgreementAmount(res.data.agreementAmount || '')
        setTotalCollection(res.data.totalCollection || '')
        setEditableName(res.data.name || '')
        setEditablePhone(res.data.phone || '')
        setEditableAlternatePhone(res.data.alternatePhone || '')
        setEditableCreatedAt(formatDateTimeLocalInput(res.data.createdAt))
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
        if (res.data.sources) {
          setSourceOptions(res.data.sources.filter((s: string) => s !== 'All'))
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

  const executeDispositionUpdate = async (noteToUse: string) => {
    const nextDisp = dispositionDraft
    if (!lead || nextDisp === disposition) return

    if (nextDisp === 'Meeting Done' && !meetingType) {
      setDispositionNoteError('Select Meeting Type (VC or Client Place) before saving.')
      return
    }

    try {
      setIsUpdatingDisposition(true)
      setDispositionNoteError('')
      setSelectedNoteStatus(nextDisp)
      const res = await leadsAPI.updateDisposition(id!, nextDisp, noteToUse)
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
        if (nextDisp === 'Booking Done') {
          extraFields.bookingPackage = bookingPackage.trim() || null
          extraFields.proposedProjectValue = proposedProjectValue.trim() || null
          extraFields.bookingAmountCollected = bookingAmountCollected.trim() || null
          extraFields.bookingDate = bookingDate || null
          extraFields.numberOfFloors = numberOfFloors.trim() || null
          extraFields.assignedArchitect = assignedArchitect.trim() || null
        }
        if (nextDisp === 'Agreement Done') {
          extraFields.agreementProjectValue = agreementProjectValue.trim() || null
          extraFields.agreementDate = agreementDate || null
          extraFields.agreementAmount = agreementAmount.trim() || null
          extraFields.totalCollection = totalCollection.trim() || null
        }
        if (Object.keys(extraFields).length > 0) {
          const updRes = await leadsAPI.updateLead(id!, extraFields)
          if (updRes.success) {
            setLead(updRes.data)
            setMeetingType((updRes.data.meetingType as 'VC' | 'Client Place' | '') || '')
            setMeetingLocation(updRes.data.meetingLocation || '')
            setFailedReason(updRes.data.failedReason || '')
            setBookingPackage(updRes.data.bookingPackage || '')
            setProposedProjectValue(updRes.data.proposedProjectValue || '')
            setBookingAmountCollected(updRes.data.bookingAmountCollected || '')
            setBookingDate(updRes.data.bookingDate ? updRes.data.bookingDate.split('T')[0] : '')
            setNumberOfFloors(updRes.data.numberOfFloors || '')
            setAssignedArchitect(updRes.data.assignedArchitect || '')
            setAgreementProjectValue(updRes.data.agreementProjectValue || '')
            setAgreementDate(updRes.data.agreementDate ? updRes.data.agreementDate.split('T')[0] : '')
            setAgreementAmount(updRes.data.agreementAmount || '')
            setTotalCollection(updRes.data.totalCollection || '')
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

  const handleUpdateDisposition = () => {
    if (!isLeadOwner) return
    if (!lead || dispositionDraft === disposition) return
    const note = dispositionNoteDraft.trim()
    if (!note) {
      // Open modal to collect the note
      setModalNoteText('')
      setShowStatusNoteModal(true)
      return
    }
    void executeDispositionUpdate(note)
  }

  const handleConfirmModalNote = () => {
    const note = modalNoteText.trim()
    if (!note) return
    setDispositionNoteDraft(note)
    setShowStatusNoteModal(false)
    setModalNoteText('')
    void executeDispositionUpdate(note)
  }

  useEffect(() => {
    if (!sourceDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target as Node)) {
        setSourceDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sourceDropdownOpen])

  const handleSaveQualification = async (field: string, value: any) => {
    if (!isLeadOwner) return // Non-owners cannot edit
    try {
      const res = await leadsAPI.updateLead(id!, { [field]: value })
      if (res.success) {
        setLead(res.data)
        setEditableName(res.data.name || '')
        setEditablePhone(res.data.phone || '')
        setEditableAlternatePhone(res.data.alternatePhone || '')
        setEditableCreatedAt(formatDateTimeLocalInput(res.data.createdAt))
      }
    } catch (err) {
      console.error('Failed to update lead:', err)
    }
  }

  const handleAssignLead = async (assignedTo: string | null) => {
    try {
      const res = await leadsAPI.assignLead(id!, assignedTo)
      if (res.success) {
        if (user?.role === 'representative' && assignedTo && String(assignedTo) !== String(user.id)) {
          navigate('/leads')
          return
        }
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
    if (dialingAlternate) {
      setEditableAlternatePhone((current) => `${current}${digit}`)
    } else {
      setEditablePhone((current) => `${current}${digit}`)
    }
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

  const saveAlternatePhone = async () => {
    const nextPhone = editableAlternatePhone.trim()
    const currentPhone = lead?.alternatePhone?.trim() || ''
    if (nextPhone === currentPhone) {
      setEditableAlternatePhone(lead?.alternatePhone || '')
      return
    }
    await handleSaveQualification('alternatePhone', nextPhone || null)
  }

  const saveCreatedAt = async () => {
    if (!lead) return

    const nextCreatedAt = editableCreatedAt.trim()
    const currentCreatedAt = formatDateTimeLocalInput(lead.createdAt)

    if (!nextCreatedAt || nextCreatedAt === currentCreatedAt) {
      setEditableCreatedAt(currentCreatedAt)
      return
    }

    await handleSaveQualification('createdAt', new Date(nextCreatedAt).toISOString())
    setCreatedAtEditorKey((k) => k + 1)
  }

  const resetStatusNoteComposer = () => {
    setNoteDraft('')
    setEditingStatusNoteId(null)
    setDeletingStatusNoteId(null)
  }

  const saveStatusNote = async () => {
    if (!isLeadOwner) return // Non-owners cannot add or edit notes
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
    if (isStartingCall) {
      return
    }

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
      setIsStartingCall(true)
      await ensureMicrophoneReady()
      setCallState('dialing')

      const res = await callsAPI.initiateCall({
        leadId: id!,
        representativeId: selectedRepresentativeId,
        recordCall: featureControls.callRecording,
        useAlternatePhone: dialingAlternate,
      })
      if (res.success) {
        setActiveCall(res.data)
        setCallState(['initiated', 'ringing'].includes(res.data.status) ? 'dialing' : 'connected')
      }
    } catch (err: any) {
      console.error('Failed to initiate call:', err)
      alert(err?.response?.data?.message || err?.message || 'Failed to initiate call')
      setCallState('idle')
    } finally {
      setIsStartingCall(false)
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
  const budgetField = activeLeadFields.find((field) => field.key === 'budget')
  const buildTypeField = activeLeadFields.find((field) => field.key === 'buildType')
  const plotOwnedField = activeLeadFields.find((field) => field.key === 'plotOwned')
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

  // Ownership gate: managers have full access; reps only if they are the current lead owner.
  // Non-owners can VIEW the lead but cannot edit, transfer, or manage follow-ups.
  // Defined before the loading guard so handlers (defined above) can reference it safely.
  const isLeadOwner = user?.role === 'manager' || Boolean(lead?.owner && String(lead.owner) === String(user?.id))

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
    !selectedCallingMember?.activeCallSid &&
    (dialingAlternate ? Boolean(lead.alternatePhone) : Boolean(lead.phone))

  const callActionLabel = !canPlaceCall
    ? !featureControls.dialer
      ? 'Dialer disabled'
      : dialingAlternate && !lead.alternatePhone
      ? 'No alternate number'
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
    if (!lead?._id || !followUpDate || !followUpTime) {
      console.warn('[FollowUp] Cannot create: missing lead ID, date or time')
      return
    }
    
    try {
      setFollowUpLoading(true)
      const scheduledAt = new Date(`${followUpDate}T${followUpTime}`).toISOString()
      
      console.log('[FollowUp] Creating follow-up for lead:', lead._id, 'scheduledAt:', scheduledAt)
      
      const response = await leadsAPI.createFollowUp(lead._id, {
        scheduledAt,
        notes: followUpNotes,
      })
      
      console.log('[FollowUp] Create response:', response)
      
      if (response.success && response.data) {
        // Optimistically add to list first for immediate UI update
        setFollowUps((current) => [response.data, ...current].sort((a, b) => 
          +new Date(b.scheduledAt) - +new Date(a.scheduledAt)
        ))
        
        // Then fetch full list to ensure consistency
        await fetchFollowUps()
        
        // Clear form and close
        setShowFollowUpForm(false)
        setFollowUpDate('')
        setFollowUpTime('')
        setFollowUpNotes('')
        setEditingFollowUpId(null)
        
        console.log('[FollowUp] Successfully created and refreshed list')
      } else {
        console.error('[FollowUp] Create failed:', response)
        alert('Failed to create follow-up. Please try again.')
      }
    } catch (error: any) {
      console.error('[FollowUp] Error creating follow-up:', error)
      alert(error?.response?.data?.message || 'Failed to create follow-up. Please try again.')
    } finally {
      setFollowUpLoading(false)
    }
  }

  const handleUpdateFollowUp = async (followUpId: string, updates: { status?: 'pending' | 'completed' | 'cancelled', scheduledAt?: string, notes?: string }) => {
    if (!lead?._id) return
    
    try {
      setFollowUpLoading(true)
      
      // Optimistically update UI first
      setFollowUps((current) => 
        current.map((f) => 
          f._id === followUpId 
            ? { ...f, ...updates, updatedAt: new Date().toISOString() }
            : f
        ).sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
      )
      
      const response = await leadsAPI.updateFollowUp(lead._id, followUpId, updates)
      
      if (response.success && response.data) {
        // Update with server data
        setFollowUps((current) => 
          current.map((f) => 
            f._id === followUpId ? response.data : f
          ).sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
        )
        
        // Close form if editing
        if (editingFollowUpId === followUpId) {
          resetFollowUpForm()
        }
      } else {
        // Re-fetch on failure to ensure consistency
        await fetchFollowUps()
      }
    } catch (error: any) {
      console.error('[FollowUp] Error updating follow-up:', error)
      alert(error?.response?.data?.message || 'Failed to update follow-up.')
      // Re-fetch on error
      await fetchFollowUps()
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
      
      // Optimistically remove from UI first
      const previousFollowUps = followUps
      setFollowUps((current) => current.filter((f) => f._id !== followUpId))
      
      const response = await leadsAPI.deleteFollowUp(lead._id, followUpId)
      
      if (!response.success) {
        // Restore on failure
        setFollowUps(previousFollowUps)
        alert('Failed to delete follow-up.')
      }
      // On success, item is already removed - fetch to ensure consistency
      await fetchFollowUps()
    } catch (error: any) {
      console.error('[FollowUp] Error deleting follow-up:', error)
      alert(error?.response?.data?.message || 'Failed to delete follow-up.')
      // Re-fetch on error to restore correct state
      await fetchFollowUps()
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
              {(() => {
                // "via Make.com" should only appear for sources that ACTUALLY route
                // through the Make.com bridge. Anything with a dedicated native
                // webhook (Website, Google ADS, LinkedIn) is ingested directly by
                // BuildFlow — NOT through Make — even though Make can populate
                // externalId as a side effect in some scenarios. Explicit exclude
                // list keeps the badge honest.
                const src = (lead.source || '').toLowerCase().trim()
                const NATIVE_WEBHOOK_SOURCES = new Set([
                  'website',
                  'manual',
                  'direct',
                  'referral',
                  'google ads',
                  'google-ads',
                  'linkedin',
                ])
                if (!lead.externalId || NATIVE_WEBHOOK_SOURCES.has(src)) return null
                return (
                  <span
                    title="This lead was ingested via the Make.com automation bridge"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE] uppercase tracking-wide"
                  >
                    via Make.com
                  </span>
                )
              })()}
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">Lead ID: {lead._id} · Created {formatLeadCreatedAtLabel(lead.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Left — primary work area */}
        <div className="flex-1 p-3 space-y-3">
          {(user?.role === 'manager' || (isLeadOwner && featureControls.representativeCanDelete)) ? (
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
          ) : null}

          {/* View-Only banner — shown when rep is not the lead owner */}
          {!isLeadOwner && user?.role === 'representative' && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]">
              <div className="w-5 h-5 rounded-full bg-[#F97316] flex items-center justify-center shrink-0">
                <User size={11} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#92400E]">View Only — You are not the owner of this lead</p>
                <p className="text-[10px] text-[#B45309] mt-0.5">Editing, transferring, and follow-up management are restricted to the lead owner ({lead.ownerName || 'the assigned representative'}).</p>
              </div>
            </div>
          )}

          {/* Top Attribute Cards — config-driven, respect Settings active state & labels */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(
              [
                budgetField ? { key: 'budget', label: budgetField.label, value: lead.budget || '—', Icon: IndianRupee, color: '#16A34A' } : null,
                buildTypeField ? { key: 'buildType', label: buildTypeField.label, value: lead.buildType || '—', Icon: Building2, color: '#7C3AED' } : null,
                plotOwnedField ? { key: 'plotOwned', label: plotOwnedField.label, value: lead.plotOwned ? 'Owned' : 'Not Owned', Icon: CheckCircle2, color: lead.plotOwned ? '#16A34A' : '#94A3B8' } : null,
              ] as const
            ).filter((item): item is NonNullable<typeof item> => item !== null).map(({ key, label, value, Icon, color }) => (
              <div key={key} className="group flex flex-col gap-1 p-2 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#1D4ED8] hover:shadow-sm transition-all duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider">{label}</span>
                  <div className="p-1 rounded-md group-hover:scale-110 transition-transform" style={{ background: `${color}10` }}>
                    <Icon size={10} style={{ color }} />
                  </div>
                </div>
                <p className="text-sm font-bold text-[#0F172A] tracking-tight truncate">{value}</p>
              </div>
            ))}
            {/* Source card — editable dropdown for lead owners, static for observers */}
            <div
              ref={sourceDropdownRef}
              onClick={() => isLeadOwner && setSourceDropdownOpen((o) => !o)}
              className={`relative group flex flex-col gap-1 p-2 rounded-lg bg-white border border-[#E2E8F0] transition-all duration-300 ${isLeadOwner ? 'hover:border-[#1D4ED8] hover:shadow-sm cursor-pointer select-none' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider">Source</span>
                <div className="p-1 rounded-md group-hover:scale-110 transition-transform" style={{ background: '#1D4ED810' }}>
                  <Phone size={10} style={{ color: '#1D4ED8' }} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-[#0F172A] tracking-tight truncate">{lead.source || '—'}</span>
                {isLeadOwner && <ChevronDown size={11} className={`shrink-0 text-[#94A3B8] transition-transform duration-200 ${sourceDropdownOpen ? 'rotate-180' : ''}`} />}
              </div>
              {isLeadOwner && sourceDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {sourceOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        void handleSaveQualification('source', s)
                        setSourceDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                        lead.source === s
                          ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                          : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                          readOnly={!isLeadOwner}
                          onChange={(e) => isLeadOwner && setEditableName(e.target.value)}
                          onBlur={(e) => {
                            if (!isLeadOwner) return
                            const nextName = e.target.value.trim()
                            if (nextName && nextName !== lead.name) {
                              handleSaveQualification('name', nextName)
                            } else {
                              setEditableName(lead.name || '')
                            }
                          }}
                          placeholder={contactNameField?.placeholder || 'Customer name'}
                          className={`w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm leading-tight text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all ${!isLeadOwner ? 'cursor-default' : ''}`}
                        />
                      </div>

                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Lead Status</label>
                      <div className="space-y-2">
                        <div className="relative group">
                          <select
                            value={dispositionDraft}
                            disabled={!isLeadOwner}
                            onChange={(e) => {
                              setDispositionDraft(e.target.value)
                              setSelectedNoteStatus(e.target.value)
                              setDispositionNoteError('')
                            }}
                            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {dispositionOptions.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
                        </div>
                        {/* Meeting Done sub-options */}
                        {dispositionDraft === 'Meeting Done' && (() => {
                          const isMeetingLocked = user?.role === 'representative' && disposition === 'Meeting Done'
                          return (
                            <div className="space-y-2">
                              {isMeetingLocked && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFF7ED] border border-[#FED7AA] rounded-lg">
                                  <Lock size={11} className="text-[#EA580C] shrink-0" />
                                  <span className="text-[10px] font-semibold text-[#EA580C]">Meeting details can only be changed by a manager</span>
                                </div>
                              )}
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">
                                  Meeting Type {!isMeetingLocked && <span className="text-[#DC2626]">*</span>}
                                </label>
                                <div className="flex gap-2">
                                  {(['VC', 'Client Place'] as const).map((type) => (
                                    <button
                                      key={type}
                                      type="button"
                                      disabled={isMeetingLocked}
                                      onClick={() => { if (!isMeetingLocked) { setMeetingType(type); if (dispositionNoteError) setDispositionNoteError('') } }}
                                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                        meetingType === type
                                          ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-md'
                                          : isMeetingLocked
                                            ? 'bg-[#F1F5F9] border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
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
                                    readOnly={isMeetingLocked}
                                    onChange={(e) => !isMeetingLocked && setMeetingLocation(e.target.value)}
                                    placeholder="Enter client address or Google Maps link..."
                                    className={`w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/10 focus:border-[#7C3AED] focus:bg-white transition-all ${isMeetingLocked ? 'cursor-default opacity-70' : ''}`}
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })()}

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
                                {['Budget Issue', 'Not Interested', 'Location Issue', 'Timeline Issue', 'Competition', 'Not Responding', 'Not Enquired', 'Invalid Number', 'Other'].map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#DC2626] pointer-events-none" />
                            </div>
                          </div>
                        )}

                        {/* Booking Done sub-fields */}
                        {dispositionDraft === 'Booking Done' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Package Selected</label>
                                <input
                                  value={bookingPackage}
                                  onChange={(e) => setBookingPackage(e.target.value)}
                                  placeholder="e.g. Premium, Standard..."
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Proposed Project Value</label>
                                <input
                                  value={proposedProjectValue}
                                  onChange={(e) => setProposedProjectValue(e.target.value)}
                                  placeholder="e.g. ₹45,00,000"
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Booking Amount Collected</label>
                                <input
                                  value={bookingAmountCollected}
                                  onChange={(e) => setBookingAmountCollected(e.target.value)}
                                  placeholder="e.g. ₹2,00,000"
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Booking Date</label>
                                <input
                                  type="date"
                                  value={bookingDate}
                                  onChange={(e) => setBookingDate(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">No. of Floors</label>
                                <input
                                  value={numberOfFloors}
                                  onChange={(e) => setNumberOfFloors(e.target.value)}
                                  placeholder="e.g. G+2"
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Assigned Architect</label>
                                <input
                                  value={assignedArchitect}
                                  onChange={(e) => setAssignedArchitect(e.target.value)}
                                  placeholder="Architect name..."
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#059669]/10 focus:border-[#059669] focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Agreement Done sub-fields */}
                        {dispositionDraft === 'Agreement Done' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Project Value as per Agreement</label>
                                <input
                                  value={agreementProjectValue}
                                  onChange={(e) => setAgreementProjectValue(e.target.value)}
                                  placeholder="e.g. ₹48,00,000"
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Agreement Date</label>
                                <input
                                  type="date"
                                  value={agreementDate}
                                  onChange={(e) => setAgreementDate(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Agreement Amount</label>
                                <input
                                  value={agreementAmount}
                                  onChange={(e) => setAgreementAmount(e.target.value)}
                                  placeholder="e.g. ₹5,00,000"
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1">Total Collection Till Date</label>
                                <input
                                  value={totalCollection}
                                  onChange={(e) => setTotalCollection(e.target.value)}
                                  placeholder="e.g. ₹10,00,000"
                                  className="w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Show existing meeting/failed info when viewing */}
                        {dispositionDraft === disposition && disposition === 'Meeting Done' && (lead.meetingType || lead.meetingLocation) && (
                          <div className="flex flex-wrap gap-2">
                            {lead.meetingType && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-xs font-bold">
                                <Video size={11} className="shrink-0" /> {lead.meetingType}
                              </span>
                            )}
                            {lead.meetingLocation && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-xs font-medium max-w-full truncate">
                                <MapPin size={11} className="shrink-0" /> {lead.meetingLocation}
                              </span>
                            )}
                          </div>
                        )}

                        {dispositionDraft === disposition && disposition === 'Failed' && lead.failedReason && (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs font-bold">
                              <XCircle size={11} className="shrink-0" /> {lead.failedReason}
                            </span>
                          </div>
                        )}

                        {/* Show existing Booking Done info when viewing */}
                        {dispositionDraft === disposition && disposition === 'Booking Done' && (
                          lead.bookingPackage || lead.proposedProjectValue || lead.bookingAmountCollected ||
                          lead.bookingDate || lead.numberOfFloors || lead.assignedArchitect
                        ) && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
                            {lead.bookingPackage && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Package</span>
                                <span className="text-xs font-semibold text-[#166534]">{lead.bookingPackage}</span>
                              </div>
                            )}
                            {lead.proposedProjectValue && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Project Value</span>
                                <span className="text-xs font-semibold text-[#166534]">{lead.proposedProjectValue}</span>
                              </div>
                            )}
                            {lead.bookingAmountCollected && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Booking Amount</span>
                                <span className="text-xs font-semibold text-[#166534]">{lead.bookingAmountCollected}</span>
                              </div>
                            )}
                            {lead.bookingDate && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Booking Date</span>
                                <span className="text-xs font-semibold text-[#166534]">{new Date(lead.bookingDate).toLocaleDateString('en-IN')}</span>
                              </div>
                            )}
                            {lead.numberOfFloors && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">No. of Floors</span>
                                <span className="text-xs font-semibold text-[#166534]">{lead.numberOfFloors}</span>
                              </div>
                            )}
                            {lead.assignedArchitect && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Architect</span>
                                <span className="text-xs font-semibold text-[#166534]">{lead.assignedArchitect}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Show existing Agreement Done info when viewing */}
                        {dispositionDraft === disposition && disposition === 'Agreement Done' && (
                          lead.agreementProjectValue || lead.agreementDate || lead.agreementAmount || lead.totalCollection
                        ) && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
                            {lead.agreementProjectValue && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Agreement Value</span>
                                <span className="text-xs font-semibold text-[#1e40af]">{lead.agreementProjectValue}</span>
                              </div>
                            )}
                            {lead.agreementDate && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Agreement Date</span>
                                <span className="text-xs font-semibold text-[#1e40af]">{new Date(lead.agreementDate).toLocaleDateString('en-IN')}</span>
                              </div>
                            )}
                            {lead.agreementAmount && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Agreement Amount</span>
                                <span className="text-xs font-semibold text-[#1e40af]">{lead.agreementAmount}</span>
                              </div>
                            )}
                            {lead.totalCollection && (
                              <div>
                                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Total Collection</span>
                                <span className="text-xs font-semibold text-[#1e40af]">{lead.totalCollection}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                          {dispositionNoteError && (
                            <p className="text-[10px] text-[#DC2626] font-semibold">{dispositionNoteError}</p>
                          )}
                          <div className="ml-auto">
                            <button
                              type="button"
                              onClick={handleUpdateDisposition}
                              disabled={!isLeadOwner || isUpdatingDisposition || dispositionDraft === disposition}
                              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-[10px] font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdatingDisposition ? 'Updating...' : 'Update Status'}
                            </button>
                          </div>
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
                            ? IndianRupee
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
                                  disabled={!isLeadOwner}
                                  onChange={(e) => {
                                    const nextValue =
                                      field.key === 'plotOwned' ? e.target.value === 'Yes' : e.target.value
                                    handleSaveQualification(field.key, nextValue)
                                  }}
                                  className="w-full pl-8 pr-7 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                                readOnly={!isLeadOwner}
                                onBlur={(e) => {
                                  if (!isLeadOwner) return
                                  const nextValue =
                                    field.type === 'number'
                                      ? e.target.value
                                        ? Number(e.target.value)
                                        : null
                                      : e.target.value
                                  handleSaveQualification(field.key, nextValue)
                                }}
                                placeholder={field.placeholder || ''}
                                className={`w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all ${!isLeadOwner ? 'cursor-default' : ''}`}
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
                              readOnly={!isLeadOwner}
                              onChange={(e) => isLeadOwner && setPlotSize(e.target.value)}
                              onBlur={(e) => isLeadOwner && handleSaveQualification('plotSize', e.target.value || null)}
                              placeholder={plotSizeField.placeholder || 'Size...'}
                              className={`flex-1 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all ${!isLeadOwner ? 'cursor-default' : ''}`}
                            />
                          ) : (
                            <div className="flex-1" />
                          )}
                          {plotSizeUnitField ? (
                            <div className="relative w-28">
                              <select
                                value={plotUnit}
                                disabled={!isLeadOwner}
                                onChange={(e) => {
                                  if (!isLeadOwner) return
                                  setPlotUnit(e.target.value)
                                  handleSaveQualification('plotSizeUnit', e.target.value)
                                }}
                                className="w-full appearance-none px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                      {isLeadOwner ? (
                        <RepresentativePicker
                          value={lead.owner ? String(lead.owner) : null}
                          onChange={(nextValue) => handleAssignLead(nextValue)}
                          options={representatives}
                          allowUnassigned={user?.role === 'manager'}
                          placeholder={user?.role === 'representative' ? 'Transfer lead' : 'Unassigned'}
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
                  {isLeadOwner && (
                    <button
                      onClick={dialingAlternate ? saveAlternatePhone : savePhoneNumber}
                      disabled={
                        dialingAlternate
                          ? editableAlternatePhone.trim() === (lead.alternatePhone || '').trim()
                          : !editablePhone.trim() || editablePhone.trim() === (lead.phone || '').trim()
                      }
                      className="px-2.5 py-1 rounded-md bg-[#0F172A] text-white text-[9px] font-bold hover:bg-[#1E293B] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  )}
                </div>

                {/* Primary / Alternate phone tabs */}
                <div className="flex gap-1 mb-2 px-1">
                  <button
                    type="button"
                    onClick={() => setDialingAlternate(false)}
                    className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all ${!dialingAlternate ? 'bg-[#1D4ED8] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialingAlternate(true)}
                    className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all ${dialingAlternate ? 'bg-[#1D4ED8] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'}`}
                  >
                    Alternate
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
                          value={dialingAlternate ? editableAlternatePhone : editablePhone}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9+*#()\-\s]/g, '')
                            dialingAlternate ? setEditableAlternatePhone(cleaned) : setEditablePhone(cleaned)
                          }}
                          onBlur={dialingAlternate ? saveAlternatePhone : savePhoneNumber}
                          placeholder={dialingAlternate ? 'Alternate number...' : (phoneField?.placeholder || 'Number...')}
                          className="w-full bg-transparent border-none p-0 text-center text-sm leading-none tracking-tight font-bold text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none"
                          inputMode="tel"
                        />
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" onClick={() => dialingAlternate ? setEditableAlternatePhone('') : setEditablePhone('')} className="text-[8px] font-bold text-[#64748B] hover:text-[#0F172A]">Clear</button>
                          <div className="w-px h-2 bg-[#E2E8F0]" />
                          <button type="button" onClick={() => dialingAlternate ? setEditableAlternatePhone(p => p.slice(0, -1)) : deleteLastPhoneDigit()} className="text-[8px] font-bold text-[#64748B] hover:text-[#0F172A]">Back</button>
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
                        disabled={!canPlaceCall || isStartingCall || callState === 'dialing'}
                        className="col-span-3 mt-1 h-9 rounded-lg bg-[#16A34A] text-white text-[11px] font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <PhoneCall size={14} /> {isStartingCall || callState === 'dialing' ? 'Dialing...' : 'Start Call'}
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

          {/* ── Follow-ups — re-added to the main content flow after the right panel
              was repurposed for Call History. Compact list with add / edit / mark-done /
              delete for every scheduled follow-up against this lead. ─────────────── */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-4">
            <div className="px-4 py-3 bg-gradient-to-r from-[#EFF6FF] to-white border-b border-[#DBEAFE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-sm">
                  <Calendar size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">Follow-ups</p>
                  <p className="text-[10px] text-[#64748B]">
                    {followUps.length === 0
                      ? 'Schedule a callback or meeting'
                      : `${followUps.length} scheduled${followUps.filter((f) => f.status === 'pending').length ? ` · ${followUps.filter((f) => f.status === 'pending').length} pending` : ''}`}
                  </p>
                </div>
              </div>
              {isLeadOwner && !showFollowUpForm && (
                <button
                  onClick={() => setShowFollowUpForm(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#1D4ED8] text-white text-[11px] font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <span className="text-sm leading-none">+</span>
                  Add Follow-up
                </button>
              )}
            </div>

            <div className="p-4">
              {/* Inline form for add / edit */}
              {showFollowUpForm && (
                <div className="mb-4 p-4 bg-[#FAFCFF] border border-[#DBEAFE] rounded-xl">
                  <p className="text-xs font-bold text-[#0F172A] mb-3">
                    {editingFollowUpId ? 'Edit follow-up' : 'New follow-up'}
                  </p>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Date</label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Time</label>
                        <input
                          type="time"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Notes</label>
                      <textarea
                        value={followUpNotes}
                        onChange={(e) => setFollowUpNotes(e.target.value)}
                        placeholder="What to discuss, reminders, context…"
                        rows={2}
                        className="w-full text-xs px-3 py-2 border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15 focus:border-[#1D4ED8]/50"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={
                          editingFollowUpId
                            ? () =>
                                handleUpdateFollowUp(editingFollowUpId, {
                                  scheduledAt: new Date(`${followUpDate}T${followUpTime}`).toISOString(),
                                  notes: followUpNotes,
                                })
                            : handleCreateFollowUp
                        }
                        disabled={followUpLoading || !followUpDate || !followUpTime}
                        className="h-8 px-4 rounded-lg bg-[#1D4ED8] text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {followUpLoading ? 'Saving…' : editingFollowUpId ? 'Update' : 'Save follow-up'}
                      </button>
                      <button
                        onClick={resetFollowUpForm}
                        className="h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] text-[11px] font-semibold hover:bg-[#F8FAFC] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* List */}
              {followUps.length === 0 && !showFollowUpForm ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[#E2E8F0] bg-[#FAFCFF]">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-2 shadow-sm border border-[#E2E8F0]">
                    <Calendar size={16} className="text-[#94A3B8]" />
                  </div>
                  <p className="text-xs text-[#64748B]">No follow-ups scheduled yet</p>
                  {isLeadOwner && (
                    <p className="text-[10px] text-[#94A3B8] mt-1">Click "Add Follow-up" to plan the next touchpoint</p>
                  )}
                </div>
              ) : followUps.length > 0 ? (
                <div className="space-y-2">
                  {[...followUps]
                    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
                    .map((followUp) => {
                      const isPending = followUp.status === 'pending'
                      const isCompleted = followUp.status === 'completed'
                      const scheduledDate = new Date(followUp.scheduledAt)
                      const isPast = scheduledDate < new Date() && isPending
                      const statusStyle = isCompleted
                        ? { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', label: 'Completed', Icon: CheckCircle }
                        : isPast
                          ? { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', label: 'Overdue', Icon: AlertCircle }
                          : { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'Upcoming', Icon: Clock }
                      const StatusIcon = statusStyle.Icon
                      return (
                        <div
                          key={followUp._id}
                          className="flex items-start gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#FAFCFF] transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
                          >
                            <StatusIcon size={13} style={{ color: statusStyle.text }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-[#0F172A]">
                                  {scheduledDate.toLocaleDateString('en-IN', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </p>
                                <span className="text-[10px] text-[#64748B]">
                                  {scheduledDate.toLocaleTimeString('en-IN', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                                style={{
                                  background: statusStyle.bg,
                                  color: statusStyle.text,
                                  borderColor: statusStyle.border,
                                }}
                              >
                                {statusStyle.label}
                              </span>
                            </div>
                            {followUp.notes && (
                              <p className="text-[11px] text-[#475569] mt-1.5 leading-relaxed">
                                {followUp.notes}
                              </p>
                            )}
                            {isLeadOwner && (
                              <div className="flex items-center gap-1.5 mt-2">
                                {isPending && (
                                  <button
                                    onClick={() => handleUpdateFollowUp(followUp._id, { status: 'completed' })}
                                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] hover:bg-[#DCFCE7] transition-colors"
                                  >
                                    Mark Done
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditFollowUp(followUp)}
                                  className="text-[10px] font-bold px-2 py-1 rounded-md border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteFollowUp(followUp._id)}
                                  className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Website Form Submission & Attribution ────────────────────────────── */}
          {(() => {
            // Keys that live in the Attribution panel, not the Form Data panel
            const ATTRIBUTION_KEYS = new Set([
              'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
              'gclid', 'gbraid', 'wbraid', 'landing_page', 'form_name', 'campaign',
            ])
            // Core identity keys — already prominent elsewhere on the page
            const CORE_KEYS = new Set(['name', 'phone', 'email'])

            // Form Data: every websiteFormData entry that isn't attribution or core
            const formDataEntries = lead.websiteFormData
              ? Object.entries(lead.websiteFormData).filter(
                  ([k]) => !ATTRIBUTION_KEYS.has(k.toLowerCase()) && !CORE_KEYS.has(k.toLowerCase())
                )
              : []

            // Attribution: merge dedicated lead model UTM fields with websiteFormData tracking keys
            // Lead model fields take priority (they're the canonical stored value)
            const fd = lead.websiteFormData ?? {}
            const attributionRows: { label: string; value: string; mono?: boolean; url?: boolean }[] = [
              { label: 'UTM Source',   value: lead.utmSource   || fd['utm_source']   || '' },
              { label: 'UTM Medium',   value: lead.utmMedium   || fd['utm_medium']   || '' },
              { label: 'UTM Campaign', value: lead.utmCampaign || fd['utm_campaign'] || '' },
              { label: 'UTM Term',     value: lead.utmTerm     || fd['utm_term']     || '' },
              { label: 'UTM Content',  value: lead.utmContent  || fd['utm_content']  || '' },
              { label: 'Google Click ID (gclid)', value: lead.googleClickId || fd['gclid'] || '', mono: true },
              { label: 'Google BRAID (gbraid)',   value: fd['gbraid'] || '', mono: true },
              { label: 'Web BRAID (wbraid)',      value: fd['wbraid'] || '', mono: true },
              { label: 'Landing Page', value: fd['landing_page'] || '', url: true },
              { label: 'Form / Campaign', value: lead.campaign || fd['form_name'] || fd['campaign'] || '' },
            ].filter(r => r.value)

            const hasFormData    = formDataEntries.length > 0
            const hasAttribution = attributionRows.length > 0
            if (!hasFormData && !hasAttribution) return null

            return (
              <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <div className="w-1 h-3 bg-[#0EA5E9] rounded-full" />
                  <h2 className="text-xs font-bold text-[#0F172A]">Website Form Submission</h2>
                  <div className="ml-auto flex items-center gap-1.5">
                    {hasFormData && (
                      <span className="text-[9px] font-bold text-[#475569] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {formDataEntries.length} form fields
                      </span>
                    )}
                    {hasAttribution && (
                      <span className="text-[9px] font-bold text-[#0369A1] bg-[#E0F2FE] border border-[#BAE6FD] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Attribution tracked
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3 items-start">

                  {/* ── Left: Form Data ───────────────────────────────────────────────── */}
                  {hasFormData && (
                    <div>
                      <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest mb-2 px-0.5">
                        What the visitor submitted
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {formDataEntries.map(([key, value]) => {
                          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          return (
                            <div
                              key={key}
                              className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#0EA5E9]/50 transition-colors"
                            >
                              <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider leading-none">
                                {label}
                              </span>
                              <span className="text-xs font-semibold text-[#0F172A] break-words leading-snug">
                                {value}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Right: Attribution & Tracking ────────────────────────────────── */}
                  {hasAttribution && (
                    <div className="rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] p-2.5">
                      <p className="text-[9px] font-bold text-[#0369A1] uppercase tracking-widest mb-2 px-0.5">
                        Attribution &amp; Tracking
                      </p>
                      <div className="flex flex-col gap-1">
                        {attributionRows.map(row => (
                          <div
                            key={row.label}
                            className="flex items-start justify-between gap-3 px-2 py-1.5 rounded-md bg-white border border-[#E0F2FE] hover:border-[#0EA5E9] transition-colors"
                          >
                            <span className="text-[9px] font-bold text-[#0369A1] uppercase tracking-wider whitespace-nowrap shrink-0 pt-px">
                              {row.label}
                            </span>
                            {row.url ? (
                              <a
                                href={row.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-semibold text-[#0EA5E9] hover:underline text-right break-all max-w-[180px] leading-snug"
                                title={row.value}
                              >
                                {row.value.replace(/^https?:\/\//, '').slice(0, 48)}{row.value.length > 54 ? '…' : ''}
                              </a>
                            ) : (
                              <span
                                className={`text-right break-all max-w-[180px] leading-snug ${
                                  row.mono
                                    ? 'font-mono text-[9px] text-[#475569] select-all'
                                    : 'text-[10px] font-semibold text-[#0F172A]'
                                }`}
                                title={row.value}
                              >
                                {row.value}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

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
                    readOnly={!isLeadOwner}
                    onChange={(e) => isLeadOwner && setNoteDraft(e.target.value)}
                    placeholder={isLeadOwner ? `What happened in ${activeNoteStatus} stage?` : 'Only the lead owner can add notes.'}
                    rows={6}
                    className={`w-full px-4 py-4 border rounded-2xl text-sm text-[#0F172A] placeholder-[#94A3B8] resize-none focus:outline-none focus:ring-4 transition-all shadow-inner ${
                      !isLeadOwner
                        ? 'bg-[#F8FAFC] border-[#E2E8F0] cursor-not-allowed opacity-60'
                        : editingStatusNoteId
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
                      disabled={!isLeadOwner || !noteDraft.trim() || isSavingStatusNote}
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
                              {isLeadOwner && (
                                <>
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
                                </>
                              )}
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

          {/* Status Note Required Modal */}
          {showStatusNoteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[#E2E8F0] overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#F1F5F9] bg-gradient-to-r from-[#EFF6FF] to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1D4ED8] flex items-center justify-center shadow-sm">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">Add a Status Note</p>
                      <p className="text-[10px] text-[#64748B]">
                        Updating to <span className="font-semibold text-[#1D4ED8]">{dispositionDraft}</span> requires a note
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  <textarea
                    autoFocus
                    value={modalNoteText}
                    onChange={(e) => setModalNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleConfirmModalNote()
                      if (e.key === 'Escape') { setShowStatusNoteModal(false); setModalNoteText('') }
                    }}
                    rows={4}
                    placeholder={`Describe what happened or the reason for moving to "${dispositionDraft}"...`}
                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all placeholder:text-[#94A3B8]"
                  />
                  <p className="text-[10px] text-[#94A3B8]">Tip: Press Ctrl+Enter to save quickly</p>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-[#F1F5F9] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowStatusNoteModal(false); setModalNoteText('') }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmModalNote}
                    disabled={!modalNoteText.trim() || isUpdatingDisposition}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1D4ED8] hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingDisposition ? 'Updating...' : 'Confirm & Update Status'}
                  </button>
                </div>
              </div>
            </div>
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

                {/* Audio player — shared custom control, dark variant so it
                    visually anchors the 'Latest Recording' card as the hero
                    element of the right panel. Same code the Call History
                    cards below use (light variant), so both UIs stay in sync. */}
                <div className="p-4 bg-white">
                  <RecordingPlayer
                    call={latestRecordingCall}
                    featureRecording={featureControls.callRecording}
                    variant="dark"
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

          {/* Call History — full log of every call made/received for this lead,
              newest first. Replaces the old Follow-up Timeline on the right
              panel because reps track follow-ups via the remarks section below.
              Each entry shows date/time, duration, outcome, who made the call,
              and an inline audio player when a recording exists. */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-[#0F172A]">Call History</p>
              {sortedCallHistory.length > 0 && (
                <span className="text-[10px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                  {sortedCallHistory.length} {sortedCallHistory.length === 1 ? 'call' : 'calls'}
                </span>
              )}
            </div>

            {sortedCallHistory.length === 0 ? (
              <div className="text-center py-8 px-3 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <Phone size={16} className="text-[#94A3B8]" />
                </div>
                <p className="text-xs text-[#64748B]">No calls made yet</p>
                <p className="text-[10px] text-[#94A3B8] mt-1">Click Start Call to begin</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedCallHistory.map((call, index) => {
                  const isConnected = call.outcome === 'Connected'
                  const isIncoming = call.direction === 'incoming'
                  const duration = call.duration || 0
                  const mins = Math.floor(duration / 60)
                  const secs = duration % 60
                  const durationText = duration > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : '—'
                  const startedAt = new Date(call.startedAt || call.createdAt)
                  const dotColor = isConnected ? '#16A34A' : isIncoming ? '#F59E0B' : '#DC2626'
                  const outcomeLabel = call.outcome || call.status || 'Unknown'
                  const outcomeStyle = isConnected
                    ? { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }
                    : { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' }

                  return (
                    <div
                      key={call._id}
                      className={`relative rounded-xl border p-3 transition-all hover:shadow-sm ${
                        index === 0
                          ? 'border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] to-white'
                          : 'border-[#E2E8F0] bg-white'
                      }`}
                    >
                      {/* Top row: number + direction pill + outcome */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: dotColor }}
                          />
                          <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wide">
                            #{sortedCallHistory.length - index} · {isIncoming ? 'Incoming' : 'Outbound'}
                          </span>
                          {index === 0 && (
                            <span className="text-[9px] font-bold text-[#1D4ED8] bg-[#DBEAFE] px-1.5 py-0.5 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0"
                          style={{
                            background: outcomeStyle.bg,
                            color: outcomeStyle.text,
                            borderColor: outcomeStyle.border,
                          }}
                        >
                          {outcomeLabel}
                        </span>
                      </div>

                      {/* Date + time + duration */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-bold text-[#0F172A]">
                          {startedAt.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-[10px] text-[#64748B] tabular-nums">{durationText}</p>
                      </div>
                      <p className="text-[10px] text-[#64748B] mb-1">
                        {startedAt.toLocaleTimeString('en-IN', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>

                      {/* Representative */}
                      {call.representativeName && (
                        <p className="text-[10px] text-[#475569] truncate">
                          <span className="text-[#94A3B8]">By </span>
                          <span className="font-semibold">{call.representativeName}</span>
                        </p>
                      )}

                      {/* Inline recording player (only when available).
                          IMPORTANT: we proxy through our backend via
                          callsAPI.getRecordingUrl() because the raw Exotel URL
                          requires HTTP Basic auth and browsers pop a scary
                          Sign-In dialog when the <audio> element hits it
                          directly. Our backend route injects the Basic-auth
                          header and streams the bytes back. */}
                      {call.recordingUrl && featureControls.callRecording && (
                        <div className="mt-2.5">
                          {/* Compact variant of the shared RecordingPlayer —
                              same custom UI used in the Call Log detail view.
                              Dodges the browser native-controls scrub-bar auto-
                              hide problem in narrow containers. */}
                          <RecordingPlayer
                            call={call}
                            featureRecording={featureControls.callRecording}
                            variant="light"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

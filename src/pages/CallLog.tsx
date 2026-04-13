import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, Play, Pause, Clock, ChevronRight, CheckCircle2,
  PhoneOff, Mic, Loader2, Search,
  ArrowUpRight, ArrowDownLeft, ChevronLeft, X, RefreshCw,
  User, ExternalLink, PhoneIncoming, PhoneOutgoing,
  ChevronDown, CalendarDays, Users2, TrendingUp, ArrowLeftRight,
  Check, ChevronUp,
} from 'lucide-react'
import { callsAPI, type Call, type CallFilters } from '../api/calls'
import { teamAPI } from '../api/team'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import {
  DEFAULT_FEATURE_CONTROLS,
  FEATURE_CONTROLS_STORAGE_KEY,
  FEATURE_CONTROLS_UPDATED_EVENT,
  normalizeFeatureControls,
} from '../utils/featureControls'

// ── Config ─────────────────────────────────────────────────────────────────

const outcomeConfig: Record<string, { label: string; color: string; bg: string }> = {
  'Connected':    { label: 'Connected',   color: '#16A34A', bg: '#F0FDF4' },
  'Not Answered': { label: 'No Answer',   color: '#DC2626', bg: '#FEF2F2' },
  'Busy':         { label: 'Busy',        color: '#D97706', bg: '#FFFBEB' },
  'Failed':       { label: 'Failed',      color: '#DC2626', bg: '#FEF2F2' },
}

const OUTCOMES = ['All', 'Connected', 'Not Answered', 'Busy', 'Failed']

// ── Helpers ─────────────────────────────────────────────────────────────────

const isPlaceholder = (v?: string | null) =>
  Boolean(v && (/^Exotel\s+\d{4,}$/i.test(v) || /^Lead\s+\d{4,}$/i.test(v) || /^Manual\s+\d{4,}$/i.test(v) || /^Direct\s+\d{4,}$/i.test(v)))

const isRealLead = (call: Call) => !isPlaceholder(call.leadName) && Boolean(call.leadName)

const getLeadId = (call: Call): string | null => {
  if (!call.lead) return null
  if (typeof call.lead === 'object') return (call.lead as any)._id || null
  return call.lead || null
}

const getLeadLabel = (call: Call) => {
  if (isPlaceholder(call.leadName)) return call.phone
  return call.leadName || call.phone
}

const getInitials = (v?: string | null) =>
  (v || '?').split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()

function fmtDuration(seconds: number) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Inline Recording Player ──────────────────────────────────────────────────

function RecordingPlayer({ call, featureRecording }: { call: Call; featureRecording: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setAudioSrc(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setTotalDuration(0)
    if (!featureRecording || !call.recordingUrl) { setLoading(false); return }
    let objUrl: string | null = null
    setLoading(true)
    setError(false)
    fetch(callsAPI.getRecordingUrl(call._id))
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => { objUrl = URL.createObjectURL(blob); setAudioSrc(objUrl) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [call._id, call.recordingUrl, featureRecording])

  const toggle = () => {
    if (!audioRef.current || !audioSrc) return
    if (isPlaying) audioRef.current.pause(); else void audioRef.current.play()
    setIsPlaying(p => !p)
  }

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  if (!featureRecording || !call.recordingUrl) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0]">
        <PhoneOff size={14} className="text-[#94A3B8]" />
        <span className="text-xs text-[#94A3B8]">{!featureRecording ? 'Recordings disabled' : 'No recording available'}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
        <Loader2 size={14} className="text-[#1D4ED8] animate-spin" />
        <span className="text-xs text-[#64748B]">Loading recording...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
        <PhoneOff size={14} className="text-[#DC2626]" />
        <span className="text-xs text-[#DC2626]">Could not load recording</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0F172A] rounded-xl px-4 py-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white hover:bg-blue-600 shrink-0 transition-colors"
        >
          {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="flex justify-between text-[10px] font-mono text-[#64748B] mb-1.5">
            <span>{fmtDuration(currentTime)}</span>
            <span>{fmtDuration(totalDuration)}</span>
          </div>
          <div
            className="relative h-1.5 bg-white/10 rounded-full cursor-pointer"
            onClick={e => {
              if (!audioRef.current) return
              const rect = e.currentTarget.getBoundingClientRect()
              audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * totalDuration
            }}
          >
            <div className="absolute left-0 top-0 h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audioSrc || ''}
        preload="auto"
        className="hidden"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setTotalDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  )
}

// ── Call Detail Side Panel ────────────────────────────────────────────────────

function CallDetailPanel({
  call,
  onClose,
  featureRecording,
  onNavigateLead,
}: {
  call: Call
  onClose: () => void
  featureRecording: boolean
  onNavigateLead: (id: string) => void
}) {
  const isIncoming = call.direction === 'incoming'
  const outcome = outcomeConfig[call.outcome || '']
  const leadLabel = getLeadLabel(call)
  const realLead = isRealLead(call)
  const leadId = getLeadId(call)

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex items-start justify-between gap-2 py-2.5 border-b border-[#F1F5F9] last:border-0">
      <span className="text-xs text-[#94A3B8] font-medium shrink-0">{label}</span>
      <span className="text-xs font-semibold text-[#0F172A] text-right">{value || '—'}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-[420px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#1D4ED8] text-sm font-bold shrink-0">
                {getInitials(leadLabel)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#0F172A]">{leadLabel}</p>
                  {realLead && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                      <User size={9} /> Lead
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">{call.phone}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F8FAFC] text-[#94A3B8] shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Quick chips */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              isIncoming ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isIncoming ? <PhoneIncoming size={10} /> : <PhoneOutgoing size={10} />}
              {isIncoming ? 'Incoming' : 'Outgoing'}
            </span>
            {outcome && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                style={{ color: outcome.color, background: outcome.bg, borderColor: `${outcome.color}30` }}
              >
                {outcome.label === 'Connected' ? <CheckCircle2 size={10} /> : <PhoneOff size={10} />}
                {outcome.label}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]">
              <Clock size={10} />
              {fmtDuration(call.duration || 0)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Recording */}
          <div>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Recording</p>
            <RecordingPlayer call={call} featureRecording={featureRecording} />
          </div>

          {/* Call Info */}
          <div>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Call Details</p>
            <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] px-4">
              <InfoRow label="Date & Time" value={fmtDateTime(call.startedAt || call.createdAt)} />
              <InfoRow label="End Time" value={call.endedAt ? fmtDateTime(call.endedAt) : undefined} />
              <InfoRow label="Duration" value={`${fmtDuration(call.duration || 0)}`} />
              <InfoRow label="Direction" value={isIncoming ? 'Incoming' : 'Outgoing'} />
              <InfoRow label="Outcome" value={call.outcome || call.status} />
              <InfoRow label="Exotel SID" value={call.exotelCallSid} />
            </div>
          </div>

          {/* Parties */}
          <div>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Parties</p>
            <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] px-4">
              <InfoRow label="Contact" value={leadLabel} />
              <InfoRow label="Phone" value={call.phone} />
              <InfoRow label="Representative" value={call.representativeName} />
              {call.exophoneNumber && <InfoRow label="Exophone" value={call.exophoneNumber} />}
            </div>
          </div>

          {/* Status Details */}
          <div>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Status Details</p>
            <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] px-4">
              <InfoRow label="Status" value={call.status} />
              <InfoRow label="Raw Status" value={call.exotelStatusRaw} />
              <InfoRow label="Rep Leg" value={call.representativeLegStatus} />
              <InfoRow label="Customer Leg" value={call.customerLegStatus} />
              <InfoRow
                label="Rep Answered"
                value={call.representativeAnswered == null ? undefined : call.representativeAnswered ? 'Yes' : 'No'}
              />
              <InfoRow
                label="Customer Answered"
                value={call.customerAnswered == null ? undefined : call.customerAnswered ? 'Yes' : 'No'}
              />
            </div>
          </div>

          {/* Feedback */}
          {call.feedback && (
            <div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Feedback</p>
              <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] px-4">
                {call.feedback.rating > 0 && <InfoRow label="Rating" value={`${call.feedback.rating} / 5`} />}
                {call.feedback.disposition && <InfoRow label="Disposition" value={call.feedback.disposition} />}
                {call.feedback.notes && <InfoRow label="Notes" value={call.feedback.notes} />}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-white flex items-center gap-2">
          {realLead && leadId ? (
            <button
              onClick={() => onNavigateLead(leadId)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <ExternalLink size={14} /> View Lead Profile
            </button>
          ) : (
            <div className="flex-1 px-4 py-2.5 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              No lead profile — direct call
            </div>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Custom Dropdown ─────────────────────────────────────────────────────────

function useDropdownAlign(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [alignRight, setAlignRight] = useState(false)

  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setAlignRight(rect.left + 260 > window.innerWidth)
  }, [open])

  return { ref, alignRight }
}

function FilterDropdown({
  icon: Icon,
  value,
  onChange,
  options,
  active,
}: {
  icon: React.ElementType
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  active: boolean
}) {
  const [open, setOpen] = useState(false)
  const { ref, alignRight } = useDropdownAlign(open)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium shadow-sm transition-all whitespace-nowrap ${
          active
            ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]'
            : 'bg-white border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]'
        }`}
      >
        <Icon size={12} className={active ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'} />
        <span>{selected?.label ?? value}</span>
        {open ? <ChevronUp size={11} className="ml-0.5" /> : <ChevronDown size={11} className="ml-0.5" />}
      </button>

      {open && (
        <div className={`absolute top-full mt-1.5 z-50 min-w-[160px] bg-white rounded-xl border border-[#E2E8F0] shadow-xl overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}>
          <div className="py-1">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors ${
                  opt.value === value
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                    : 'text-[#374151] hover:bg-[#F8FAFC] font-medium'
                }`}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check size={12} className="text-[#1D4ED8] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom Calendar Date Picker ───────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function CalendarPicker({
  label,
  value,
  onChange,
  active,
  maxDate,
  minDate,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  active: boolean
  maxDate?: string
  minDate?: string
}) {
  const [open, setOpen] = useState(false)
  const { ref, alignRight } = useDropdownAlign(open)
  const today = new Date()
  const parsed = value ? new Date(value + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay()

  const handleSelect = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const displayLabel = parsed
    ? parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : label

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )

  const isSelected = (d: number) => {
    if (!parsed) return false
    return parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === d
  }
  const isToday = (d: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d

  const isDisabled = (d: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    if (minDate && dateStr < minDate) return true
    if (maxDate && dateStr > maxDate) return true
    return false
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium shadow-sm transition-all whitespace-nowrap ${
          active
            ? 'bg-[#EFF6FF] border-[#1D4ED8] text-[#1D4ED8]'
            : 'bg-white border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]'
        }`}
      >
        <CalendarDays size={12} className={active ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'} />
        <span>{displayLabel}</span>
        {active && (
          <span
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="ml-0.5 w-3.5 h-3.5 rounded-full bg-[#1D4ED8]/15 flex items-center justify-center hover:bg-[#1D4ED8]/30 cursor-pointer"
          >
            <X size={8} className="text-[#1D4ED8]" />
          </span>
        )}
        {!active && (open ? <ChevronUp size={11} className="ml-0.5" /> : <ChevronDown size={11} className="ml-0.5" />)}
      </button>

      {open && (
        <div className={`absolute top-full mt-1.5 z-50 w-[252px] bg-white rounded-xl border border-[#E2E8F0] shadow-xl overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}>
          {/* Month nav */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#F1F5F9]">
            <button type="button" onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors">
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-bold text-[#0F172A]">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#475569] transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pt-1.5 pb-0.5">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[9px] font-bold text-[#94A3B8] py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day === null ? <div className="w-7 h-7" /> : (
                  <button
                    type="button"
                    disabled={isDisabled(day)}
                    onClick={() => handleSelect(day)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-medium transition-all ${
                      isSelected(day)
                        ? 'bg-[#1D4ED8] text-white font-bold shadow-md'
                        : isToday(day)
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] font-bold ring-1 ring-[#1D4ED8]/30'
                          : isDisabled(day)
                            ? 'text-[#CBD5E1] cursor-not-allowed'
                            : 'text-[#374151] hover:bg-[#F1F5F9] cursor-pointer'
                    }`}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                setViewYear(t.getFullYear())
                setViewMonth(t.getMonth())
                handleSelect(t.getDate())
              }}
              className="text-[11px] font-semibold text-[#1D4ED8] hover:text-blue-700 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function CallLog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const isManager = user?.role === 'manager'

  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [panelCall, setPanelCall] = useState<Call | null>(null)
  const [featureControls, setFeatureControls] = useState(DEFAULT_FEATURE_CONTROLS)
  const [representatives, setRepresentatives] = useState<{ id: string; name: string }[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [filterOutcome, setFilterOutcome] = useState('All')
  const [filterDirection, setFilterDirection] = useState('All')
  const [filterRep, setFilterRep] = useState('All')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // ── Feature controls ──
  useEffect(() => {
    const stored = localStorage.getItem(FEATURE_CONTROLS_STORAGE_KEY)
    if (stored) {
      try { setFeatureControls(normalizeFeatureControls(JSON.parse(stored)?.featureControls)) } catch { /* */ }
    }
    const handler = () => {
      const s = localStorage.getItem(FEATURE_CONTROLS_STORAGE_KEY)
      if (s) try { setFeatureControls(normalizeFeatureControls(JSON.parse(s)?.featureControls)) } catch { /* */ }
    }
    window.addEventListener(FEATURE_CONTROLS_UPDATED_EVENT, handler)
    return () => window.removeEventListener(FEATURE_CONTROLS_UPDATED_EVENT, handler)
  }, [])

  // ── Load team for rep filter ──
  useEffect(() => {
    if (!isManager) return
    teamAPI.getTeamMembers()
      .then(res => {
        if (res.success) {
          setRepresentatives(
            res.data
              .filter(m => m.role === 'representative' && m.isActive)
              .map(m => ({ id: m.id, name: m.name }))
          )
        }
      })
      .catch(() => { /* */ })
  }, [isManager])

  // ── Fetch ──
  const fetchCalls = async (page: number, bg = false) => {
    try {
      if (!bg) setLoading(true)
      const params: CallFilters = { page: String(page), limit: '20' }
      if (filterOutcome !== 'All') params.outcome = filterOutcome
      if (filterDirection !== 'All') params.direction = filterDirection
      if (isManager && filterRep !== 'All') params.representative = filterRep
      if (search.trim()) params.search = search.trim()
      if (filterDateFrom) params.dateFrom = filterDateFrom
      if (filterDateTo) params.dateTo = filterDateTo

      const res = await callsAPI.getCalls(params)
      if (res.success) {
        setCalls(res.data)
        setPagination({ page: res.pagination.page, total: res.pagination.total, pages: res.pagination.pages })
      }
    } catch { /* */ } finally {
      if (!bg) setLoading(false)
    }
  }

  useEffect(() => { fetchCalls(1) }, [search, filterOutcome, filterDirection, filterRep, filterDateFrom, filterDateTo])

  // ── Auto-poll every 60s so backend-synced calls appear without manual refresh ──
  useEffect(() => {
    const poll = setInterval(() => {
      fetchCalls(pagination.page, true)
    }, 60_000)
    return () => clearInterval(poll)
  }, [pagination.page, search, filterOutcome, filterDirection, filterRep, filterDateFrom, filterDateTo])

  // ── Socket: live call updates ──
  useEffect(() => {
    if (!socket || !connected) return
    const handler = (event: any) => {
      const sid = event?._id || event?.callId
      if (!sid) return
      setCalls(prev => {
        const idx = prev.findIndex(c => c._id === sid || c.exotelCallSid === event?.exotelCallSid)
        if (idx === -1) return prev
        const updated = { ...prev[idx], ...event }
        const next = [...prev]
        next[idx] = updated
        return next
      })
    }
    socket.on('call:status_updated', handler)
    return () => { socket.off('call:status_updated', handler) }
  }, [socket, connected])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCalls(pagination.page, true)
    setRefreshing(false)
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setSyncMsg(null)
      const res = await callsAPI.syncCalls({ days: 30 })
      setSyncMsg(`Synced: ${res.createdCount} new, ${res.updatedCount} updated`)
      await fetchCalls(1)
    } catch {
      setSyncMsg('Sync failed.')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 5000)
    }
  }

  // When a live update comes in, refresh the panel call too
  useEffect(() => {
    if (!panelCall) return
    const found = calls.find(c => c._id === panelCall._id)
    if (found && found !== panelCall) setPanelCall(found)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls])

  const clearFilters = () => {
    setSearch('')
    setFilterOutcome('All')
    setFilterDirection('All')
    setFilterRep('All')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const hasFilters = search || filterOutcome !== 'All' || filterDirection !== 'All' || filterRep !== 'All' || filterDateFrom || filterDateTo

  // ── Render ──
  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">Call Log</h1>
            <p className="text-xs text-[#475569] mt-0.5">{pagination.total} calls from Exotel</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {/* Pagination */}
            <div className="flex items-center gap-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-0.5 py-0.5 shadow-sm">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchCalls(pagination.page - 1)}
                className="w-6 h-6 flex items-center justify-center rounded text-[#64748B] hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={13} />
              </button>
              <div className="px-2 text-[11px] font-semibold text-[#475569] whitespace-nowrap">
                <span className="text-[#0F172A] font-bold">{pagination.page}</span> / <span className="text-[#0F172A] font-bold">{Math.max(1, pagination.pages)}</span>
              </div>
              <button
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => fetchCalls(pagination.page + 1)}
                className="w-6 h-6 flex items-center justify-center rounded text-[#64748B] hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {syncMsg && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-sm text-[#15803D] font-medium">
            {syncMsg}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">

          {/* Search */}
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full pl-8 pr-3 h-8 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] placeholder-[#94A3B8] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
            />
          </div>

          {/* Outcome filter */}
          <FilterDropdown
            icon={TrendingUp}
            value={filterOutcome}
            onChange={setFilterOutcome}
            active={filterOutcome !== 'All'}
            options={OUTCOMES.map(o => ({ value: o, label: o === 'All' ? 'All Outcomes' : o }))}
          />

          {/* Direction filter */}
          <FilterDropdown
            icon={ArrowLeftRight}
            value={filterDirection}
            onChange={setFilterDirection}
            active={filterDirection !== 'All'}
            options={[
              { value: 'All', label: 'All Directions' },
              { value: 'outbound', label: 'Outgoing' },
              { value: 'incoming', label: 'Incoming' },
            ]}
          />

          {/* Rep filter (manager only) */}
          {isManager && representatives.length > 0 && (
            <FilterDropdown
              icon={Users2}
              value={filterRep}
              onChange={setFilterRep}
              active={filterRep !== 'All'}
              options={[
                { value: 'All', label: 'All Reps' },
                ...representatives.map(r => ({ value: r.id, label: r.name })),
              ]}
            />
          )}

          {/* Date From */}
          <CalendarPicker
            label="From date"
            value={filterDateFrom}
            onChange={setFilterDateFrom}
            active={Boolean(filterDateFrom)}
            maxDate={filterDateTo || undefined}
          />

          {/* Date To */}
          <CalendarPicker
            label="To date"
            value={filterDateTo}
            onChange={setFilterDateTo}
            active={Boolean(filterDateTo)}
            minDate={filterDateFrom || undefined}
          />

          {/* Clear */}
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg hover:bg-[#FEE2E2] transition-colors shadow-sm"
            >
              <X size={11} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Lead / Contact', 'Direction', 'Exophone / Rep', 'Outcome', 'Duration', 'Date & Time', 'Rec.'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 size={28} className="text-[#1D4ED8] animate-spin mx-auto" />
                  </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Phone size={32} className="text-[#CBD5E1] mx-auto mb-3" />
                    <p className="text-[#94A3B8] text-sm font-medium">No calls found</p>
                    <p className="text-[#CBD5E1] text-xs mt-1">
                      {hasFilters ? 'Try clearing filters' : 'Calls synced from Exotel will appear here'}
                    </p>
                  </td>
                </tr>
              ) : (
                calls.map(call => {
                  const isIncoming = call.direction === 'incoming'
                  const outcome = outcomeConfig[call.outcome || '']
                  const leadLabel = getLeadLabel(call)
                  const initials = getInitials(leadLabel)
                  const hasRecording = featureControls.callRecording && Boolean(call.recordingUrl)
                  const realLead = isRealLead(call)
                  const isActive = panelCall?._id === call._id

                  return (
                    <tr
                      key={call._id}
                      className={`border-b border-[#F1F5F9] transition-colors cursor-pointer ${
                        isActive ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                      }`}
                      onClick={() => setPanelCall(call)}
                    >
                      {/* Lead / Contact */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            realLead ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F1F5F9] text-[#64748B]'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-xs font-bold text-[#0F172A] truncate max-w-[120px]">{leadLabel}</p>
                              {realLead && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[8px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shrink-0">
                                  <User size={7} /> Lead
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#94A3B8]">{call.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Direction */}
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          isIncoming
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isIncoming
                            ? <ArrowDownLeft size={9} />
                            : <ArrowUpRight size={9} />}
                          {isIncoming ? 'In' : 'Out'}
                        </span>
                      </td>

                      {/* Exophone / Rep */}
                      <td className="px-3 py-2.5">
                        {isIncoming ? (
                          <div>
                            {call.exophoneNumber ? (
                              <>
                                <p className="text-[11px] font-bold text-[#0F172A]">{call.exophoneNumber}</p>
                                <p className="text-[9px] text-[#94A3B8]">Exophone</p>
                              </>
                            ) : (
                              <p className="text-[11px] text-[#94A3B8]">—</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-[#E2E8F0] flex items-center justify-center text-[#475569] text-[9px] font-bold shrink-0">
                              {getInitials(call.representativeName)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-[#0F172A] truncate max-w-[90px]">{call.representativeName || '—'}</p>
                              <p className="text-[9px] text-[#94A3B8]">Rep</p>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Outcome */}
                      <td className="px-3 py-2.5">
                        {outcome ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border"
                            style={{ color: outcome.color, background: outcome.bg, borderColor: `${outcome.color}30` }}
                          >
                            {outcome.label === 'Connected'
                              ? <CheckCircle2 size={9} />
                              : outcome.label === 'Busy'
                              ? <Phone size={9} />
                              : <PhoneOff size={9} />}
                            {outcome.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] italic">{call.status}</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569]">
                          <Clock size={11} className="text-[#94A3B8]" />
                          {fmtDuration(call.duration || 0)}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="px-3 py-2.5">
                        <p className="text-[10px] font-medium text-[#475569] whitespace-nowrap">
                          {fmtDateTime(call.startedAt || call.createdAt)}
                        </p>
                      </td>

                      {/* Recording */}
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setPanelCall(call)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors border ${
                            hasRecording
                              ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] hover:bg-blue-700'
                              : 'bg-[#F1F5F9] text-[#CBD5E1] border-[#E2E8F0] cursor-default'
                          }`}
                        >
                          {hasRecording
                            ? <><Play size={10} fill="currentColor" /> Play</>
                            : <Mic size={10} />}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Detail Panel */}
      {panelCall && (
        <CallDetailPanel
          call={panelCall}
          onClose={() => setPanelCall(null)}
          featureRecording={featureControls.callRecording}
          onNavigateLead={(id) => { setPanelCall(null); navigate(`/leads/${id}`) }}
        />
      )}
    </div>
  )
}

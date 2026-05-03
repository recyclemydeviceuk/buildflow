import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Mic, MicOff, Phone, PhoneOff, Send,
  Loader2, AlertCircle, ShieldCheck, Languages,
  ChevronDown, Check, CheckCircle2, XCircle,
  Search, ListOrdered, BarChart3, CalendarDays, AlarmClock,
  PhoneCall, Users, UserSearch, LineChart, UserPlus, Tag,
  FileText, UserCheck, Trash2, CalendarPlus,
  ToggleLeft, Power,
  type LucideIcon,
} from 'lucide-react'
import { useTimySession, type TimyLanguage, type TimyTranscriptEntry } from './useTimySession'

const LANG_STORAGE_KEY = 'timy:language'

const isLanguage = (v: string | null): v is TimyLanguage =>
  v === 'en-IN' || v === 'hi-IN' || v === 'kn-IN'

interface LangOption {
  value: TimyLanguage
  short: string
  native: string
  description: string
  voice: string
}

const LANG_OPTIONS: LangOption[] = [
  { value: 'en-IN', short: 'English', native: 'English', description: 'Indian English', voice: 'Female · Aoede' },
  { value: 'hi-IN', short: 'हिन्दी', native: 'हिन्दी', description: 'Hindi',          voice: 'Male · Charon'   },
  { value: 'kn-IN', short: 'ಕನ್ನಡ',  native: 'ಕನ್ನಡ',  description: 'Kannada',        voice: 'Female · Kore'   },
]

interface Props {
  onClose: () => void
}

const STATUS_META: Record<
  string,
  { label: string; tone: string; dot: string; pulse?: boolean; glow: string }
> = {
  idle:       { label: 'Ready',         tone: 'text-[#475569]', dot: '#94A3B8', glow: 'rgba(148,163,184,0)' },
  connecting: { label: 'Connecting',    tone: 'text-[#B45309]', dot: '#F59E0B', glow: 'rgba(245,158,11,0.55)', pulse: true },
  listening:  { label: 'Listening',     tone: 'text-[#15803D]', dot: '#16A34A', glow: 'rgba(22,163,74,0.55)',  pulse: true },
  thinking:   { label: 'Thinking',      tone: 'text-[#1D4ED8]', dot: '#1D4ED8', glow: 'rgba(29,78,216,0.55)',  pulse: true },
  speaking:   { label: 'Speaking',      tone: 'text-[#7C3AED]', dot: '#8B5CF6', glow: 'rgba(139,92,246,0.6)',  pulse: true },
  closed:     { label: 'Session ended', tone: 'text-[#94A3B8]', dot: '#CBD5E1', glow: 'rgba(203,213,225,0)' },
  error:      { label: 'Error',         tone: 'text-[#B91C1C]', dot: '#EF4444', glow: 'rgba(239,68,68,0.55)' },
}

// ── Per-tool presentation ──────────────────────────────────────────────────
// Every tool Timy can call gets its own icon, verb, and color so the activity
// card reads at a glance. Tones map to a consistent border/bg/icon class set
// (see TONE_STYLES below).
type Tone = 'violet' | 'blue' | 'indigo' | 'green' | 'amber' | 'sky' | 'purple' | 'red' | 'slate'

interface ToolMeta {
  icon: LucideIcon
  /** Verb used while the tool is running, e.g. "Searching leads" */
  running: string
  /** Verb used after success, e.g. "Lead search complete" */
  done: string
  tone: Tone
}

const TOOL_META: Record<string, ToolMeta> = {
  // Read
  find_lead:                  { icon: Search,        running: 'Searching leads',         done: 'Lead search',         tone: 'blue'   },
  list_recent_leads:          { icon: ListOrdered,   running: 'Loading recent leads',    done: 'Recent leads',        tone: 'blue'   },
  count_leads_by_disposition: { icon: BarChart3,     running: 'Counting pipeline',       done: 'Pipeline counts',     tone: 'indigo' },
  get_today_followups:        { icon: CalendarDays,  running: "Pulling today's follow-ups", done: "Today's follow-ups", tone: 'green' },
  get_overdue_followups:      { icon: AlarmClock,    running: 'Pulling overdue follow-ups', done: 'Overdue follow-ups', tone: 'amber' },
  get_my_recent_calls:        { icon: PhoneCall,     running: 'Loading recent calls',    done: 'Recent calls',        tone: 'sky'    },
  get_team_overview:          { icon: Users,         running: 'Reading team overview',   done: 'Team overview',       tone: 'indigo' },
  find_team_member:           { icon: UserSearch,    running: 'Finding team member',     done: 'Team match',          tone: 'indigo' },
  get_my_pipeline_summary:    { icon: LineChart,     running: 'Building pipeline summary', done: 'Pipeline summary',  tone: 'purple' },
  // Write — leads
  create_lead:                { icon: UserPlus,      running: 'Creating lead',           done: 'Lead created',        tone: 'green'  },
  update_lead_disposition:    { icon: Tag,           running: 'Updating status',         done: 'Status updated',      tone: 'blue'   },
  add_lead_note:              { icon: FileText,      running: 'Adding note',             done: 'Note added',          tone: 'slate'  },
  assign_lead:                { icon: UserCheck,     running: 'Assigning lead',          done: 'Lead assigned',       tone: 'green'  },
  delete_lead:                { icon: Trash2,        running: 'Deleting lead',           done: 'Lead deleted',        tone: 'red'    },
  // Write — follow-ups
  schedule_followup:          { icon: CalendarPlus,  running: 'Scheduling follow-up',    done: 'Follow-up scheduled', tone: 'green'  },
  complete_followup:          { icon: CheckCircle2,  running: 'Marking follow-up done',  done: 'Follow-up completed', tone: 'green'  },
  cancel_followup:            { icon: XCircle,       running: 'Cancelling follow-up',    done: 'Follow-up cancelled', tone: 'amber'  },
  // Write — team / self
  set_rep_lead_receiving:     { icon: ToggleLeft,    running: 'Toggling lead routing',   done: 'Routing updated',     tone: 'indigo' },
  set_my_availability:        { icon: Power,         running: 'Updating availability',   done: 'Availability set',    tone: 'sky'    },
  // Session
  switch_language:            { icon: Languages,     running: 'Switching language',      done: 'Language switched',   tone: 'violet' },
}

const TONE_STYLES: Record<Tone, { iconBg: string; iconColor: string; border: string; bg: string; ring: string; text: string }> = {
  violet: { iconBg: 'bg-violet-100', iconColor: 'text-violet-600', border: 'border-violet-200', bg: 'bg-violet-50/70', ring: 'ring-violet-300', text: 'text-violet-900' },
  blue:   { iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   border: 'border-blue-200',   bg: 'bg-blue-50/70',   ring: 'ring-blue-300',   text: 'text-blue-900'   },
  indigo: { iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', border: 'border-indigo-200', bg: 'bg-indigo-50/70', ring: 'ring-indigo-300', text: 'text-indigo-900' },
  green:  { iconBg: 'bg-green-100',  iconColor: 'text-green-600',  border: 'border-green-200',  bg: 'bg-green-50/70',  ring: 'ring-green-300',  text: 'text-green-900'  },
  amber:  { iconBg: 'bg-amber-100',  iconColor: 'text-amber-600',  border: 'border-amber-200',  bg: 'bg-amber-50/70',  ring: 'ring-amber-300',  text: 'text-amber-900'  },
  sky:    { iconBg: 'bg-sky-100',    iconColor: 'text-sky-600',    border: 'border-sky-200',    bg: 'bg-sky-50/70',    ring: 'ring-sky-300',    text: 'text-sky-900'    },
  purple: { iconBg: 'bg-purple-100', iconColor: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50/70', ring: 'ring-purple-300', text: 'text-purple-900' },
  red:    { iconBg: 'bg-red-100',    iconColor: 'text-red-600',    border: 'border-red-200',    bg: 'bg-red-50/70',    ring: 'ring-red-300',    text: 'text-red-900'    },
  slate:  { iconBg: 'bg-slate-100',  iconColor: 'text-slate-600',  border: 'border-slate-200',  bg: 'bg-slate-50/70',  ring: 'ring-slate-300',  text: 'text-slate-900'  },
}

const formatDuration = (ms?: number): string => {
  if (typeof ms !== 'number' || ms < 0) return ''
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`
}

/**
 * Animated activity card for one tool call. Three states:
 *  - running: pulsing icon halo + animated shimmer line
 *  - done:    success border + duration + summary
 *  - error:   red border + reason
 */
function ToolActivityCard({ entry }: { entry: TimyTranscriptEntry }) {
  const tool = entry.tool
  if (!tool) return null
  const meta = TOOL_META[tool.name] || {
    icon: Loader2,
    running: tool.name.replace(/_/g, ' '),
    done: tool.name.replace(/_/g, ' '),
    tone: 'slate' as Tone,
  }
  const styles = TONE_STYLES[meta.tone]
  const Icon = meta.icon
  const isRunning = tool.status === 'running'
  const isError = tool.status === 'error'
  const title = isRunning ? meta.running : isError ? `${meta.done} failed` : meta.done

  return (
    <div
      className={`
        relative w-full rounded-2xl border ${isError ? 'border-red-200 bg-red-50/60' : `${styles.border} ${styles.bg}`}
        px-3 py-2.5 flex items-start gap-2.5 overflow-hidden
        ${isRunning ? `ring-1 ring-offset-0 ${styles.ring} shadow-[0_0_0_4px_rgba(99,102,241,0.04)]` : ''}
      `}
    >
      {/* Running shimmer */}
      {isRunning && (
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-[2px] overflow-hidden"
        >
          <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-[#6366F1] to-transparent animate-[timy-shimmer_1.4s_ease-in-out_infinite]" />
        </span>
      )}

      {/* Icon */}
      <div
        className={`
          relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          ${isError ? 'bg-red-100 text-red-600' : `${styles.iconBg} ${styles.iconColor}`}
        `}
      >
        {isRunning && (
          <span
            aria-hidden
            className={`absolute inset-0 rounded-lg ${styles.iconBg} animate-ping opacity-40`}
          />
        )}
        <Icon size={15} className="relative" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[12px] font-extrabold tracking-tight truncate ${isError ? 'text-red-900' : styles.text}`}>
            {title}
          </p>
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold tabular-nums">
            {isRunning ? (
              <>
                <Loader2 size={10} className="animate-spin text-current opacity-70" />
                <span className={styles.text + ' opacity-70'}>working…</span>
              </>
            ) : isError ? (
              <>
                <XCircle size={11} className="text-red-500" />
                <span className="text-red-700">{formatDuration(tool.durationMs) || 'failed'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={11} className="text-green-600" />
                <span className="text-[#475569]">{formatDuration(tool.durationMs)}</span>
              </>
            )}
          </span>
        </div>
        {tool.summary && (
          <p className={`text-[11px] font-semibold mt-0.5 ${isError ? 'text-red-700/80' : 'text-[#475569]'} truncate`}>
            {tool.summary}
          </p>
        )}
      </div>
    </div>
  )
}

export default function TimyPanel({ onClose }: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const langMenuRef = useRef<HTMLDivElement>(null)
  const [language, setLanguage] = useState<TimyLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY)
      if (isLanguage(saved)) return saved
    } catch {/* ignore */}
    return 'en-IN'
  })
  // Forward declaration so the session hook can call back into the panel
  // when Gemini fires switch_language. Ref keeps the latest closure without
  // bloating useTimySession's deps.
  const handleLanguageChangeRef = useRef<(next: TimyLanguage) => void>(() => {})

  const session = useTimySession({
    onError: (m) => setErrorMsg(m),
    language,
    onLanguageSwitch: (next) => handleLanguageChangeRef.current(next),
  })
  const transcriptRef = useRef<HTMLDivElement>(null)

  const handleLanguageChange = useCallback(
    (next: TimyLanguage) => {
      if (next === language) return
      setLanguage(next)
      try { localStorage.setItem(LANG_STORAGE_KEY, next) } catch {/* ignore */}
      const wasLive =
        session.status === 'listening' ||
        session.status === 'speaking' ||
        session.status === 'thinking' ||
        session.status === 'connecting'
      if (wasLive) {
        session.stop()
        setTimeout(() => session.start(), 500)
      }
    },
    [language, session]
  )

  handleLanguageChangeRef.current = handleLanguageChange

  useEffect(() => {
    if (!langMenuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!langMenuRef.current) return
      if (!langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLangMenuOpen(false) }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [langMenuOpen])

  const currentLang = LANG_OPTIONS.find((o) => o.value === language) || LANG_OPTIONS[0]

  useEffect(() => {
    const el = transcriptRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [session.transcript.length, session.activeTool])

  const statusMeta = STATUS_META[session.status] || STATUS_META.idle
  const isLive =
    session.status === 'listening' ||
    session.status === 'speaking' ||
    session.status === 'thinking'
  const orbScale = useMemo(() => {
    const lvl = Math.max(session.inputLevel, session.outputLevel)
    return 1 + lvl * 0.25
  }, [session.inputLevel, session.outputLevel])
  const isOffline =
    session.status === 'idle' ||
    session.status === 'closed' ||
    session.status === 'error'

  return (
    <div
      className="fixed inset-0 z-[80] bg-white animate-in fade-in duration-200 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* Single soft wash — replaces the 3-layer gradient + dot pattern from
          the previous design. Less visual noise, same warmth. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(48% 36% at 50% 0%, rgba(99,102,241,0.06) 0%, rgba(255,255,255,0) 70%)',
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="relative z-30 px-5 lg:px-8 py-3.5 border-b border-[#EEF2F7] bg-white/85 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="relative shrink-0"
            style={{
              filter: isLive
                ? `drop-shadow(0 0 12px ${statusMeta.glow})`
                : 'drop-shadow(0 6px 14px rgba(99,102,241,0.22))',
              transition: 'filter 250ms ease',
            }}
          >
            <TimyOrbMark size={32} pulse={isLive} />
          </div>
          <p className="text-[#0F172A] font-extrabold tracking-[-0.02em] text-[16px] leading-none flex items-baseline gap-1.5">
            Timy
            <span
              className="text-[10.5px] font-extrabold tracking-[0.06em] uppercase bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg,#6366F1 0%,#8B5CF6 45%,#EC4899 100%)' }}
            >
              AI
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-bold ${statusMeta.tone}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusMeta.pulse ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: statusMeta.dot }}
            />
            {statusMeta.label}
          </span>

          {/* Language picker */}
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
              title="Voice language"
              className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full bg-white border border-[#E2E8F0] text-[11px] font-extrabold text-[#0F172A] tracking-tight hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors"
            >
              <Languages size={12} className="text-[#8B5CF6]" />
              <span>{currentLang.short}</span>
              <ChevronDown size={12} className={`text-[#94A3B8] transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {langMenuOpen && (
              <div
                role="listbox"
                aria-label="Voice language"
                className="absolute right-0 top-[calc(100%+8px)] w-[240px] z-[100] rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_14px_40px_-10px_rgba(15,23,42,0.18)] overflow-hidden"
              >
                <ul className="py-1.5">
                  {LANG_OPTIONS.map((opt) => {
                    const active = opt.value === language
                    return (
                      <li key={opt.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => { handleLanguageChange(opt.value); setLangMenuOpen(false) }}
                          className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${active ? 'bg-[#EEF2FF]' : 'hover:bg-[#F8FAFC]'}`}
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-[#4338CA] text-white' : 'bg-[#F1F5F9] text-transparent border border-[#E2E8F0]'}`}
                          >
                            <Check size={10} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <p className={`text-[12.5px] font-extrabold tracking-tight ${active ? 'text-[#312E81]' : 'text-[#0F172A]'}`}>
                              {opt.native}
                              <span className="text-[#94A3B8] font-bold ml-1.5">· {opt.description}</span>
                            </p>
                            <p className="text-[10px] font-semibold text-[#94A3B8] mt-0.5">{opt.voice}</p>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] overflow-hidden">
        {/* Orb column */}
        <section className="relative flex flex-col items-center justify-center px-6 py-6 border-b lg:border-b-0 lg:border-r border-[#EEF2F7]">
          <div className="relative w-[150px] h-[150px] flex items-center justify-center">
            {isLive && (
              <>
                <span className="absolute w-[140px] h-[140px] rounded-full border border-[#C4B5FD]/40 animate-ping" />
                <span
                  className="absolute w-[120px] h-[120px] rounded-full border border-[#A5B4FC]/55 animate-ping"
                  style={{ animationDelay: '0.4s' }}
                />
              </>
            )}
            <div
              className="relative w-[96px] h-[96px] rounded-full transition-transform duration-150 ease-out"
              style={{ transform: `scale(${orbScale.toFixed(3)})` }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 30% 28%, #FFFFFF 0%, #E0E7FF 16%, #C4B5FD 42%, #818CF8 72%, #4F46E5 100%)',
                  boxShadow:
                    '0 18px 44px -12px rgba(99,102,241,0.45), inset -5px -8px 18px rgba(67,56,202,0.4), inset 7px 10px 18px rgba(255,255,255,0.6)',
                }}
              />
              <div
                aria-hidden
                className="absolute top-2 left-3 w-10 h-6 rounded-full blur-md opacity-80"
                style={{ background: 'radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)' }}
              />
            </div>
          </div>

          {/* Equalizer */}
          <div className="flex items-end justify-center gap-[3px] h-5 mt-3">
            {Array.from({ length: 16 }).map((_, i) => {
              const seed = (Math.sin(Date.now() / 220 + i * 0.6) + 1) / 2
              const lvl = Math.max(session.inputLevel, session.outputLevel)
              const h = 3 + lvl * 14 * (0.4 + seed * 0.6)
              return (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-[#8B5CF6] to-[#EC4899] transition-[height] duration-100"
                  style={{ height: `${h}px`, opacity: 0.4 + lvl * 0.6 }}
                />
              )
            })}
          </div>

          <p className="text-[#0F172A] text-[13px] font-extrabold tracking-tight text-center mt-3">
            {(() => {
              const copy: Record<TimyLanguage, Record<string, string>> = {
                'en-IN': {
                  offline: 'Tap below to start talking',
                  listening: "I'm listening",
                  speaking: 'Timy is speaking…',
                  thinking: 'One moment…',
                  connecting: 'Connecting…',
                  fallback: 'Ready when you are',
                },
                'hi-IN': {
                  offline: 'बात शुरू करने के लिए नीचे टैप करें',
                  listening: 'मैं सुन रहा हूँ',
                  speaking: 'Timy बोल रहा है…',
                  thinking: 'एक सेकंड…',
                  connecting: 'Connect हो रहा है…',
                  fallback: 'जब आप तैयार हों, बता दीजिए',
                },
                'kn-IN': {
                  offline: 'ಮಾತನಾಡಲು ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ',
                  listening: 'ನಾನು ಕೇಳ್ತಿದೀನಿ',
                  speaking: 'Timy ಮಾತಾಡ್ತಿದಾನೆ…',
                  thinking: 'ಒಂದು ಕ್ಷಣ…',
                  connecting: 'Connect ಆಗ್ತಿದೆ…',
                  fallback: 'ನೀವು ತಯಾರಿದ್ದರೆ ಶುರು ಮಾಡಿ',
                },
              }
              const lang = copy[language]
              if (isOffline) return lang.offline
              if (session.status === 'listening') return lang.listening
              if (session.status === 'speaking') return lang.speaking
              if (session.status === 'thinking') return lang.thinking
              if (session.status === 'connecting') return lang.connecting
              return lang.fallback
            })()}
          </p>
        </section>

        {/* Conversation column */}
        <section className="relative flex flex-col bg-white overflow-hidden min-h-0">
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-5 lg:px-8 py-5 space-y-2"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            {session.transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
                  <Languages size={18} className="text-[#94A3B8]" />
                </div>
                <p className="text-[#0F172A] font-bold text-[13px]">Ask Timy anything</p>
                <p className="text-[#94A3B8] font-medium text-[11.5px] mt-1 max-w-[260px]">
                  Find leads, schedule follow-ups, change a status — by voice or text.
                </p>
              </div>
            ) : (
              session.transcript.map((entry) => {
                if (entry.role === 'tool' && entry.tool) {
                  return (
                    <div key={entry.id} className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <div className="max-w-[92%] w-full">
                        <ToolActivityCard entry={entry} />
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={entry.id}
                    className={`flex animate-in fade-in slide-in-from-bottom-1 duration-200 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[86%] px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                        entry.role === 'user'
                          ? 'bg-gradient-to-br from-[#1D4ED8] to-[#312E81] text-white font-semibold rounded-[16px] rounded-br-md'
                          : 'bg-[#F1F5F9] text-[#0F172A] font-medium border border-[#E2E8F0] rounded-[16px] rounded-bl-md'
                      }`}
                    >
                      {entry.text}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {errorMsg && (
            <div className="mx-5 lg:mx-8 mb-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[11.5px]">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span className="font-semibold flex-1">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-[#B91C1C]/70 hover:text-[#B91C1C]" aria-label="Dismiss">
                <X size={12} />
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer / controls ──────────────────────────────────────── */}
      <footer className="relative z-10 px-5 lg:px-8 py-3.5 border-t border-[#EEF2F7] bg-[#FAFBFC]/80 backdrop-blur">
        <div className="max-w-[820px] mx-auto flex items-center gap-2">
          {isOffline ? (
            <button
              type="button"
              onClick={() => { setErrorMsg(null); session.start() }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#15803D] text-white text-[13.5px] font-extrabold tracking-tight shadow-[0_10px_25px_-6px_rgba(22,163,74,0.45)] hover:shadow-[0_14px_30px_-6px_rgba(22,163,74,0.6)] active:scale-[0.98] transition-all"
            >
              <Phone size={15} />
              {language === 'hi-IN' ? 'बात शुरू करें' : language === 'kn-IN' ? 'ಮಾತನಾಡಲು ಶುರು ಮಾಡಿ' : 'Start talking'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={session.toggleMute}
                title={session.muted ? 'Unmute mic' : 'Mute mic'}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-colors ${session.muted ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]' : 'bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}
              >
                {session.muted ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              <form
                className="flex-1 flex items-center gap-1 px-3 py-2 rounded-2xl bg-white border border-[#E2E8F0] focus-within:border-[#BFDBFE] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all"
                onSubmit={(e) => {
                  e.preventDefault()
                  const t = textDraft.trim()
                  if (!t) return
                  session.sendText(t)
                  setTextDraft('')
                }}
              >
                <input
                  type="text"
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  placeholder={language === 'hi-IN' ? 'मैसेज लिखें…' : language === 'kn-IN' ? 'ಸಂದೇಶ ಬರೆಯಿರಿ…' : 'Type a message…'}
                  className="flex-1 bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] text-[12.5px] font-medium outline-none px-1"
                />
                {textDraft.trim() && (
                  <button
                    type="submit"
                    className="w-7 h-7 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white flex items-center justify-center transition-colors shrink-0"
                    title="Send"
                    aria-label="Send"
                  >
                    <Send size={12} />
                  </button>
                )}
              </form>

              <button
                type="button"
                onClick={() => session.stop()}
                title="End session"
                className="w-10 h-10 rounded-2xl bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors shadow-[0_8px_20px_-6px_rgba(239,68,68,0.5)]"
              >
                <PhoneOff size={15} />
              </button>
            </>
          )}
        </div>

        <div className="max-w-[820px] mx-auto mt-2.5 flex items-center justify-center gap-3 text-[10px] font-semibold text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={10} className="text-[#16A34A]" />
            Role-scoped — Timy only sees what you can see
          </span>
        </div>
      </footer>

      {/* keyframes for the running shimmer on tool cards. Tailwind doesn't
          ship a built-in shimmer so we register one inline. */}
      <style>{`
        @keyframes timy-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}

/** Compact orb mark for the header — same look as the floating button. */
function TimyOrbMark({ size = 32, pulse = false }: { size?: number; pulse?: boolean }) {
  const gid = useMemo(() => `timy-h-${Math.random().toString(36).slice(2, 8)}`, [])
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <radialGradient id={`${gid}-core`} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="22%" stopColor="#E0E7FF" />
          <stop offset="55%" stopColor="#A78BFA" />
          <stop offset="80%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#3730A3" />
        </radialGradient>
      </defs>
      {pulse && (
        <circle cx="24" cy="24" r="22" fill="none" stroke="#A78BFA" strokeWidth="1" strokeOpacity="0.45">
          <animate attributeName="r" values="20;23;20" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.55;0.1;0.55" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx="24" cy="24" r="16" fill={`url(#${gid}-core)`} />
      <ellipse cx="19" cy="18" rx="5.5" ry="3" fill="white" opacity="0.85" />
      <ellipse cx="17.5" cy="17" rx="1.8" ry="1" fill="white" opacity="0.95" />
    </svg>
  )
}

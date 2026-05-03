import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Mic, MicOff, Phone, PhoneOff, Send,
  Loader2, AlertCircle, Languages,
  ChevronDown, Check, CheckCircle2, XCircle,
  Search, ListOrdered, BarChart3, CalendarDays, AlarmClock,
  PhoneCall, Users, UserSearch, LineChart, UserPlus, Tag,
  FileText, UserCheck, Trash2, CalendarPlus,
  ToggleLeft, Power, Sparkles,
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
}

const LANG_OPTIONS: LangOption[] = [
  { value: 'en-IN', short: 'EN', native: 'English', description: 'Indian English' },
  { value: 'hi-IN', short: 'HI', native: 'हिन्दी',  description: 'Hindi'          },
  { value: 'kn-IN', short: 'KN', native: 'ಕನ್ನಡ',  description: 'Kannada'        },
]

interface Props {
  onClose: () => void
}

const STATUS_META: Record<
  string,
  { label: string; tone: string; dot: string; pulse?: boolean }
> = {
  idle:       { label: 'Ready',      tone: 'text-[#475569]', dot: '#94A3B8' },
  connecting: { label: 'Connecting', tone: 'text-[#B45309]', dot: '#F59E0B', pulse: true },
  listening:  { label: 'Listening',  tone: 'text-[#15803D]', dot: '#16A34A', pulse: true },
  thinking:   { label: 'Thinking',   tone: 'text-[#1D4ED8]', dot: '#1D4ED8', pulse: true },
  speaking:   { label: 'Speaking',   tone: 'text-[#7C3AED]', dot: '#8B5CF6', pulse: true },
  closed:     { label: 'Ended',      tone: 'text-[#94A3B8]', dot: '#CBD5E1' },
  error:      { label: 'Error',      tone: 'text-[#B91C1C]', dot: '#EF4444' },
}

// Per-tool presentation. Every tool Timy can call gets its own icon + verb
// so the activity card reads at a glance.
type Tone = 'violet' | 'blue' | 'indigo' | 'green' | 'amber' | 'sky' | 'purple' | 'red' | 'slate'

interface ToolMeta {
  icon: LucideIcon
  running: string
  done: string
  tone: Tone
}

const TOOL_META: Record<string, ToolMeta> = {
  find_lead:                  { icon: Search,        running: 'Searching leads',         done: 'Lead search',         tone: 'blue'   },
  list_recent_leads:          { icon: ListOrdered,   running: 'Loading recent leads',    done: 'Recent leads',        tone: 'blue'   },
  count_leads_by_disposition: { icon: BarChart3,     running: 'Counting pipeline',       done: 'Pipeline counts',     tone: 'indigo' },
  get_today_followups:        { icon: CalendarDays,  running: "Today's follow-ups",      done: "Today's follow-ups",  tone: 'green'  },
  get_overdue_followups:      { icon: AlarmClock,    running: 'Overdue follow-ups',      done: 'Overdue follow-ups',  tone: 'amber'  },
  get_my_recent_calls:        { icon: PhoneCall,     running: 'Loading recent calls',    done: 'Recent calls',        tone: 'sky'    },
  get_team_overview:          { icon: Users,         running: 'Reading team overview',   done: 'Team overview',       tone: 'indigo' },
  find_team_member:           { icon: UserSearch,    running: 'Finding team member',     done: 'Team match',          tone: 'indigo' },
  get_my_pipeline_summary:    { icon: LineChart,     running: 'Pipeline summary',        done: 'Pipeline summary',    tone: 'purple' },
  create_lead:                { icon: UserPlus,      running: 'Creating lead',           done: 'Lead created',        tone: 'green'  },
  update_lead_disposition:    { icon: Tag,           running: 'Updating status',         done: 'Status updated',      tone: 'blue'   },
  add_lead_note:              { icon: FileText,      running: 'Adding note',             done: 'Note added',          tone: 'slate'  },
  assign_lead:                { icon: UserCheck,     running: 'Assigning lead',          done: 'Lead assigned',       tone: 'green'  },
  delete_lead:                { icon: Trash2,        running: 'Deleting lead',           done: 'Lead deleted',        tone: 'red'    },
  schedule_followup:          { icon: CalendarPlus,  running: 'Scheduling follow-up',    done: 'Follow-up scheduled', tone: 'green'  },
  complete_followup:          { icon: CheckCircle2,  running: 'Marking follow-up done',  done: 'Follow-up completed', tone: 'green'  },
  cancel_followup:            { icon: XCircle,       running: 'Cancelling follow-up',    done: 'Follow-up cancelled', tone: 'amber'  },
  set_rep_lead_receiving:     { icon: ToggleLeft,    running: 'Toggling lead routing',   done: 'Routing updated',     tone: 'indigo' },
  set_my_availability:        { icon: Power,         running: 'Updating availability',   done: 'Availability set',    tone: 'sky'    },
  switch_language:            { icon: Languages,     running: 'Switching language',      done: 'Language switched',   tone: 'violet' },
}

// Single-source palette so the icon, dot, and accent line on each activity
// card stay perfectly in sync.
const TONE: Record<Tone, { fg: string; bg: string; ring: string; line: string }> = {
  violet: { fg: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-200', line: 'bg-violet-500' },
  blue:   { fg: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   line: 'bg-blue-500'   },
  indigo: { fg: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-200', line: 'bg-indigo-500' },
  green:  { fg: 'text-green-600',  bg: 'bg-green-50',  ring: 'ring-green-200',  line: 'bg-green-500'  },
  amber:  { fg: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  line: 'bg-amber-500'  },
  sky:    { fg: 'text-sky-600',    bg: 'bg-sky-50',    ring: 'ring-sky-200',    line: 'bg-sky-500'    },
  purple: { fg: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-200', line: 'bg-purple-500' },
  red:    { fg: 'text-red-600',    bg: 'bg-red-50',    ring: 'ring-red-200',    line: 'bg-red-500'    },
  slate:  { fg: 'text-slate-600',  bg: 'bg-slate-50',  ring: 'ring-slate-200',  line: 'bg-slate-500'  },
}

const formatDuration = (ms?: number): string => {
  if (typeof ms !== 'number' || ms < 0) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`
}

/**
 * Activity card for one tool call. Compact horizontal pill with icon,
 * verb, summary, and a thin animated accent line while running.
 */
function ToolCard({ entry }: { entry: TimyTranscriptEntry }) {
  const tool = entry.tool
  if (!tool) return null
  const meta = TOOL_META[tool.name] || {
    icon: Sparkles,
    running: tool.name.replace(/_/g, ' '),
    done: tool.name.replace(/_/g, ' '),
    tone: 'slate' as Tone,
  }
  const palette = TONE[meta.tone]
  const Icon = meta.icon
  const isRunning = tool.status === 'running'
  const isError = tool.status === 'error'
  const title = isRunning ? meta.running : isError ? `${meta.done} failed` : meta.done

  return (
    <div className="relative w-full rounded-xl border border-[#EEF2F7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {/* Left accent bar — colored & animated while running, solid when done */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${isError ? TONE.red.line : palette.line} ${isRunning ? 'opacity-80' : 'opacity-100'}`}
      />
      {/* Running shimmer along the bottom edge */}
      {isRunning && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[1.5px] overflow-hidden">
          <span className={`block h-full w-1/3 ${palette.line} opacity-60 animate-[timy-shimmer_1.4s_ease-in-out_infinite]`} />
        </span>
      )}

      <div className="pl-3.5 pr-3 py-2 flex items-center gap-2.5">
        <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isError ? TONE.red.bg : palette.bg} ${isError ? TONE.red.fg : palette.fg}`}>
          <Icon size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold tracking-tight text-[#0F172A] truncate leading-tight">{title}</p>
          {tool.summary && (
            <p className="text-[10.5px] font-medium text-[#64748B] truncate leading-snug mt-0.5">{tool.summary}</p>
          )}
        </div>
        <div className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums text-[#94A3B8]">
          {isRunning ? (
            <Loader2 size={11} className={`animate-spin ${palette.fg}`} />
          ) : isError ? (
            <>
              <XCircle size={11} className="text-red-500" />
              <span className="text-red-600">{formatDuration(tool.durationMs) || 'failed'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={11} className="text-green-500" />
              <span>{formatDuration(tool.durationMs)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Compact orb mark — used in the header and as the empty-state visual. */
function Orb({ size = 28, pulse = false, level = 0 }: { size?: number; pulse?: boolean; level?: number }) {
  const scale = 1 + level * 0.18
  return (
    <span
      aria-hidden
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className="absolute rounded-full animate-ping"
          style={{
            width: size * 1.35,
            height: size * 1.35,
            background:
              'radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 70%)',
          }}
        />
      )}
      <span
        className="rounded-full transition-transform duration-150 ease-out"
        style={{
          width: size,
          height: size,
          transform: `scale(${scale.toFixed(3)})`,
          background:
            'radial-gradient(circle at 30% 28%, #FFFFFF 0%, #E0E7FF 18%, #C4B5FD 46%, #818CF8 74%, #4F46E5 100%)',
          boxShadow:
            '0 6px 14px -4px rgba(99,102,241,0.45), inset -2px -3px 6px rgba(67,56,202,0.45), inset 2px 3px 5px rgba(255,255,255,0.7)',
        }}
      />
    </span>
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

  // Close on outside click / Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (langMenuOpen) setLangMenuOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, langMenuOpen])

  useEffect(() => {
    if (!langMenuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!langMenuRef.current) return
      if (!langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
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
  const audioLevel = useMemo(
    () => Math.max(session.inputLevel, session.outputLevel),
    [session.inputLevel, session.outputLevel]
  )
  const isOffline =
    session.status === 'idle' ||
    session.status === 'closed' ||
    session.status === 'error'

  const placeholderText =
    language === 'hi-IN' ? 'मैसेज लिखें…' :
    language === 'kn-IN' ? 'ಸಂದೇಶ ಬರೆಯಿರಿ…' :
    'Message Timy…'

  const startLabel =
    language === 'hi-IN' ? 'बात शुरू करें' :
    language === 'kn-IN' ? 'ಮಾತನಾಡಲು ಶುರು ಮಾಡಿ' :
    'Start talking'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F172A]/30 backdrop-blur-sm"
      />

      {/* Modal card — centered, compact, shadow-driven */}
      <div
        className="
          relative w-full max-w-[460px] max-h-[86vh] flex flex-col
          rounded-[24px] bg-white border border-[#E2E8F0]
          shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35),0_10px_30px_-12px_rgba(15,23,42,0.18)]
          animate-in zoom-in-95 fade-in duration-200
          overflow-hidden
        "
      >
        {/* Hairline gradient cap at the very top — the only decorative flourish */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg,#6366F1 0%,#8B5CF6 50%,#EC4899 100%)' }}
        />

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="px-4 pt-4 pb-3 flex items-center gap-2.5">
          <Orb size={22} pulse={isLive} level={audioLevel} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold tracking-tight text-[#0F172A] leading-none flex items-baseline gap-1">
              Timy
              <span
                className="text-[9px] font-extrabold tracking-[0.08em] uppercase bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg,#6366F1 0%,#EC4899 100%)' }}
              >
                AI
              </span>
            </p>
            <p className={`mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold ${statusMeta.tone} leading-none`}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${statusMeta.pulse ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: statusMeta.dot }}
              />
              {statusMeta.label}
            </p>
          </div>

          {/* Language picker — compact icon button with letter badge */}
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
              title={`Voice: ${currentLang.description}`}
              className="inline-flex items-center gap-1 pl-1.5 pr-1 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[10.5px] font-extrabold text-[#0F172A] hover:bg-white hover:border-[#CBD5E1] transition-colors"
            >
              <Languages size={11} className="text-[#8B5CF6]" />
              <span className="tabular-nums">{currentLang.short}</span>
              <ChevronDown size={10} className={`text-[#94A3B8] transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {langMenuOpen && (
              <div
                role="listbox"
                aria-label="Voice language"
                className="absolute right-0 top-[calc(100%+6px)] w-[200px] z-[100] rounded-xl bg-white border border-[#E2E8F0] shadow-[0_14px_40px_-10px_rgba(15,23,42,0.18)] overflow-hidden py-1"
              >
                {LANG_OPTIONS.map((opt) => {
                  const active = opt.value === language
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => { handleLanguageChange(opt.value); setLangMenuOpen(false) }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors ${active ? 'bg-[#EEF2FF]' : 'hover:bg-[#F8FAFC]'}`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-[#4338CA] text-white' : 'bg-transparent text-transparent'}`}>
                        <Check size={10} />
                      </span>
                      <span className="flex-1 min-w-0 flex items-center justify-between">
                        <span className={`text-[12px] font-bold ${active ? 'text-[#312E81]' : 'text-[#0F172A]'}`}>
                          {opt.native}
                        </span>
                        <span className="text-[10px] font-semibold text-[#94A3B8]">{opt.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] flex items-center justify-center transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-[260px]"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
        >
          {session.transcript.length === 0 ? (
            <EmptyState language={language} pulse={isLive} level={audioLevel} />
          ) : (
            session.transcript.map((entry) => {
              if (entry.role === 'tool' && entry.tool) {
                return (
                  <div key={entry.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <ToolCard entry={entry} />
                  </div>
                )
              }
              return (
                <div
                  key={entry.id}
                  className={`flex animate-in fade-in slide-in-from-bottom-1 duration-200 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 text-[12.5px] leading-snug ${
                      entry.role === 'user'
                        ? 'bg-[#0F172A] text-white font-semibold rounded-2xl rounded-br-md'
                        : 'bg-[#F8FAFC] text-[#0F172A] font-medium border border-[#EEF2F7] rounded-2xl rounded-bl-md'
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
          <div className="mx-4 mb-2 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[11px]">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span className="font-semibold flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-[#B91C1C]/70 hover:text-[#B91C1C]" aria-label="Dismiss">
              <X size={11} />
            </button>
          </div>
        )}

        {/* ── Footer / controls ───────────────────────────────────── */}
        <footer className="px-3 pb-3 pt-1.5 border-t border-[#F1F5F9]">
          {isOffline ? (
            <button
              type="button"
              onClick={() => { setErrorMsg(null); session.start() }}
              className="
                w-full inline-flex items-center justify-center gap-2
                px-4 py-2.5 rounded-2xl
                bg-[#0F172A] text-white text-[13px] font-extrabold tracking-tight
                shadow-[0_8px_20px_-8px_rgba(15,23,42,0.55)]
                hover:bg-[#1E293B] active:scale-[0.99]
                transition-all
              "
            >
              <Phone size={14} />
              {startLabel}
            </button>
          ) : (
            <form
              className="flex items-center gap-1.5 px-1 py-1 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] focus-within:bg-white focus-within:border-[#BFDBFE] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all"
              onSubmit={(e) => {
                e.preventDefault()
                const t = textDraft.trim()
                if (!t) return
                session.sendText(t)
                setTextDraft('')
              }}
            >
              <button
                type="button"
                onClick={session.toggleMute}
                title={session.muted ? 'Unmute mic' : 'Mute mic'}
                aria-label={session.muted ? 'Unmute mic' : 'Mute mic'}
                className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${session.muted ? 'bg-[#FEF3C7] text-[#B45309]' : 'bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]'}`}
              >
                {session.muted ? <MicOff size={13} /> : <Mic size={13} />}
              </button>

              <input
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder={placeholderText}
                className="flex-1 bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] text-[12.5px] font-medium outline-none px-1.5"
              />

              {textDraft.trim() ? (
                <button
                  type="submit"
                  className="shrink-0 w-8 h-8 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white flex items-center justify-center transition-colors"
                  title="Send"
                  aria-label="Send"
                >
                  <Send size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => session.stop()}
                  title="End session"
                  aria-label="End session"
                  className="shrink-0 w-8 h-8 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors"
                >
                  <PhoneOff size={13} />
                </button>
              )}
            </form>
          )}
        </footer>

        {/* keyframes for the running shimmer on tool cards */}
        <style>{`
          @keyframes timy-shimmer {
            0%   { transform: translateX(-110%); }
            100% { transform: translateX(420%); }
          }
        `}</style>
      </div>
    </div>
  )
}

function EmptyState({ language, pulse, level }: { language: TimyLanguage; pulse: boolean; level: number }) {
  const bars = Array.from({ length: 14 })
  const heading =
    language === 'hi-IN' ? 'Timy से कुछ भी पूछिए' :
    language === 'kn-IN' ? 'Timy ಜೊತೆ ಮಾತಾಡಿ' :
    'Ask Timy anything'
  const body =
    language === 'hi-IN' ? 'Leads ढूँढें, follow-up schedule करें, status बदलें — voice या text से।' :
    language === 'kn-IN' ? 'Leads ಹುಡುಕಿ, follow-up schedule ಮಾಡಿ, status ಬದಲಾಯಿಸಿ — voice ಅಥವಾ text ಮೂಲಕ.' :
    'Find leads, schedule follow-ups, change a status — by voice or text.'

  return (
    <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center px-6 py-8">
      <Orb size={64} pulse={pulse} level={level} />

      {/* Subtle equalizer */}
      <div className="flex items-end justify-center gap-[3px] h-3 mt-4">
        {bars.map((_, i) => {
          const seed = (Math.sin(Date.now() / 240 + i * 0.7) + 1) / 2
          const h = 2 + level * 10 * (0.45 + seed * 0.55)
          return (
            <span
              key={i}
              className="w-[2px] rounded-full bg-gradient-to-t from-[#8B5CF6] to-[#EC4899] transition-[height] duration-100"
              style={{ height: `${h}px`, opacity: 0.35 + level * 0.6 }}
            />
          )
        })}
      </div>

      <p className="text-[14px] font-extrabold tracking-tight text-[#0F172A] mt-4">{heading}</p>
      <p className="text-[11.5px] font-medium text-[#64748B] mt-1.5 max-w-[280px] leading-relaxed">{body}</p>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Mic, MicOff, Phone, PhoneOff, Send,
  Loader2, AlertCircle, ShieldCheck, Volume2, MessageSquare,
} from 'lucide-react'
import { useTimySession } from './useTimySession'

interface Props {
  onClose: () => void
}

const SUGGESTIONS = [
  { title: 'Today\'s follow-ups',  prompt: 'What follow-ups do I have today?' },
  { title: 'Pipeline summary',     prompt: 'Summarize my pipeline' },
  { title: 'Overdue follow-ups',   prompt: 'Show me overdue follow-ups' },
  { title: 'Latest leads',         prompt: 'Show me leads from this week' },
  { title: 'My recent calls',      prompt: 'Read out my last 5 calls' },
  { title: 'Find a lead',          prompt: 'Find lead by name…' },
]

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

/** Compact, premium gem mark used in the header + launcher button. */
function TimyMark({ size = 36, animate = false }: { size?: number; animate?: boolean }) {
  const gid = useMemo(() => `timy-grad-${Math.random().toString(36).slice(2, 8)}`, [])
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
        <radialGradient id={`${gid}-rim`} cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.45)" />
        </radialGradient>
        <linearGradient id={`${gid}-arc`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <filter id={`${gid}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>
      {animate && (
        <circle
          cx="24" cy="24" r="22"
          fill="none"
          stroke={`url(#${gid}-arc)`}
          strokeWidth="1"
          strokeOpacity="0.55"
          strokeDasharray="3 6"
        >
          <animateTransform
            attributeName="transform" type="rotate"
            from="0 24 24" to="360 24 24"
            dur="14s" repeatCount="indefinite"
          />
        </circle>
      )}
      <circle cx="24" cy="26" r="18" fill={`url(#${gid}-core)`} opacity="0.18" filter={`url(#${gid}-blur)`} />
      <circle cx="24" cy="24" r="16" fill={`url(#${gid}-core)`} />
      <circle cx="24" cy="24" r="16" fill={`url(#${gid}-rim)`} />
      <ellipse cx="19" cy="18" rx="6" ry="3.5" fill="white" opacity="0.85" filter={`url(#${gid}-blur)`} />
      <ellipse cx="17.5" cy="17" rx="2" ry="1.2" fill="white" opacity="0.95" />
      <path
        d="M32 14 L32.6 16 L34.6 16.6 L32.6 17.2 L32 19.2 L31.4 17.2 L29.4 16.6 L31.4 16 Z"
        fill="white" opacity="0.9"
      />
    </svg>
  )
}

export default function TimyPanel({ onClose }: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const session = useTimySession({ onError: (m) => setErrorMsg(m) })
  const transcriptRef = useRef<HTMLDivElement>(null)

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
    return 1 + lvl * 0.28
  }, [session.inputLevel, session.outputLevel])

  return (
    <div
      className="fixed inset-0 z-[80] bg-white animate-in fade-in duration-200 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* Decorative wash — soft indigo at top-left, peach at top-right */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 50% at 0% 0%, rgba(124,58,237,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(50% 50% at 100% 0%, rgba(236,72,153,0.05) 0%, rgba(255,255,255,0) 60%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, #0F172A 0.5px, transparent 0.7px)',
          backgroundSize: '14px 14px',
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="relative z-10 px-6 lg:px-10 py-4 border-b border-[#EEF2F7] bg-white/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className="relative shrink-0"
            style={{
              filter: isLive
                ? `drop-shadow(0 0 14px ${statusMeta.glow})`
                : 'drop-shadow(0 8px 18px rgba(99,102,241,0.28))',
              transition: 'filter 250ms ease',
            }}
          >
            <TimyMark size={40} animate={isLive} />
          </div>
          <div>
            <p className="text-[#0F172A] font-extrabold tracking-[-0.02em] text-[19px] leading-none flex items-baseline gap-1.5">
              Timy
              <span
                className="text-[13px] font-extrabold tracking-[0.05em] uppercase bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg,#6366F1 0%,#8B5CF6 45%,#EC4899 100%)',
                }}
              >
                AI
              </span>
            </p>
            <p className="mt-1 text-[10.5px] text-[#94A3B8] font-semibold tracking-wider uppercase leading-none">
              Voice intelligence for BuildFlow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-bold ${statusMeta.tone}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                statusMeta.pulse ? 'animate-pulse' : ''
              }`}
              style={{ backgroundColor: statusMeta.dot }}
            />
            {statusMeta.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* ── Body grid: orb + transcript ────────────────────────────── */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] overflow-hidden">
        {/* ── Left column: orb + suggestions ───────────────────────── */}
        <section
          className="relative flex flex-col items-center justify-center px-6 py-6 lg:py-8 overflow-y-auto"
          style={{
            background:
              'linear-gradient(180deg, rgba(238,242,255,0.6) 0%, rgba(255,255,255,0) 60%)',
          }}
        >
          <div className="relative w-full max-w-[360px] flex flex-col items-center">
            {/* Orb */}
            <div className="relative h-[180px] flex items-center justify-center w-full">
              <div
                aria-hidden
                className="absolute w-[210px] h-[210px] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 70%)',
                }}
              />
              {isLive && (
                <>
                  <span className="absolute w-[170px] h-[170px] rounded-full border border-[#C4B5FD]/40 animate-ping" />
                  <span
                    className="absolute w-[140px] h-[140px] rounded-full border border-[#A5B4FC]/55 animate-ping"
                    style={{ animationDelay: '0.35s' }}
                  />
                </>
              )}
              <div
                className="relative w-[110px] h-[110px] rounded-full transition-transform duration-150 ease-out"
                style={{ transform: `scale(${orbScale.toFixed(3)})` }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 28%, #FFFFFF 0%, #E0E7FF 16%, #C4B5FD 42%, #818CF8 72%, #4F46E5 100%)',
                    boxShadow:
                      '0 24px 60px -15px rgba(99,102,241,0.5), 0 6px 14px -4px rgba(99,102,241,0.3), inset -6px -10px 22px rgba(67,56,202,0.4), inset 8px 12px 22px rgba(255,255,255,0.65)',
                  }}
                />
                <div
                  aria-hidden
                  className="absolute top-2.5 left-3.5 w-12 h-7 rounded-full blur-md opacity-90"
                  style={{
                    background:
                      'radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)',
                  }}
                />
              </div>
            </div>

            {/* Equalizer */}
            <div className="flex items-end justify-center gap-[3px] h-6 mt-1 mb-3">
              {Array.from({ length: 20 }).map((_, i) => {
                const seed = (Math.sin(Date.now() / 220 + i * 0.6) + 1) / 2
                const lvl = Math.max(session.inputLevel, session.outputLevel)
                const h = 3 + lvl * 18 * (0.4 + seed * 0.6)
                return (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-gradient-to-t from-[#8B5CF6] to-[#EC4899] transition-[height] duration-100"
                    style={{ height: `${h}px`, opacity: 0.45 + lvl * 0.55 }}
                  />
                )
              })}
            </div>

            {/* Helper copy */}
            <p className="text-[#0F172A] text-[14px] font-extrabold tracking-tight text-center">
              {session.status === 'idle'
                ? 'Tap below to start talking'
                : session.status === 'listening'
                ? 'Go ahead — I\'m listening'
                : session.status === 'speaking'
                ? 'Timy is speaking…'
                : session.status === 'thinking'
                ? 'One moment…'
                : session.status === 'connecting'
                ? 'Connecting to Timy…'
                : 'Ready when you are'}
            </p>
            <p className="text-[#64748B] text-[11.5px] mt-1 font-medium text-center">
              Voice answers from your live BuildFlow data — leads, follow-ups, calls, team.
            </p>

            {/* Suggestions grid */}
            {session.status === 'idle' && (
              <div className="mt-5 w-full grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => {
                      session.start().then(() => {
                        const tryUntil = Date.now() + 5000
                        const tick = () => {
                          if (session.status === 'listening') {
                            session.sendText(s.prompt)
                          } else if (Date.now() < tryUntil) {
                            setTimeout(tick, 150)
                          }
                        }
                        setTimeout(tick, 200)
                      })
                    }}
                    className="
                      group text-left px-3 py-2.5 rounded-xl
                      bg-white border border-[#E2E8F0]
                      hover:border-[#A5B4FC] hover:bg-[#F8FAFC]
                      shadow-sm hover:shadow-md
                      transition-all
                    "
                  >
                    <p className="text-[12px] font-extrabold text-[#0F172A] tracking-tight group-hover:text-[#4338CA] transition-colors leading-tight">
                      {s.title}
                    </p>
                    <p className="text-[10.5px] text-[#94A3B8] font-semibold mt-0.5 line-clamp-1">
                      {s.prompt}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Right column: transcript ─────────────────────────────── */}
        <section className="relative flex flex-col border-t lg:border-t-0 lg:border-l border-[#EEF2F7] bg-white overflow-hidden min-h-0">
          <div className="px-6 lg:px-7 pt-5 pb-3 flex items-center justify-between border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-[#94A3B8]" />
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                Conversation
              </p>
            </div>
            {session.transcript.length > 0 && (
              <span className="text-[10.5px] font-bold text-[#94A3B8]">
                {session.transcript.length} {session.transcript.length === 1 ? 'turn' : 'turns'}
              </span>
            )}
          </div>

          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-6 lg:px-7 py-4 space-y-2.5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}
          >
            {session.transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-3">
                  <MessageSquare size={20} className="text-[#94A3B8]" />
                </div>
                <p className="text-[#0F172A] font-bold text-[14px]">No conversation yet</p>
                <p className="text-[#94A3B8] font-medium text-[12px] mt-1 max-w-[260px]">
                  Once you start talking, your turns and Timy's replies will show up here.
                </p>
              </div>
            ) : (
              session.transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                      entry.role === 'user'
                        ? 'bg-gradient-to-br from-[#1D4ED8] to-[#312E81] text-white font-semibold rounded-[16px] rounded-br-md'
                        : entry.role === 'tool'
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#DBEAFE] rounded-[16px] rounded-bl-md flex items-center gap-1.5'
                        : 'bg-[#F1F5F9] text-[#0F172A] font-medium border border-[#E2E8F0] rounded-[16px] rounded-bl-md'
                    }`}
                  >
                    {entry.role === 'tool' && (
                      <Loader2 size={11} className="animate-spin shrink-0" />
                    )}
                    <span>{entry.text}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {errorMsg && (
            <div className="mx-6 mb-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[11.5px]">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                className="ml-auto text-[#B91C1C]/70 hover:text-[#B91C1C]"
                title="Dismiss"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer / controls ──────────────────────────────────────── */}
      <footer className="relative z-10 px-6 lg:px-10 py-4 border-t border-[#EEF2F7] bg-[#FAFBFC]/80 backdrop-blur">
        <div className="max-w-[860px] mx-auto flex items-center gap-2">
          {session.status === 'idle' ||
          session.status === 'closed' ||
          session.status === 'error' ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null)
                session.start()
              }}
              className="
                flex-1 inline-flex items-center justify-center gap-2
                px-5 py-3 rounded-2xl
                bg-gradient-to-br from-[#16A34A] to-[#15803D]
                text-white text-[14px] font-extrabold tracking-tight
                shadow-[0_10px_25px_-6px_rgba(22,163,74,0.5)]
                hover:shadow-[0_14px_30px_-6px_rgba(22,163,74,0.65)]
                active:scale-[0.98]
                transition-all
              "
            >
              <Phone size={16} />
              Start talking
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={session.toggleMute}
                title={session.muted ? 'Unmute mic' : 'Mute mic'}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold transition-colors shadow-sm ${
                  session.muted
                    ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                    : 'bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                {session.muted ? <MicOff size={16} /> : <Mic size={16} />}
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
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] text-[13px] font-medium outline-none px-1"
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
                className="w-11 h-11 rounded-2xl bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors shadow-[0_8px_20px_-6px_rgba(239,68,68,0.55)]"
              >
                <PhoneOff size={16} />
              </button>
            </>
          )}
        </div>

        <div className="max-w-[860px] mx-auto mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-[10.5px] font-semibold text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-[#16A34A]" />
            Secure — your role limits what Timy can see
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Volume2 size={11} className="text-[#8B5CF6]" />
            Powered by Gemini Live
          </span>
        </div>
      </footer>
    </div>
  )
}

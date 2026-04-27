import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Mic, MicOff, Phone, PhoneOff, Send,
  Loader2, AlertCircle, ShieldCheck, Volume2,
} from 'lucide-react'
import { useTimySession } from './useTimySession'

interface Props {
  onClose: () => void
}

const SUGGESTIONS = [
  'What follow-ups do I have today?',
  'Summarize my pipeline',
  'Show me overdue follow-ups',
  'Find lead Channabasappa',
]

const STATUS_META: Record<
  string,
  { label: string; tone: string; dot: string; pulse?: boolean; glow: string }
> = {
  idle:       { label: 'Ready',         tone: 'text-[#475569]', dot: '#94A3B8', glow: 'rgba(148,163,184,0.0)' },
  connecting: { label: 'Connecting',    tone: 'text-[#B45309]', dot: '#F59E0B', glow: 'rgba(245,158,11,0.55)', pulse: true },
  listening:  { label: 'Listening',     tone: 'text-[#15803D]', dot: '#16A34A', glow: 'rgba(22,163,74,0.55)',  pulse: true },
  thinking:   { label: 'Thinking',      tone: 'text-[#1D4ED8]', dot: '#1D4ED8', glow: 'rgba(29,78,216,0.55)',  pulse: true },
  speaking:   { label: 'Speaking',      tone: 'text-[#7C3AED]', dot: '#8B5CF6', glow: 'rgba(139,92,246,0.6)',  pulse: true },
  closed:     { label: 'Session ended', tone: 'text-[#94A3B8]', dot: '#CBD5E1', glow: 'rgba(203,213,225,0)' },
  error:      { label: 'Error',         tone: 'text-[#B91C1C]', dot: '#EF4444', glow: 'rgba(239,68,68,0.55)' },
}

/**
 * Custom Timy mark — smooth gradient gem with inner highlight and a soft
 * pulsing arc that doubles as the AI "aura". Uses unique gradient ids so
 * multiple instances on a page never clash.
 */
function TimyMark({ size = 36, animate = false }: { size?: number; animate?: boolean }) {
  const gid = useMemo(
    () => `timy-grad-${Math.random().toString(36).slice(2, 8)}`,
    []
  )
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

      {/* Outer aura — only when animated */}
      {animate && (
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="none"
          stroke={`url(#${gid}-arc)`}
          strokeWidth="1"
          strokeOpacity="0.55"
          strokeDasharray="3 6"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 24 24"
            to="360 24 24"
            dur="14s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Soft drop halo */}
      <circle cx="24" cy="26" r="18" fill={`url(#${gid}-core)`} opacity="0.18" filter={`url(#${gid}-blur)`} />

      {/* Core orb */}
      <circle cx="24" cy="24" r="16" fill={`url(#${gid}-core)`} />
      <circle cx="24" cy="24" r="16" fill={`url(#${gid}-rim)`} />

      {/* Specular highlight */}
      <ellipse cx="19" cy="18" rx="6" ry="3.5" fill="white" opacity="0.85" filter={`url(#${gid}-blur)`} />
      <ellipse cx="17.5" cy="17" rx="2" ry="1.2" fill="white" opacity="0.95" />

      {/* Tiny accent star */}
      <g opacity="0.95">
        <path
          d="M32 14 L32.6 16 L34.6 16.6 L32.6 17.2 L32 19.2 L31.4 17.2 L29.4 16.6 L31.4 16 Z"
          fill="white"
          opacity="0.9"
        />
      </g>
    </svg>
  )
}

export default function TimyPanel({ onClose }: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const session = useTimySession({
    onError: (m) => setErrorMsg(m),
  })
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
    return 1 + lvl * 0.32
  }, [session.inputLevel, session.outputLevel])

  return (
    <div
      className="
        fixed inset-0 z-[80]
        flex items-end sm:items-center justify-center sm:justify-end
        p-3 sm:p-6
        bg-gradient-to-br from-[#0F172A]/35 via-[#1E1B4B]/30 to-[#0F172A]/40
        backdrop-blur-md
        animate-in fade-in duration-200
      "
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full sm:w-[440px] max-h-[88vh]
          rounded-[28px] bg-white
          ring-1 ring-[#E2E8F0]
          shadow-[0_50px_140px_-20px_rgba(15,23,42,0.45),0_18px_40px_-15px_rgba(15,23,42,0.18)]
          overflow-hidden
          flex flex-col
          animate-in slide-in-from-bottom-4 duration-300
        "
      >
        {/* Decorative top wash */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-52 pointer-events-none"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, rgba(124,58,237,0.10) 0%, rgba(236,72,153,0.06) 35%, rgba(255,255,255,0) 70%)',
          }}
        />

        {/* Subtle dotted noise */}
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
        <div className="relative flex items-center justify-between px-5 pt-5 pb-4 z-10">
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
              <TimyMark size={42} animate={isLive} />
            </div>
            <div className="min-w-0">
              <p className="text-[#0F172A] font-extrabold tracking-[-0.02em] text-[20px] leading-none flex items-baseline gap-1.5">
                Timy
                <span
                  className="text-[14px] font-bold tracking-[0.05em] uppercase bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg,#6366F1 0%,#8B5CF6 45%,#EC4899 100%)',
                  }}
                >
                  AI
                </span>
              </p>
              <p className="mt-1.5 text-[10.5px] text-[#94A3B8] font-semibold tracking-wide uppercase leading-none">
                Voice intelligence for BuildFlow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[10.5px] font-bold ${statusMeta.tone}`}
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
        </div>

        {/* Hairline divider */}
        <div className="relative h-px mx-5 bg-gradient-to-r from-transparent via-[#E2E8F0] to-transparent z-10" />

        {/* ── Visualizer / Orb ──────────────────────────────────────── */}
        <div className="relative h-[200px] flex items-center justify-center z-10">
          <div
            aria-hidden
            className="absolute w-[230px] h-[230px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 70%)',
            }}
          />
          {isLive && (
            <>
              <span className="absolute w-[180px] h-[180px] rounded-full border border-[#C4B5FD]/40 animate-ping" />
              <span
                className="absolute w-[150px] h-[150px] rounded-full border border-[#A5B4FC]/55 animate-ping"
                style={{ animationDelay: '0.35s' }}
              />
            </>
          )}

          <div
            className="relative w-[130px] h-[130px] rounded-full transition-transform duration-150 ease-out"
            style={{ transform: `scale(${orbScale.toFixed(3)})` }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 30% 28%, #FFFFFF 0%, #E0E7FF 16%, #C4B5FD 42%, #818CF8 72%, #4F46E5 100%)',
                boxShadow:
                  '0 30px 70px -15px rgba(99,102,241,0.55), 0 8px 18px -6px rgba(99,102,241,0.35), inset -7px -12px 26px rgba(67,56,202,0.45), inset 9px 14px 26px rgba(255,255,255,0.7)',
              }}
            />
            <div
              aria-hidden
              className="absolute top-3 left-4 w-14 h-9 rounded-full blur-md opacity-90"
              style={{
                background:
                  'radial-gradient(ellipse, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)',
              }}
            />
          </div>

          <div className="absolute bottom-3 left-0 right-0 flex items-end justify-center gap-[3px] h-7">
            {Array.from({ length: 18 }).map((_, i) => {
              const seed = (Math.sin(Date.now() / 220 + i * 0.6) + 1) / 2
              const lvl = Math.max(session.inputLevel, session.outputLevel)
              const h = 3 + lvl * 22 * (0.4 + seed * 0.6)
              return (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-[#8B5CF6] to-[#EC4899] transition-[height] duration-100"
                  style={{ height: `${h}px`, opacity: 0.45 + lvl * 0.55 }}
                />
              )
            })}
          </div>
        </div>

        {/* ── Transcript ────────────────────────────────────────────── */}
        <div
          ref={transcriptRef}
          className="relative flex-1 px-4 pb-3 max-h-[34vh] min-h-[80px] overflow-y-auto space-y-2 z-10"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#CBD5E1 transparent',
          }}
        >
          {session.transcript.length === 0 && session.status !== 'connecting' && (
            <div className="px-1 pt-2 pb-3 text-center">
              <p className="text-[#0F172A] text-[15px] font-bold tracking-tight">
                {session.status === 'idle'
                  ? 'Tap to start talking'
                  : 'Say something to Timy'}
              </p>
              <p className="text-[#64748B] text-[12px] mt-1 font-medium">
                {session.status === 'idle'
                  ? 'Or pick a quick prompt below.'
                  : 'Try “What follow-ups do I have today?”'}
              </p>
            </div>
          )}
          {session.transcript.map((entry) => (
            <div
              key={entry.id}
              className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                  entry.role === 'user'
                    ? 'bg-gradient-to-br from-[#1D4ED8] to-[#312E81] text-white font-semibold rounded-[18px] rounded-br-md'
                    : entry.role === 'tool'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border border-[#DBEAFE] rounded-[18px] rounded-bl-md flex items-center gap-1.5'
                    : 'bg-[#F1F5F9] text-[#0F172A] font-medium border border-[#E2E8F0] rounded-[18px] rounded-bl-md'
                }`}
              >
                {entry.role === 'tool' && (
                  <Loader2 size={11} className="animate-spin shrink-0" />
                )}
                <span>{entry.text}</span>
              </div>
            </div>
          ))}
        </div>

        {session.transcript.length === 0 && session.status === 'idle' && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5 z-10">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  session.start().then(() => {
                    const tryUntil = Date.now() + 5000
                    const tick = () => {
                      if (session.status === 'listening') {
                        session.sendText(s)
                      } else if (Date.now() < tryUntil) {
                        setTimeout(tick, 150)
                      }
                    }
                    setTimeout(tick, 200)
                  })
                }}
                className="px-3 py-1.5 rounded-full bg-white hover:bg-[#F8FAFC] text-[#1D4ED8] text-[11.5px] font-bold border border-[#DBEAFE] hover:border-[#BFDBFE] shadow-sm transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[11px] z-10">
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

        {/* ── Controls ──────────────────────────────────────────────── */}
        <div className="relative px-4 pb-3 pt-3 border-t border-[#F1F5F9] bg-[#FAFBFC] z-10">
          <div className="flex items-center gap-2">
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
                  px-4 py-3 rounded-2xl
                  bg-gradient-to-br from-[#16A34A] to-[#15803D]
                  text-white text-[14px] font-extrabold tracking-tight
                  shadow-[0_10px_25px_-6px_rgba(22,163,74,0.5)]
                  hover:shadow-[0_14px_30px_-6px_rgba(22,163,74,0.6)]
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
                    className="flex-1 bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] text-[13px] font-medium outline-none"
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

          <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-[10px] font-semibold text-[#94A3B8]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={10} className="text-[#16A34A]" />
              Secure — role-scoped data
            </span>
            <span className="inline-flex items-center gap-1">
              <Volume2 size={10} className="text-[#8B5CF6]" />
              Powered by Gemini Live
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

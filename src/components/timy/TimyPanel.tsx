import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Mic, MicOff, Phone, PhoneOff, Sparkles, Send,
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

const STATUS_META: Record<string, { label: string; tone: string; pulse?: boolean }> = {
  idle: { label: 'Ready', tone: 'text-white/80' },
  connecting: { label: 'Connecting…', tone: 'text-amber-300', pulse: true },
  listening: { label: 'Listening', tone: 'text-emerald-300', pulse: true },
  thinking: { label: 'Thinking…', tone: 'text-sky-300', pulse: true },
  speaking: { label: 'Speaking', tone: 'text-fuchsia-300', pulse: true },
  closed: { label: 'Session ended', tone: 'text-white/60' },
  error: { label: 'Error', tone: 'text-red-300' },
}

export default function TimyPanel({ onClose }: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const session = useTimySession({
    onError: (m) => setErrorMsg(m),
  })
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript to the bottom on new entries
  useEffect(() => {
    const el = transcriptRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [session.transcript.length, session.activeTool])

  const statusMeta = STATUS_META[session.status] || STATUS_META.idle
  const isLive = session.status === 'listening' || session.status === 'speaking' || session.status === 'thinking'

  const orbScale = useMemo(() => {
    const lvl = Math.max(session.inputLevel, session.outputLevel)
    return 1 + lvl * 0.35
  }, [session.inputLevel, session.outputLevel])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/55 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full sm:w-[420px] max-h-[88vh]
          rounded-3xl border border-white/10
          overflow-hidden
          shadow-[0_40px_120px_rgba(15,23,42,0.6)]
          animate-in slide-in-from-bottom-4 duration-300
        "
        style={{
          background:
            'radial-gradient(120% 120% at 100% 0%, #6366F1 0%, #4338CA 30%, #1E1B4B 65%, #0F0B2D 100%)',
        }}
      >
        {/* Decorative grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            background:
              'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 12px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 12px)',
          }}
        />

        {/* Header */}
        <div className="relative flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
              {isLive && (
                <span className="absolute -inset-1 rounded-2xl border border-fuchsia-300/60 animate-ping" />
              )}
            </div>
            <div>
              <p className="text-white font-extrabold tracking-tight text-base leading-none">Timy AI</p>
              <p className={`mt-1 text-[11px] font-semibold flex items-center gap-1.5 ${statusMeta.tone}`}>
                {statusMeta.pulse && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                )}
                {statusMeta.label}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 text-white flex items-center justify-center transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Visualizer / Orb */}
        <div className="relative h-[160px] flex items-center justify-center">
          <div
            className="relative w-[120px] h-[120px] rounded-full transition-transform duration-150 ease-out"
            style={{ transform: `scale(${orbScale.toFixed(3)})` }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, #F0ABFC 0%, #C084FC 40%, #6366F1 75%, #1E1B4B 100%)',
                boxShadow:
                  '0 25px 80px -10px rgba(192,132,252,0.55), inset 0 0 30px rgba(255,255,255,0.25)',
              }}
            />
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-white/20 via-transparent to-transparent" />
            {(session.status === 'speaking' || session.status === 'thinking') && (
              <span className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
            )}
          </div>

          {/* Equalizer bars */}
          <div className="absolute bottom-2 left-0 right-0 flex items-end justify-center gap-1 h-7">
            {Array.from({ length: 14 }).map((_, i) => {
              const seed = (Math.sin((Date.now() / 250) + i) + 1) / 2
              const lvl = Math.max(session.inputLevel, session.outputLevel)
              const h = 4 + (lvl * 26 * seed)
              return (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-fuchsia-400 to-sky-300 transition-[height] duration-100"
                  style={{ height: `${h}px`, opacity: 0.55 + lvl * 0.45 }}
                />
              )
            })}
          </div>
        </div>

        {/* Transcript */}
        <div
          ref={transcriptRef}
          className="relative px-4 pb-3 max-h-[34vh] overflow-y-auto space-y-2 scrollbar-none"
        >
          {session.transcript.length === 0 && session.status !== 'connecting' && (
            <div className="px-1 pt-1 pb-3 text-center">
              <p className="text-white/85 text-sm font-semibold">
                {session.status === 'idle' ? 'Tap the call button to start talking' : 'Say something to Timy'}
              </p>
              <p className="text-white/55 text-[11px] mt-1">
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
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed ${
                  entry.role === 'user'
                    ? 'bg-white/95 text-[#1E1B4B] font-semibold rounded-br-md'
                    : entry.role === 'tool'
                    ? 'bg-white/10 text-white/80 italic font-medium rounded-bl-md flex items-center gap-1.5'
                    : 'bg-white/15 text-white font-medium rounded-bl-md backdrop-blur'
                }`}
              >
                {entry.role === 'tool' && <Loader2 size={11} className="animate-spin shrink-0" />}
                <span>{entry.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Suggestion chips (only when not yet started) */}
        {session.transcript.length === 0 && session.status === 'idle' && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  // Start the session, then send the suggestion as text once connected.
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
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-[11px] font-semibold border border-white/15 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Error strip */}
        {errorMsg && (
          <div className="mx-4 mb-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-400/40 text-red-100 text-[11px]">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-auto text-red-100/70 hover:text-white"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="relative px-4 pb-4 pt-2 flex items-center gap-2 border-t border-white/10 bg-black/20 backdrop-blur">
          {session.status === 'idle' || session.status === 'closed' || session.status === 'error' ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null)
                session.start()
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-extrabold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-shadow"
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
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold transition-colors ${
                  session.muted
                    ? 'bg-amber-400/30 text-amber-100 ring-1 ring-amber-300/50'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {session.muted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <form
                className="flex-1 flex items-center gap-1 px-3 py-2 rounded-2xl bg-white/8 border border-white/15"
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
                  placeholder="Or type a message…"
                  className="flex-1 bg-transparent text-white placeholder:text-white/45 text-[13px] outline-none"
                />
                {textDraft.trim() && (
                  <button
                    type="submit"
                    className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
                    title="Send"
                  >
                    <Send size={12} />
                  </button>
                )}
              </form>

              <button
                type="button"
                onClick={() => session.stop()}
                title="End session"
                className="w-11 h-11 rounded-2xl bg-red-500/85 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/30"
              >
                <PhoneOff size={16} />
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-4 pb-3 pt-1 flex items-center justify-between text-[10px] text-white/55">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={10} />
            Secure session — your role limits what Timy can see.
          </span>
          <span className="inline-flex items-center gap-1">
            <Volume2 size={10} />
            Powered by Gemini Live
          </span>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import TimyPanel from './TimyPanel'

/**
 * Floating Timy AI launcher.
 *
 * Sits in the bottom-right of every page once the user is authenticated.
 * Uses a custom SVG mark (matches the panel header) so the brand reads as
 * a polished AI gem rather than a generic sparkles icon.
 */
export default function TimyButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const gid = useMemo(
    () => `timy-fab-${Math.random().toString(36).slice(2, 8)}`,
    []
  )

  if (!user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Talk to Timy AI"
        aria-label="Open Timy AI voice assistant"
        className="
          fixed bottom-6 right-6 z-[55]
          group flex items-center gap-2.5 pl-2.5 pr-4 py-2.5
          rounded-full bg-white
          ring-1 ring-[#E2E8F0]
          text-[#0F172A] font-extrabold text-[13px] tracking-tight
          shadow-[0_18px_45px_-12px_rgba(99,102,241,0.40),0_6px_18px_-8px_rgba(15,23,42,0.18)]
          hover:shadow-[0_22px_55px_-12px_rgba(99,102,241,0.55),0_10px_24px_-8px_rgba(15,23,42,0.22)]
          hover:-translate-y-[1px]
          active:translate-y-0
          transition-all duration-200
        "
      >
        {/* Soft outer halo — gives the gem a glow on hover */}
        <span
          aria-hidden
          className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-md"
          style={{
            background:
              'conic-gradient(from 0deg,#A78BFA,#EC4899,#F59E0B,#A78BFA)',
            opacity: 0.35,
          }}
        />

        {/* Brand mark */}
        <span className="relative w-9 h-9 shrink-0">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
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

            {/* Slow rotating dashed aura */}
            <circle
              cx="24" cy="24" r="22"
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
        </span>

        <span className="hidden sm:flex flex-col items-start leading-none">
          <span>
            Timy{' '}
            <span
              className="bg-clip-text text-transparent text-[12px] font-extrabold tracking-[0.06em] uppercase"
              style={{
                backgroundImage:
                  'linear-gradient(135deg,#6366F1 0%,#8B5CF6 45%,#EC4899 100%)',
              }}
            >
              AI
            </span>
          </span>
          <span className="text-[9.5px] font-semibold text-[#94A3B8] tracking-wide uppercase mt-1">
            Ask anything
          </span>
        </span>
      </button>

      {open && <TimyPanel onClose={() => setOpen(false)} />}
    </>
  )
}

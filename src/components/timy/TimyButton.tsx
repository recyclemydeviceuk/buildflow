import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import TimyPanel from './TimyPanel'

/**
 * Floating Timy AI launcher.
 *
 * Compact circular button anchored to the bottom-right of every
 * authenticated page. Tooltip on hover, panel opens on click.
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
          fixed bottom-5 right-5 z-[55]
          group w-11 h-11 rounded-full
          bg-white ring-1 ring-[#E2E8F0]
          flex items-center justify-center
          shadow-[0_10px_24px_-8px_rgba(99,102,241,0.45),0_4px_10px_-4px_rgba(15,23,42,0.18)]
          hover:shadow-[0_14px_30px_-8px_rgba(99,102,241,0.6),0_6px_14px_-4px_rgba(15,23,42,0.22)]
          hover:-translate-y-[1px]
          active:translate-y-0
          transition-all duration-200
        "
      >
        {/* Soft conic halo on hover */}
        <span
          aria-hidden
          className="absolute -inset-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-[6px]"
          style={{
            background:
              'conic-gradient(from 0deg,#A78BFA,#EC4899,#F59E0B,#A78BFA)',
            opacity: 0.35,
          }}
        />

        {/* Orb mark */}
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
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
          </defs>
          <circle cx="24" cy="24" r="18" fill={`url(#${gid}-core)`} />
          <circle cx="24" cy="24" r="18" fill={`url(#${gid}-rim)`} />
          <ellipse cx="19" cy="18" rx="6" ry="3.5" fill="white" opacity="0.85" />
          <ellipse cx="17.5" cy="17" rx="2" ry="1.2" fill="white" opacity="0.95" />
        </svg>
      </button>

      {open && <TimyPanel onClose={() => setOpen(false)} />}
    </>
  )
}

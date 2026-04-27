import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import TimyPanel from './TimyPanel'

/**
 * Floating "Timy AI" launcher. Mounts once globally inside Layout so the
 * pulse + glow animation is visible from every screen. The actual session
 * lives inside TimyPanel — clicking the button just toggles visibility.
 */
export default function TimyButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  // Close on Esc when the panel is open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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
          group flex items-center gap-2 pl-3 pr-4 py-3
          rounded-full
          bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#EC4899]
          text-white font-bold text-sm
          shadow-[0_18px_50px_-10px_rgba(139,92,246,0.65)]
          hover:shadow-[0_22px_60px_-10px_rgba(139,92,246,0.8)]
          hover:scale-[1.03] active:scale-[0.97]
          transition-all duration-200
        "
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#EC4899] opacity-50 blur-md animate-pulse -z-10" />
        {/* Core icon — orbit animation */}
        <span className="relative w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
          <Sparkles size={14} className="text-white drop-shadow-sm" />
          <span className="absolute inset-[-2px] rounded-full border border-white/40 animate-ping" />
        </span>
        <span className="hidden sm:inline tracking-tight">Timy AI</span>
      </button>

      {open && <TimyPanel onClose={() => setOpen(false)} />}
    </>
  )
}

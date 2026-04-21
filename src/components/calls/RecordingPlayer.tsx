import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Loader2, PhoneOff } from 'lucide-react'
import { callsAPI, type Call } from '../../api/calls'

/**
 * Inline recording player used in the Call Log detail view and the Call
 * History panel on the Lead Detail page.
 *
 * Why a custom player instead of a raw <audio controls>:
 *   • The native controls auto-hide the scrub bar when the element is
 *     narrow (happens in the 320px right-side panel on Lead Detail).
 *   • We need to authenticate against our backend proxy — we fetch the
 *     blob up front with fetch() (which uses axios default cookies / the
 *     token query param), then point the hidden <audio> at an object URL.
 *   • One consistent look across the app.
 */

function fmtDuration(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export type RecordingPlayerVariant = 'dark' | 'light'

interface Props {
  call: Call
  featureRecording: boolean
  /** Visual style — dark charcoal (default, used in the CallLog detail) or
   * lighter / tighter for narrower contexts like the lead-detail right panel. */
  variant?: RecordingPlayerVariant
}

export default function RecordingPlayer({ call, featureRecording, variant = 'dark' }: Props) {
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
    if (!featureRecording || !call.recordingUrl) {
      setLoading(false)
      return
    }
    let objUrl: string | null = null
    setLoading(true)
    setError(false)
    fetch(callsAPI.getRecordingUrl(call._id))
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.blob()
      })
      .then((blob) => {
        objUrl = URL.createObjectURL(blob)
        setAudioSrc(objUrl)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => {
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [call._id, call.recordingUrl, featureRecording])

  const toggle = () => {
    if (!audioRef.current || !audioSrc) return
    if (isPlaying) audioRef.current.pause()
    else void audioRef.current.play()
    setIsPlaying((p) => !p)
  }

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  if (!featureRecording || !call.recordingUrl) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${variant === 'dark' ? 'bg-[#F1F5F9] border border-[#E2E8F0]' : 'bg-[#F8FAFC] border border-[#E2E8F0]'}`}>
        <PhoneOff size={12} className="text-[#94A3B8]" />
        <span className="text-[10px] text-[#94A3B8]">
          {!featureRecording ? 'Recordings disabled' : 'No recording available'}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
        <Loader2 size={12} className="text-[#1D4ED8] animate-spin" />
        <span className="text-[10px] text-[#64748B]">Loading recording…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
        <PhoneOff size={12} className="text-[#DC2626]" />
        <span className="text-[10px] text-[#DC2626]">Could not load recording</span>
      </div>
    )
  }

  const isDark = variant === 'dark'
  const wrapperCls = isDark
    ? 'bg-[#0F172A] rounded-xl px-3 py-2.5'
    : 'bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-2'
  const timeCls = isDark
    ? 'text-[9px] font-mono text-[#64748B]'
    : 'text-[9px] font-mono text-[#94A3B8]'
  const trackCls = isDark ? 'bg-white/10' : 'bg-[#F1F5F9]'
  const fillCls = isDark ? 'bg-[#3B82F6]' : 'bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8]'
  const btnSize = isDark ? 'w-8 h-8' : 'w-7 h-7'
  const iconSize = isDark ? 13 : 11

  return (
    <div className={wrapperCls}>
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          className={`${btnSize} rounded-full bg-[#1D4ED8] flex items-center justify-center text-white hover:bg-blue-600 shrink-0 transition-colors shadow-sm`}
        >
          {isPlaying ? (
            <Pause size={iconSize} fill="currentColor" />
          ) : (
            <Play size={iconSize} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`flex justify-between ${timeCls} mb-1 leading-none`}>
            <span className="tabular-nums">{fmtDuration(currentTime)}</span>
            <span className="tabular-nums">{fmtDuration(totalDuration)}</span>
          </div>
          <div
            className={`relative h-1.5 ${trackCls} rounded-full cursor-pointer`}
            onClick={(e) => {
              if (!audioRef.current) return
              const rect = e.currentTarget.getBoundingClientRect()
              audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * totalDuration
            }}
          >
            <div
              className={`absolute left-0 top-0 h-full ${fillCls} rounded-full transition-all`}
              style={{ width: `${progress}%` }}
            />
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

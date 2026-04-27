import { useCallback, useEffect, useRef, useState } from 'react'
import {
  base64ToInt16,
  floatTo16BitPCM,
  int16ToBase64,
  int16ToFloat32,
  resampleFloat32,
} from './audioUtils'

/**
 * Drives one Timy AI voice session: WebSocket to backend, mic capture in,
 * audio playback out, and a transcript log for the panel UI.
 *
 * The hook is intentionally inert until `start()` is called — useful so we
 * can mount the floating button site-wide without grabbing the mic.
 */

const TARGET_INPUT_RATE = 16000
const PLAYBACK_RATE = 24000 // Gemini sends audio at 24kHz

export type TimyStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'closed'

export interface TimyTranscriptEntry {
  id: string
  role: 'user' | 'assistant' | 'tool'
  text: string
  /** ms timestamp */
  at: number
}

export type TimyLanguage = 'en-IN' | 'hi-IN'

interface SessionOpts {
  onError?: (msg: string) => void
  /** Voice language. Defaults to Indian English. */
  language?: TimyLanguage
  /** Fired when the model calls switch_language — UI should flip the toggle. */
  onLanguageSwitch?: (next: TimyLanguage) => void
}

/**
 * Encode the recent conversation as a compact base64-JSON blob the backend
 * can splice into the system prompt of the new session, so language switches
 * don't reset the chat.
 */
const encodeHistory = (
  entries: { role: 'user' | 'assistant' | 'tool'; text: string }[]
): string => {
  const tail = entries
    .filter((e) => e.role === 'user' || e.role === 'assistant')
    .slice(-8) // last 8 turns is enough to feel continuous without bloating the prompt
    .map((e) => ({ role: e.role, text: e.text }))
  if (tail.length === 0) return ''
  try {
    const json = JSON.stringify(tail)
    // unescape + encodeURIComponent is the canonical "btoa for utf-8 strings"
    return btoa(unescape(encodeURIComponent(json)))
  } catch {
    return ''
  }
}

const computeWsUrl = (): string => {
  // The REST API base is exposed via VITE_API_URL (e.g. http://localhost:5000/api).
  // Strip the trailing /api and switch the protocol to ws/wss.
  const apiBase: string =
    (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api'
  let origin: string
  try {
    const url = new URL(apiBase)
    origin = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  } catch {
    origin = 'ws://localhost:5000'
  }
  return `${origin}/ws/timy`
}

export const useTimySession = (opts: SessionOpts = {}) => {
  const onErrorRef = useRef(opts.onError)
  onErrorRef.current = opts.onError
  const onLanguageSwitchRef = useRef(opts.onLanguageSwitch)
  onLanguageSwitchRef.current = opts.onLanguageSwitch
  const languageRef = useRef<TimyLanguage>(opts.language || 'en-IN')
  languageRef.current = opts.language || 'en-IN'

  const [status, setStatus] = useState<TimyStatus>('idle')
  const [transcript, setTranscript] = useState<TimyTranscriptEntry[]>([])
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [inputLevel, setInputLevel] = useState(0)
  const [outputLevel, setOutputLevel] = useState(0)
  // Mirror of `transcript` we can read synchronously inside start() without
  // pulling the state into the start() dependency list (would re-create the
  // callback on every transcript change and break stale-closure invariants).
  const transcriptRef = useRef<TimyTranscriptEntry[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackQueueRef = useRef<{ at: number }>({ at: 0 })
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const mutedRef = useRef(false)
  const userBufferRef = useRef('')
  const assistantBufferRef = useRef('')
  const inputAnalyserRef = useRef<AnalyserNode | null>(null)
  const outputAnalyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  mutedRef.current = muted

  const appendEntry = useCallback((role: TimyTranscriptEntry['role'], text: string) => {
    if (!text.trim()) return
    setTranscript((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role,
          text,
          at: Date.now(),
        },
      ]
      transcriptRef.current = next
      return next
    })
  }, [])

  const flushUser = useCallback(() => {
    if (userBufferRef.current.trim()) {
      appendEntry('user', userBufferRef.current.trim())
      userBufferRef.current = ''
    }
  }, [appendEntry])

  const flushAssistant = useCallback(() => {
    if (assistantBufferRef.current.trim()) {
      appendEntry('assistant', assistantBufferRef.current.trim())
      assistantBufferRef.current = ''
    }
  }, [appendEntry])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    try { processorRef.current?.disconnect() } catch {}
    try { sourceNodeRef.current?.disconnect() } catch {}
    try { inputAnalyserRef.current?.disconnect() } catch {}
    try { outputAnalyserRef.current?.disconnect() } catch {}
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()) } catch {}
    try { audioCtxRef.current?.close() } catch {}
    try { playbackCtxRef.current?.close() } catch {}
    try { wsRef.current?.close() } catch {}
    processorRef.current = null
    sourceNodeRef.current = null
    inputAnalyserRef.current = null
    outputAnalyserRef.current = null
    micStreamRef.current = null
    audioCtxRef.current = null
    playbackCtxRef.current = null
    wsRef.current = null
    playbackQueueRef.current.at = 0
    flushUser()
    flushAssistant()
    setStatus('closed')
    setActiveTool(null)
    setInputLevel(0)
    setOutputLevel(0)
    // Transcript intentionally kept in state so a follow-up start() (e.g.
    // after a language switch) replays it as conversation history.
  }, [flushUser, flushAssistant])

  const start = useCallback(async () => {
    if (status === 'connecting' || status === 'listening' || status === 'speaking') return
    // NOTE: we deliberately don't reset the transcript here. That way a
    // language switch (which calls stop() then start()) keeps the chat on
    // screen, and we pass the recent turns to the backend so Gemini picks
    // up the conversation in the new voice instead of starting fresh.
    setStatus('connecting')
    userBufferRef.current = ''
    assistantBufferRef.current = ''

    const token = localStorage.getItem('token')
    if (!token) {
      setStatus('error')
      onErrorRef.current?.('You need to be logged in to use Timy AI.')
      return
    }

    let micStream: MediaStream
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err: any) {
      setStatus('error')
      onErrorRef.current?.(
        err?.name === 'NotAllowedError'
          ? 'Microphone access denied. Enable it in your browser settings to use Timy.'
          : 'Could not access the microphone.'
      )
      return
    }

    micStreamRef.current = micStream

    const historyParam = encodeHistory(transcriptRef.current)
    const wsUrl =
      `${computeWsUrl()}?token=${encodeURIComponent(token)}` +
      `&lang=${encodeURIComponent(languageRef.current)}` +
      (historyParam ? `&history=${encodeURIComponent(historyParam)}` : '')
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (err) {
      setStatus('error')
      onErrorRef.current?.('Could not connect to Timy.')
      micStream.getTracks().forEach((t) => t.stop())
      return
    }
    wsRef.current = ws

    ws.onopen = async () => {
      // Set up capture path. We lazy-create the AudioContext here because some
      // browsers (Safari, older Chrome on iOS) require a user gesture first,
      // and the click that called start() satisfies that.
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = audioCtx
      // Chrome auto-suspends new AudioContexts; resume explicitly so the
      // ScriptProcessorNode actually fires onaudioprocess events.
      try { await audioCtx.resume() } catch {}
      const sampleRate = audioCtx.sampleRate

      const source = audioCtx.createMediaStreamSource(micStream)
      sourceNodeRef.current = source

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      inputAnalyserRef.current = analyser

      // ScriptProcessorNode is deprecated but ubiquitous. AudioWorklet would
      // need a separate JS module path which complicates Vite setup. For
      // speech-grade audio with a 16k target, this is fine.
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (event) => {
        if (mutedRef.current) return
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const channel = event.inputBuffer.getChannelData(0)
        const resampled = resampleFloat32(channel, sampleRate, TARGET_INPUT_RATE)
        const int16 = floatTo16BitPCM(resampled)
        const data = int16ToBase64(int16)
        try {
          wsRef.current.send(JSON.stringify({ type: 'audio', data }))
        } catch {
          // Silently drop — connection will close shortly anyway.
        }
      }
      source.connect(processor)
      // ScriptProcessorNode needs to be connected to the destination to fire
      // events on Chromium. We mute it via a zero-gain node so no echo.
      const sink = audioCtx.createGain()
      sink.gain.value = 0
      processor.connect(sink)
      sink.connect(audioCtx.destination)

      // Output context for playback.
      const playbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PLAYBACK_RATE,
      })
      playbackCtxRef.current = playbackCtx
      try { await playbackCtx.resume() } catch {}
      playbackQueueRef.current.at = playbackCtx.currentTime + 0.1

      const outAnalyser = playbackCtx.createAnalyser()
      outAnalyser.fftSize = 256
      outputAnalyserRef.current = outAnalyser
      outAnalyser.connect(playbackCtx.destination)

      const tickLevels = () => {
        const inAnal = inputAnalyserRef.current
        const outAnal = outputAnalyserRef.current
        if (inAnal) {
          const buf = new Uint8Array(inAnal.frequencyBinCount)
          inAnal.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128
            sum += v * v
          }
          setInputLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2))
        }
        if (outAnal) {
          const buf = new Uint8Array(outAnal.frequencyBinCount)
          outAnal.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128
            sum += v * v
          }
          setOutputLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2))
        }
        rafRef.current = requestAnimationFrame(tickLevels)
      }
      rafRef.current = requestAnimationFrame(tickLevels)
    }

    ws.onmessage = (event) => {
      let msg: any
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      // eslint-disable-next-line no-console
      console.debug('[Timy] message', msg.type, msg)

      if (msg.type === 'ready') return
      if (msg.type === 'setupComplete') {
        setStatus('listening')
        return
      }
      if (msg.type === 'error') {
        setStatus('error')
        onErrorRef.current?.(msg.message || 'Timy hit an error.')
        return
      }
      if (msg.type === 'upstream_closed') {
        flushAssistant()
        // Don't overwrite an existing 'error' status — the error message has
        // more detail than a bland "closed".
        setStatus((prev) => (prev === 'error' ? prev : 'closed'))
        return
      }
      if (msg.type === 'toolCall') {
        setActiveTool(msg.name)
        appendEntry('tool', `Looking up ${prettyToolName(msg.name)}…`)
        return
      }
      if (msg.type === 'language_switch') {
        const next: TimyLanguage = msg.language === 'hi-IN' ? 'hi-IN' : 'en-IN'
        onLanguageSwitchRef.current?.(next)
        return
      }
      if (msg.type === 'serverContent') {
        handleServerContent(msg.data)
        return
      }
    }

    ws.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.error('[Timy] ws error', e)
      setStatus('error')
      onErrorRef.current?.(
        'Could not reach Timy. Make sure the backend is running and reachable on the same host as VITE_API_URL.'
      )
    }

    ws.onclose = (e) => {
      // eslint-disable-next-line no-console
      console.warn('[Timy] ws closed', { code: e.code, reason: e.reason })
      setStatus((prev) => (prev === 'error' ? prev : 'closed'))
    }

    function handleServerContent(content: any) {
      // Input transcription from the user's mic
      if (content?.inputTranscription?.text) {
        userBufferRef.current += content.inputTranscription.text
      }
      // Output transcription of Timy's spoken reply
      if (content?.outputTranscription?.text) {
        assistantBufferRef.current += content.outputTranscription.text
      }

      const parts: any[] = content?.modelTurn?.parts || []
      for (const part of parts) {
        if (part?.text) {
          assistantBufferRef.current += part.text
        }
        const inline = part?.inlineData
        if (inline?.mimeType?.startsWith('audio/') && inline.data) {
          enqueueAudio(inline.data)
          setStatus((prev) => (prev === 'thinking' ? 'speaking' : prev === 'listening' ? 'speaking' : prev))
        }
      }

      if (content?.turnComplete) {
        flushUser()
        flushAssistant()
        setActiveTool(null)
        setStatus((prev) =>
          prev === 'speaking' || prev === 'thinking' ? 'listening' : prev
        )
      }
      if (content?.interrupted) {
        playbackQueueRef.current.at = playbackCtxRef.current?.currentTime || 0
      }
    }

    function enqueueAudio(b64: string) {
      const ctx = playbackCtxRef.current
      const out = outputAnalyserRef.current
      if (!ctx || !out) return
      const pcm = base64ToInt16(b64)
      const float = int16ToFloat32(pcm)
      const buffer = ctx.createBuffer(1, float.length, PLAYBACK_RATE)
      // Use getChannelData().set() rather than copyToChannel() to side-step
      // TS's complaint about Float32Array<ArrayBufferLike> vs <ArrayBuffer>.
      buffer.getChannelData(0).set(float)
      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.connect(out)
      const startAt = Math.max(playbackQueueRef.current.at, ctx.currentTime + 0.02)
      node.start(startAt)
      playbackQueueRef.current.at = startAt + buffer.duration
    }
  }, [appendEntry, flushAssistant, flushUser, status])

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    appendEntry('user', text)
    try {
      ws.send(JSON.stringify({ type: 'text', data: text }))
      setStatus('thinking')
    } catch {
      /* ignore */
    }
  }, [appendEntry])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  useEffect(() => () => stop(), [stop])

  return {
    status,
    transcript,
    activeTool,
    muted,
    inputLevel,
    outputLevel,
    start,
    stop,
    sendText,
    toggleMute,
  }
}

const prettyToolName = (raw: string): string => {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

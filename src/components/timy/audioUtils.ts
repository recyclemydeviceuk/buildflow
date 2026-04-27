/**
 * Tiny audio helpers for Timy AI.
 *
 * Gemini Live wants:
 *   in:  16-bit signed PCM, little-endian, mono, 16 kHz
 *   out: 16-bit signed PCM, little-endian, mono, 24 kHz
 *
 * Browsers capture at 44.1 / 48 kHz Float32, so we have to:
 *   1. downmix to mono
 *   2. resample to 16 kHz with linear interpolation (good enough for speech)
 *   3. convert Float32 [-1,1] → Int16
 *   4. base64-encode for JSON transport
 */

export const floatTo16BitPCM = (input: Float32Array): Int16Array => {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/**
 * Linear-interpolation resampler. Speech-quality, no extra deps.
 */
export const resampleFloat32 = (
  input: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array => {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const newLen = Math.floor(input.length / ratio)
  const out = new Float32Array(newLen)
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, input.length - 1)
    const t = srcIdx - lo
    out[i] = input[lo] * (1 - t) + input[hi] * t
  }
  return out
}

export const int16ToBase64 = (pcm: Int16Array): string => {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  // chunk to avoid blowing the stack on long arrays
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any)
  }
  return btoa(binary)
}

export const base64ToInt16 = (b64: string): Int16Array => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  // Copy into a fresh aligned ArrayBuffer because the bytes view may not be
  // 2-byte-aligned.
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

export const int16ToFloat32 = (pcm: Int16Array): Float32Array => {
  const out = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff)
  return out
}

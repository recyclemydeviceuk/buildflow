const DEFAULT_COUNTRY_CODE = '91'

export const sanitizePhoneForWhatsApp = (phone: string | null | undefined): string | null => {
  if (!phone) return null

  const trimmed = phone.trim()
  if (!trimmed) return null

  const hasPlusPrefix = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (hasPlusPrefix) return digits

  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`

  if (digits.length === 11 && digits.startsWith('0')) {
    return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`
  }

  return digits
}

export const buildWhatsAppUrl = (phone: string | null | undefined, message?: string): string | null => {
  const number = sanitizePhoneForWhatsApp(phone)
  if (!number) return null

  const base = `https://wa.me/${number}`
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`
  }
  return base
}

export const openWhatsAppChat = (phone: string | null | undefined, message?: string): boolean => {
  const url = buildWhatsAppUrl(phone, message)
  if (!url) return false

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }
  return false
}

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Globe, Phone, Facebook, Search, Instagram, MessageCircle, Loader2 } from 'lucide-react'
import { integrationsAPI, type Integration } from '../api/integrations'

type IntegrationCard = {
  key: string
  name: string
  description: string
  icon: typeof Globe
  accent: string
  gradient: string
  isConnected: (list: Integration[]) => boolean
}

const CARDS: IntegrationCard[] = [
  {
    key: 'website',
    name: 'Website',
    description: 'Direct form submissions',
    icon: Globe,
    accent: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    isConnected: () => true,
  },
  {
    key: 'exotel',
    name: 'Exotel',
    description: 'Calls & SMS',
    icon: Phone,
    accent: '#7C3AED',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    isConnected: () => true,
  },
  {
    key: 'meta',
    name: 'Meta',
    description: 'Facebook Lead Ads',
    icon: Facebook,
    accent: '#1877F2',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    isConnected: (list) =>
      list.some((i) => i.provider.toLowerCase() === 'meta' && i.status === 'connected'),
  },
  {
    key: 'instagram',
    name: 'Instagram',
    description: 'Instagram Lead Ads',
    icon: Instagram,
    accent: '#E1306C',
    gradient: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
    isConnected: (list) =>
      list.some(
        (i) =>
          (i.provider.toLowerCase() === 'instagram' || i.provider.toLowerCase() === 'meta') &&
          i.status === 'connected'
      ),
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp Business leads',
    icon: MessageCircle,
    accent: '#25D366',
    gradient: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
    isConnected: (list) =>
      list.some((i) => i.provider.toLowerCase() === 'whatsapp' && i.status === 'connected'),
  },
  {
    key: 'google-ads',
    name: 'Google Ads',
    description: 'Google Lead Form extensions',
    icon: Search,
    accent: '#EA4335',
    gradient: 'linear-gradient(135deg, #EA4335 0%, #C5221F 100%)',
    isConnected: (list) =>
      list.some(
        (i) =>
          (i.provider.toLowerCase() === 'google' || i.provider.toLowerCase() === 'google-ads') &&
          i.status === 'connected'
      ),
  },
]

export default function IntegrationsConnected() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await integrationsAPI.getIntegrations()
      if (res.success) setIntegrations(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const cards = useMemo(
    () =>
      CARDS.map((card) => ({
        ...card,
        connected: card.isConnected(integrations),
      })),
    [integrations]
  )

  const workingCount = cards.filter((c) => c.connected).length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-lg font-extrabold text-[#0F172A] tracking-tight">Integrations</h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {workingCount} of {cards.length} working
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
            <CheckCircle2 size={14} className="text-[#16A34A]" />
            <span className="text-sm font-bold text-[#16A34A]">{workingCount} working</span>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#94A3B8]">
            <Loader2 size={16} className="animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.key}
                  className="group relative bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* Top accent strip */}
                  <div
                    className="h-1.5 w-full"
                    style={{ background: card.connected ? card.gradient : '#E2E8F0' }}
                  />

                  <div className="p-6">
                    {/* Icon + name + description */}
                    <div className="flex items-start gap-4 mb-5">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                        style={{
                          background: card.connected ? card.gradient : '#F1F5F9',
                        }}
                      >
                        <Icon
                          size={24}
                          style={{ color: card.connected ? 'white' : '#94A3B8' }}
                          strokeWidth={2.2}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-extrabold text-[#0F172A] leading-tight">{card.name}</p>
                        <p className="text-xs text-[#64748B] mt-1">{card.description}</p>
                      </div>
                    </div>

                    {/* Status pill — full width, bold */}
                    {card.connected ? (
                      <div className="inline-flex items-center gap-2 w-full justify-center px-3 py-2 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                        <span className="relative flex w-2.5 h-2.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-60 animate-ping" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16A34A]" />
                        </span>
                        <span className="text-xs font-bold text-[#16A34A] uppercase tracking-wide">Working</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 w-full justify-center px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                        <span className="inline-flex rounded-full h-2.5 w-2.5 bg-[#94A3B8]" />
                        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Not Connected</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

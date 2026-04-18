import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Globe, Phone, Facebook, Search, Loader2 } from 'lucide-react'
import { integrationsAPI, type Integration } from '../api/integrations'

type IntegrationCard = {
  key: string
  name: string
  icon: typeof Globe
  accent: string
  isConnected: (list: Integration[]) => boolean
}

const CARDS: IntegrationCard[] = [
  {
    key: 'website',
    name: 'Website',
    icon: Globe,
    accent: '#0EA5E9',
    // Website is a public webhook endpoint — no auth or integration record needed.
    isConnected: () => true,
  },
  {
    key: 'exotel',
    name: 'Exotel',
    icon: Phone,
    accent: '#7C3AED',
    // Exotel is configured via environment variables on the server — always active.
    isConnected: () => true,
  },
  {
    key: 'meta',
    name: 'Meta',
    icon: Facebook,
    accent: '#1877F2',
    isConnected: (list) =>
      list.some((i) => i.provider.toLowerCase() === 'meta' && i.status === 'connected'),
  },
  {
    key: 'google-ads',
    name: 'Google Ads',
    icon: Search,
    accent: '#EA4335',
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
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">Integrations</h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              {workingCount} of {cards.length} working
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
            <CheckCircle2 size={12} className="text-[#16A34A]" />
            <span className="text-xs font-bold text-[#16A34A]">{workingCount} working</span>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#94A3B8]">
            <Loader2 size={16} className="animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.key}
                  className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="h-1 w-full" style={{ background: card.connected ? card.accent : '#E2E8F0' }} />
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${card.accent}14` }}
                      >
                        <Icon size={18} style={{ color: card.accent }} />
                      </div>
                      <p className="text-sm font-extrabold text-[#0F172A]">{card.name}</p>
                    </div>

                    {/* Status pill */}
                    {card.connected ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0]">
                        <span className="relative flex w-2 h-2">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-60 animate-ping" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]" />
                        </span>
                        <span className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wide">Working</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
                        <span className="inline-flex rounded-full h-2 w-2 bg-[#94A3B8]" />
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">Not Connected</span>
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

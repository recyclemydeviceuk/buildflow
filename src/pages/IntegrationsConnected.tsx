import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, Link2, Loader2, Upload, MessageCircle, Zap, Globe, Linkedin } from 'lucide-react'
import { integrationsAPI, type Integration } from '../api/integrations'
import { useNavigate } from 'react-router-dom'

function providerMeta(provider: string) {
  const key = provider.toLowerCase()
  if (key === 'meta') return { title: 'Facebook Lead Ads', icon: Zap, accent: '#1877F2', connectable: true }
  if (key === 'google' || key === 'google-ads') return { title: 'Google Ads', icon: Globe, accent: '#EA4335', connectable: true }
  if (key === 'linkedin') return { title: 'LinkedIn Lead Gen', icon: Linkedin, accent: '#0A66C2', connectable: true }
  if (key === 'whatsapp') return { title: 'WhatsApp Business', icon: MessageCircle, accent: '#25D366', connectable: false }
  if (key === 'exotel') return { title: 'Exotel (Calls)', icon: Link2, accent: '#7C3AED', connectable: false }
  return { title: provider, icon: Link2, accent: '#94A3B8', connectable: false }
}

export default function IntegrationsConnected() {
  const navigate = useNavigate()
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

  const connectedCount = useMemo(() => integrations.filter((i) => i.status === 'connected').length, [integrations])

  const connectByProvider = async (provider: string) => {
    const meta = providerMeta(provider)
    if (!meta.connectable) return

    try {
      if (provider.toLowerCase() === 'meta') {
        const res = await integrationsAPI.getMetaConnectUrl()
        window.location.href = res.data.url
      } else if (provider.toLowerCase() === 'linkedin') {
        const res = await integrationsAPI.getLinkedInConnectUrl()
        window.location.href = res.data.url
      } else if (provider.toLowerCase() === 'google' || provider.toLowerCase() === 'google-ads') {
        const res = await integrationsAPI.getGoogleAdsConnectUrl()
        window.location.href = res.data.url
      }
    } catch (err) {
      console.error('Connect failed:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-[#0F172A] tracking-tight">Integrations</h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Connect lead sources to BuildFlow · {connectedCount} of {integrations.length} connected
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
            <CheckCircle2 size={12} className="text-[#16A34A]" />
            <span className="text-xs font-bold text-[#16A34A]">{connectedCount} connected</span>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] shadow-sm transition-colors"
          >
            <Loader2 size={13} className={loading ? 'animate-spin' : undefined} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/lead-import')}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload size={12} /> Import CSV
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#94A3B8]">Loading integrations...</div>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
            <p className="text-sm font-semibold">No integrations found yet.</p>
            <p className="text-xs mt-1">Connect Meta/LinkedIn/Google Ads to start syncing leads.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {integrations.map((conn) => {
              const meta = providerMeta(conn.provider)
              const Icon = meta.icon
              const connected = conn.status === 'connected'
              return (
                <div key={conn._id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="h-1 w-full" style={{ background: connected ? meta.accent : '#E2E8F0' }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${meta.accent}14` }}>
                          <Icon size={16} style={{ color: meta.accent }} />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-[#0F172A]">{meta.title}</p>
                          <p className="text-[9px] text-[#94A3B8] font-semibold uppercase tracking-wider mt-0.5">
                            {connected ? 'Connected' : conn.status === 'disconnected' ? 'Disconnected' : conn.status}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {conn.externalAccountName && (
                          <p className="text-xs text-[#475569] font-semibold">{conn.externalAccountName}</p>
                        )}
                        {conn.connectedAt && connected && (
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">
                            Since {new Date(conn.connectedAt).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!connected ? (
                        <button
                          disabled={!meta.connectable}
                          onClick={() => connectByProvider(conn.provider)}
                          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold transition-colors ${
                            meta.connectable
                              ? 'bg-[#1D4ED8] text-white hover:bg-blue-700'
                              : 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed'
                          }`}
                        >
                          <ExternalLink size={11} />
                          Connect
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              await integrationsAPI.disconnectIntegration(conn._id)
                              await refresh()
                            } catch (err) {
                              console.error('Disconnect failed:', err)
                            }
                          }}
                          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] hover:bg-red-100 transition-colors"
                        >
                          Disconnect
                        </button>
                      )}
                      {!connected && !meta.connectable && (
                        <span className="text-[10px] text-[#94A3B8]">Connect via webhook/config</span>
                      )}
                    </div>
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


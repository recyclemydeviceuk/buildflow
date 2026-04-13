import { useState, useEffect } from 'react'
import { Phone, MapPin, X, Check, SkipForward, Zap, Building2, DollarSign } from 'lucide-react'

interface IncomingLead {
  id: string
  name: string
  phone: string
  city: string
  source: string
  campaign: string
  budget: string
  plotOwned: boolean
}

interface Props {
  lead: IncomingLead
  onAccept: () => void
  onSkip: () => void
  onClose: () => void
  timeoutSeconds?: number
}

export default function IncomingLeadModal({ lead, onAccept, onSkip, onClose, timeoutSeconds = 30 }: Props) {
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds)
  const [accepted, setAccepted] = useState(false)
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    if (accepted || skipped) return
    if (timeLeft <= 0) {
      onSkip()
      return
    }
    const t = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, accepted, skipped])

  const progressPct = ((timeoutSeconds - timeLeft) / timeoutSeconds) * 100
  const isUrgent = timeLeft <= 10

  const handleAccept = () => {
    setAccepted(true)
    setTimeout(onAccept, 600)
  }

  const handleSkip = () => {
    setSkipped(true)
    setTimeout(onSkip, 400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0F172A]/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden animate-slide-up"
        style={{
          boxShadow: '0 32px 80px -8px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
          border: isUrgent ? '2px solid #DC2626' : '2px solid #1D4ED8',
          transition: 'border-color 0.5s ease',
        }}
      >
        {/* Countdown timer bar */}
        <div className="h-1.5 bg-[#E2E8F0] relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${100 - progressPct}%`,
              background: isUrgent
                ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                : 'linear-gradient(90deg, #1D4ED8, #3B82F6)',
            }}
          />
        </div>

        {/* Gradient header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between"
          style={{ background: isUrgent ? 'linear-gradient(120deg, #FEF2F2, #fff)' : 'linear-gradient(120deg, #EFF6FF, #fff)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* Pulse ring */}
              <span className={`absolute inset-0 rounded-xl animate-ping opacity-30 ${isUrgent ? 'bg-[#DC2626]' : 'bg-[#1D4ED8]'}`} />
              <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${isUrgent ? 'bg-[#FEF2F2]' : 'bg-[#EFF6FF]'}`}>
                <Zap size={18} className={isUrgent ? 'text-[#DC2626]' : 'text-[#1D4ED8]'} fill="currentColor" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: isUrgent ? '#DC2626' : '#1D4ED8' }}>
                New Lead Available
              </p>
              <p className="text-sm font-semibold text-[#0F172A]">{lead.source} · {lead.campaign}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Lead info card */}
        <div className="px-6 pb-5">
          <div className="bg-[#F8FAFC] rounded-2xl p-4 mb-4 border border-[#F1F5F9]">
            <div className="flex items-center gap-3 mb-4">
              {/* Avatar with pulse ring */}
              <div className="relative shrink-0">
                <span className="absolute -inset-1 rounded-full bg-[#1D4ED8] opacity-20 animate-ping" />
                <div className="relative w-13 h-13 rounded-2xl flex items-center justify-center text-white text-base font-extrabold"
                  style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)' }}>
                  {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              </div>
              <div>
                <p className="text-lg font-extrabold text-[#0F172A] tracking-tight">{lead.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone size={11} className="text-[#94A3B8]" />
                  <p className="text-sm text-[#475569] font-medium">{lead.phone}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: MapPin, label: 'City', value: lead.city },
                { Icon: DollarSign, label: 'Budget', value: lead.budget },
                { Icon: Building2, label: 'Plot', value: lead.plotOwned ? 'Owned' : 'No Plot' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-2.5 border border-[#F1F5F9]">
                  <item.Icon size={11} className="text-[#CBD5E1] mb-1" />
                  <p className="text-[9px] text-[#94A3B8] font-semibold uppercase tracking-wider">{item.label}</p>
                  <p className="text-xs font-bold text-[#0F172A] mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timer pill */}
          <div className="flex items-center justify-center mb-4">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${
              isUrgent
                ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-[#DC2626] animate-pulse' : 'bg-[#1D4ED8]'}`} />
              {accepted ? 'Lead accepted!' : skipped ? 'Passing...' : `Auto-passes in ${timeLeft}s`}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSkip}
              disabled={accepted || skipped}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-[#475569] border-2 border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all disabled:opacity-40"
            >
              <SkipForward size={15} />
              Skip
            </button>
            <button
              onClick={handleAccept}
              disabled={accepted || skipped}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-extrabold text-white transition-all disabled:opacity-70 hover:-translate-y-0.5"
              style={{
                background: accepted ? '#16A34A' : 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
                boxShadow: '0 4px 12px rgba(29,78,216,0.35)',
              }}
            >
              <Check size={15} />
              {accepted ? 'Accepted!' : 'Accept Lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

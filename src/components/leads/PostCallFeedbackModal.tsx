import { useState } from 'react'
import { X, CheckCircle2, PhoneOff, Voicemail, Clock, AlertCircle, ChevronRight, Calendar } from 'lucide-react'
import type { CallOutcome } from '../../data/mockData'

type CallDisposition =
  | 'New'
  | 'Contacted/Open'
  | 'Qualified'
  | 'Visit Done'
  | 'Meeting Done'
  | 'Negotiation Done'
  | 'Booking Done'
  | 'Agreement Done'
  | 'Failed'

interface PostCallFeedbackModalProps {
  leadName: string
  onSubmit: (data: {
    outcome: CallOutcome
    stage: CallDisposition
    notes: string
    followUpAt: string | null
  }) => void
  onClose: () => void
}

const outcomes: { value: CallOutcome; label: string; icon: typeof CheckCircle2; color: string; bg: string }[] = [
  { value: 'Connected', label: 'Connected', icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
  { value: 'No Answer', label: 'No Answer', icon: PhoneOff, color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'Callback Requested', label: 'Callback', icon: Clock, color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'Voicemail', label: 'Voicemail', icon: Voicemail, color: '#64748B', bg: '#F8FAFC' },
  { value: 'Wrong Number', label: 'Wrong Number', icon: AlertCircle, color: '#DC2626', bg: '#FEF2F2' },
]

const stages: { value: CallDisposition; label: string; desc: string }[] = [
  { value: 'Contacted/Open', label: 'Contacted / Open', desc: 'Conversation happened and contact was established' },
  { value: 'Qualified', label: 'Qualified', desc: 'Lead shows clear buying intent or fit' },
  { value: 'Visit Done', label: 'Visit Done', desc: 'Site visit has been completed' },
  { value: 'Meeting Done', label: 'Meeting Done', desc: 'Meeting conducted — VC or at client place' },
  { value: 'Negotiation Done', label: 'Negotiation Done', desc: 'Negotiation on terms or pricing is complete' },
  { value: 'Booking Done', label: 'Booking Done', desc: 'Booking has been confirmed' },
  { value: 'Agreement Done', label: 'Agreement Done', desc: 'Agreement has been signed and deal closed' },
  { value: 'Failed', label: 'Failed', desc: 'Opportunity closed without conversion' },
  { value: 'New', label: 'Keep as New', desc: 'Do not advance the stage yet' },
]

export default function PostCallFeedbackModal({ leadName, onSubmit, onClose }: PostCallFeedbackModalProps) {
  const [outcome, setOutcome] = useState<CallOutcome>('Connected')
  const [stage, setStage] = useState<CallDisposition>('Contacted/Open')
  const [notes, setNotes] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [needsFollowUp, setNeedsFollowUp] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      outcome,
      stage,
      notes,
      followUpAt: needsFollowUp && followUpAt ? followUpAt : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F172A] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Call Feedback</h2>
            <p className="text-[#94A3B8] text-sm">{leadName}</p>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Outcome */}
          <div>
            <label className="text-sm font-bold text-[#0F172A] mb-3 block">Call Outcome</label>
            <div className="grid grid-cols-3 gap-2">
              {outcomes.map((o) => {
                const Icon = o.icon
                const isSelected = outcome === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                        : 'border-[#E2E8F0] hover:border-[#BFDBFE] bg-white'
                    }`}
                  >
                    <Icon size={18} style={{ color: isSelected ? '#1D4ED8' : o.color }} />
                    <span className={`text-xs font-semibold ${isSelected ? 'text-[#1D4ED8]' : 'text-[#475569]'}`}>
                      {o.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Call Stage */}
          <div>
            <label className="text-sm font-bold text-[#0F172A] mb-3 block">Call Stage</label>
            <div className="space-y-2">
              {stages.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(s.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    stage === s.value
                      ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                      : 'border-[#E2E8F0] hover:border-[#BFDBFE] bg-white'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      stage === s.value ? 'border-[#1D4ED8]' : 'border-[#CBD5E1]'
                    }`}
                  >
                    {stage === s.value && <div className="w-2 h-2 rounded-full bg-[#1D4ED8]" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${stage === s.value ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>
                      {s.label}
                    </p>
                    <p className="text-xs text-[#94A3B8]">{s.desc}</p>
                  </div>
                  {stage === s.value && <ChevronRight size={16} className="text-[#1D4ED8]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-bold text-[#0F172A] mb-2 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you discuss? Any important details..."
              rows={3}
              className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] resize-none"
            />
          </div>

          {/* Follow-up */}
          <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0]">
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={needsFollowUp}
                onChange={(e) => setNeedsFollowUp(e.target.checked)}
                className="w-4 h-4 rounded border-[#CBD5E1] text-[#1D4ED8] focus:ring-[#1D4ED8]"
              />
              <span className="text-sm font-semibold text-[#0F172A]">Schedule Follow-up</span>
            </label>
            {needsFollowUp && (
              <div className="flex items-center gap-2 pl-7">
                <Calendar size={16} className="text-[#94A3B8]" />
                <input
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            >
              Skip
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-[#1D4ED8] text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
            >
              Save Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

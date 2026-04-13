import { useMemo, useState } from 'react'
import { CalendarClock, Clock3, Flag, Phone, StickyNote, X } from 'lucide-react'
import type { ReminderPriority } from '../../api/reminders'

interface CallReminderModalProps {
  leadName: string
  phone?: string | null
  contextLabel?: string | null
  defaultTitle?: string
  onClose: () => void
  onSubmit: (payload: { title: string; dueAt: string; notes?: string | null; priority: ReminderPriority }) => Promise<void> | void
}

const toDateTimeLocalValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const getDefaultDueAt = () => {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
  return toDateTimeLocalValue(date)
}

export default function CallReminderModal({
  leadName,
  phone,
  contextLabel,
  defaultTitle = 'Call follow-up',
  onClose,
  onSubmit,
}: CallReminderModalProps) {
  const [title, setTitle] = useState(defaultTitle)
  const [dueAt, setDueAt] = useState(getDefaultDueAt)
  const [priority, setPriority] = useState<ReminderPriority>('medium')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const contextText = useMemo(() => {
    const items = [phone, contextLabel].filter(Boolean)
    return items.join(' • ')
  }, [contextLabel, phone])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[28px] border border-[#DBEAFE] bg-white shadow-[0_30px_100px_-28px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-6 py-5 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1D4ED8]">
              <CalendarClock size={13} />
              Set Reminder
            </div>
            <h2 className="mt-3 text-xl font-bold text-[#0F172A] truncate">{leadName}</h2>
            {contextText ? (
              <p className="mt-1 text-sm text-[#64748B]">{contextText}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (!title.trim() || !dueAt) return

            try {
              setSaving(true)
              await onSubmit({
                title: title.trim(),
                dueAt: new Date(dueAt).toISOString(),
                notes: notes.trim() || null,
                priority,
              })
            } finally {
              setSaving(false)
            }
          }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
              <Phone size={13} />
              Reminder Title
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Call follow-up"
              className="w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              required
            />
          </div>

          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
            <div>
              <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                <Clock3 size={13} />
                Due At
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                required
              />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                <Flag size={13} />
                Priority
              </label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as ReminderPriority)}
                className="w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
              <StickyNote size={13} />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Add context for the callback, outcome, or next action."
              className="w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-[#1D4ED8] text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

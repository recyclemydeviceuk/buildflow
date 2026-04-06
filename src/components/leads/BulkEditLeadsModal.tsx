import { useMemo, useState } from 'react'
import { X, Save, Users } from 'lucide-react'
import type { BulkUpdateLeadsPayload } from '../../api/leads'
import type { RepresentativePickerOption } from './RepresentativePicker'

interface BulkEditLeadsModalProps {
  allowUnassigned: boolean
  canAssignOwner: boolean
  dispositions: string[]
  onClose: () => void
  onSubmit: (payload: Omit<BulkUpdateLeadsPayload, 'ids'>) => Promise<void> | void
  representatives: RepresentativePickerOption[]
  selectedCount: number
  sources: string[]
}

const fieldLabelClass = 'block text-[11px] font-semibold text-[#334155] mb-1'
const inputClass =
  'w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]'

export default function BulkEditLeadsModal({
  allowUnassigned,
  canAssignOwner,
  dispositions,
  onClose,
  onSubmit,
  representatives,
  selectedCount,
  sources,
}: BulkEditLeadsModalProps) {
  const [source, setSource] = useState('')
  const [disposition, setDisposition] = useState('')
  const [owner, setOwner] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasChanges = useMemo(
    () => Boolean(source || disposition || createdAt || (canAssignOwner && owner !== '')),
    [canAssignOwner, createdAt, disposition, owner, source]
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!hasChanges) {
      setError('Choose at least one bulk edit action.')
      return
    }

    if (disposition && !statusNote.trim()) {
      setError('A note is required when changing the lead status.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload: Omit<BulkUpdateLeadsPayload, 'ids'> = {}

      if (source) {
        payload.source = source
      }

      if (disposition) {
        payload.disposition = disposition
        payload.statusNote = statusNote.trim()
      }

      if (canAssignOwner && owner !== '') {
        payload.owner = owner === 'unassigned' ? null : owner
      }

      if (createdAt) {
        payload.createdAt = new Date(createdAt).toISOString()
      }

      await onSubmit(payload)
    } catch (submitError: any) {
      setError(submitError?.response?.data?.message || 'Failed to update selected leads.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
              <Users size={18} className="text-[#1D4ED8]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Bulk Edit Leads</h2>
              <p className="text-xs text-[#64748B]">Apply one or more updates to {selectedCount} selected lead{selectedCount > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-colors"
          >
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={fieldLabelClass}>Source</label>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className={inputClass}
              >
                <option value="">No change</option>
                {sources.map((sourceOption) => (
                  <option key={sourceOption} value={sourceOption}>
                    {sourceOption}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={fieldLabelClass}>Status</label>
              <select
                value={disposition}
                onChange={(event) => setDisposition(event.target.value)}
                className={inputClass}
              >
                <option value="">No change</option>
                {dispositions.map((dispositionOption) => (
                  <option key={dispositionOption} value={dispositionOption}>
                    {dispositionOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canAssignOwner ? (
            <div>
              <label className={fieldLabelClass}>Assign Representative</label>
              <select
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                className={inputClass}
              >
                <option value="">No change</option>
                {allowUnassigned ? <option value="unassigned">Unassigned</option> : null}
                {representatives.map((representative) => (
                  <option key={representative.id} value={representative.id}>
                    {representative.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className={fieldLabelClass}>Created At</label>
            <input
              type="datetime-local"
              value={createdAt}
              onChange={(event) => setCreatedAt(event.target.value)}
              step={60}
              className={inputClass}
            />
            <p className="mt-1 px-1 text-[11px] text-[#64748B]">Leave blank for no change. This uses your local date and time.</p>
          </div>

          {disposition ? (
            <div>
              <label className={fieldLabelClass}>Status Note</label>
              <textarea
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                rows={3}
                placeholder={`Add a note for changing selected leads to ${disposition}...`}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] placeholder-[#94A3B8] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
              <p className="text-sm text-[#B91C1C]">{error}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges || Boolean(disposition && !statusNote.trim())}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              {saving ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

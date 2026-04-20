import { useEffect, useRef, useState } from 'react'
import { GripVertical, Eye, EyeOff, RotateCcw, X, Columns3 } from 'lucide-react'

export type LeadColumnKey =
  | 'lead'
  | 'source'
  | 'city'
  | 'owner'
  | 'disposition'
  | 'followup'
  | 'date'
  | 'actions'

export type LeadColumnConfig = {
  key: LeadColumnKey
  visible: boolean
}

export const LEAD_COLUMN_LABELS: Record<LeadColumnKey, string> = {
  lead: 'Lead',
  source: 'Source',
  city: 'City',
  owner: 'Owner',
  disposition: 'Disposition',
  followup: 'Follow Up',
  date: 'Date',
  actions: 'Actions',
}

export const DEFAULT_LEAD_COLUMNS: LeadColumnConfig[] = [
  { key: 'lead', visible: true },
  { key: 'source', visible: true },
  { key: 'city', visible: true },
  { key: 'owner', visible: true },
  { key: 'disposition', visible: true },
  { key: 'followup', visible: true },
  { key: 'date', visible: true },
  { key: 'actions', visible: true },
]

const STORAGE_KEY = 'buildflow:lead-list-columns'

export function loadLeadColumnConfig(): LeadColumnConfig[] {
  if (typeof window === 'undefined') return DEFAULT_LEAD_COLUMNS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LEAD_COLUMNS
    const parsed = JSON.parse(raw) as LeadColumnConfig[]
    if (!Array.isArray(parsed)) return DEFAULT_LEAD_COLUMNS

    // Merge with defaults so any column the user hasn't seen yet (e.g. newly
    // added in a future release) is appended in its default position rather
    // than silently lost.
    const known = new Set(parsed.map((c) => c.key))
    const merged: LeadColumnConfig[] = parsed.filter((c) =>
      (DEFAULT_LEAD_COLUMNS as LeadColumnConfig[]).some((d) => d.key === c.key)
    )
    for (const def of DEFAULT_LEAD_COLUMNS) {
      if (!known.has(def.key)) merged.push({ ...def })
    }
    return merged
  } catch {
    return DEFAULT_LEAD_COLUMNS
  }
}

export function saveLeadColumnConfig(config: LeadColumnConfig[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // silently ignore — storage quota, private mode, etc.
  }
}

interface LeadColumnManagerProps {
  value: LeadColumnConfig[]
  onChange: (next: LeadColumnConfig[]) => void
}

/**
 * Popover dropdown that lets the user reorder columns via drag-and-drop and
 * toggle visibility. Uses native HTML5 drag-and-drop (no library).
 */
export default function LeadColumnManager({ value, onChange }: LeadColumnManagerProps) {
  const [open, setOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const toggleVisible = (key: LeadColumnKey) => {
    onChange(value.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))
  }

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return
    const next = value.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const resetDefaults = () => {
    onChange(DEFAULT_LEAD_COLUMNS.map((c) => ({ ...c })))
  }

  const visibleCount = value.filter((c) => c.visible).length

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Manage columns"
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[10px] font-bold transition-colors ${
          open
            ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
            : 'bg-white border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]'
        }`}
      >
        <Columns3 size={11} />
        Columns
        <span
          className={`ml-0.5 px-1 py-0 rounded-full text-[9px] font-bold ${
            open ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
          }`}
        >
          {visibleCount}
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[280px] bg-white border border-[#E2E8F0] rounded-xl shadow-[0_12px_32px_-8px_rgba(15,23,42,0.2)] z-50 overflow-hidden"
        >
          <div className="px-3.5 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold text-[#0F172A]">Manage Columns</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Drag to reorder · click the eye to show/hide</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569] transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-1.5 max-h-[340px] overflow-y-auto">
            {value.map((col, index) => {
              const isDragging = dragIndex === index
              const isDragOver = dragOverIndex === index && dragIndex !== index
              return (
                <div
                  key={col.key}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(index)
                    e.dataTransfer.effectAllowed = 'move'
                    // Firefox requires setData to initiate drag
                    try { e.dataTransfer.setData('text/plain', String(index)) } catch {}
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverIndex !== index) setDragOverIndex(index)
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === index) setDragOverIndex(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndex !== null) reorder(dragIndex, index)
                    setDragIndex(null)
                    setDragOverIndex(null)
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setDragOverIndex(null)
                  }}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg mb-0.5 last:mb-0 transition-all cursor-grab active:cursor-grabbing select-none ${
                    isDragging
                      ? 'opacity-40 bg-[#EFF6FF]'
                      : isDragOver
                      ? 'bg-[#EFF6FF] ring-1 ring-[#1D4ED8]/30'
                      : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <GripVertical size={13} className="text-[#94A3B8] shrink-0" />
                  <span
                    className={`flex-1 text-xs font-semibold ${
                      col.visible ? 'text-[#0F172A]' : 'text-[#94A3B8] line-through'
                    }`}
                  >
                    {LEAD_COLUMN_LABELS[col.key]}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleVisible(col.key)
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      col.visible
                        ? 'text-[#1D4ED8] hover:bg-[#EFF6FF]'
                        : 'text-[#CBD5E1] hover:bg-[#F1F5F9] hover:text-[#64748B]'
                    }`}
                    title={col.visible ? 'Hide column' : 'Show column'}
                  >
                    {col.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="px-3 py-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2 bg-[#FAFCFF]">
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 px-3 rounded-md bg-[#1D4ED8] text-white text-[10px] font-bold hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

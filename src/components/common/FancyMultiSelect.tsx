import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import type { FancyDropdownOption } from './FancyDropdown'

/**
 * Multi-select sibling of FancyDropdown.
 *
 * Trigger label rules:
 *   - 0 selected → placeholder
 *   - 1 selected → that label
 *   - n selected → first label + "+(n-1)"
 *
 * The panel layout matches FancyDropdown so the two feel identical apart
 * from the checkbox-style rows and the Clear / Select-all controls at top.
 */
type Props = {
  values: string[]
  onChange: (next: string[]) => void
  options: FancyDropdownOption[]
  placeholder: string
  disabled?: boolean
  searchable?: boolean
  minWidth?: number
  panelWidth?: number
  /**
   * If true, hides the "Select all" link in the panel header. Useful when
   * the option set is huge (city / owner) where Select-all is rarely useful.
   */
  hideSelectAll?: boolean
}

export default function FancyMultiSelect({
  values,
  onChange,
  options,
  placeholder,
  disabled = false,
  searchable = true,
  minWidth = 180,
  panelWidth,
  hideSelectAll = false,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight?: number
  }>({ top: 0, left: 0, width: minWidth })

  const valueSet = useMemo(() => new Set(values), [values])

  // Stable, label-aware view of what's selected for the trigger pill.
  const selectedSummary = useMemo(() => {
    if (values.length === 0) return null
    const labels: string[] = []
    for (const v of values) {
      const opt = options.find((o) => o.value === v)
      if (opt) labels.push(opt.label)
    }
    if (labels.length === 0) return null
    if (labels.length === 1) return { primary: labels[0], extra: 0, dotColor: options.find((o) => o.value === values[0])?.dotColor }
    return { primary: labels[0], extra: labels.length - 1, dotColor: options.find((o) => o.value === values[0])?.dotColor }
  }, [values, options])

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description || ''} ${option.badgeLabel || ''}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [options, query])

  const allFilteredSelected =
    filteredOptions.length > 0 && filteredOptions.every((o) => valueSet.has(o.value))

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const estimatedHeight = 420
      const width = Math.max(rect.width, panelWidth || minWidth)
      let left = rect.left
      const margin = 16
      if (left + width > window.innerWidth - margin) left = rect.right - width
      if (left < margin) left = margin
      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        setPanelStyle({ bottom: window.innerHeight - rect.top + 8, left, width, maxHeight: spaceAbove - 24 })
      } else {
        setPanelStyle({ top: rect.bottom + 8, left, width, maxHeight: spaceBelow - 24 })
      }
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('mousedown', handlePointerDown)
    window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open, minWidth, panelWidth])

  const toggleValue = (val: string) => {
    if (valueSet.has(val)) {
      onChange(values.filter((v) => v !== val))
    } else {
      onChange([...values, val])
    }
  }

  const selectAllFiltered = () => {
    const merged = new Set(values)
    for (const o of filteredOptions) merged.add(o.value)
    onChange(Array.from(merged))
  }

  const clearAll = () => onChange([])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((v) => !v) }}
        className={`relative rounded-md border bg-white px-2 py-1.5 text-left transition-colors shadow-sm ${
          disabled
            ? 'cursor-not-allowed opacity-60 border-gray-200'
            : open
              ? 'border-[#3B82F6] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
              : values.length > 0
                ? 'border-[#1D4ED8]/40 bg-[#F8FBFF] hover:border-[#1D4ED8]'
                : 'border-gray-200 hover:border-gray-300'
        }`}
        style={{ minWidth }}
      >
        <div className="flex items-center gap-1.5">
          {selectedSummary?.dotColor ? (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: selectedSummary.dotColor }} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-semibold truncate ${selectedSummary ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>
              {selectedSummary
                ? selectedSummary.extra > 0
                  ? `${selectedSummary.primary} +${selectedSummary.extra}`
                  : selectedSummary.primary
                : placeholder}
            </p>
          </div>
          {values.length > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#1D4ED8] text-white text-[8.5px] font-extrabold tabular-nums shrink-0">
              {values.length}
            </span>
          ) : null}
          <ChevronDown size={12} className={`text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                top: panelStyle.top,
                bottom: panelStyle.bottom,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
              }}
              className="fixed z-[100] flex flex-col rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            >
              {searchable ? (
                <div className="px-2 pt-1.5 pb-1.5 border-b border-gray-200 bg-gradient-to-br from-[#F8FBFF] to-white shrink-0">
                  <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Search ${placeholder.toLowerCase()}`}
                      className="w-full pl-6 pr-2 py-1 rounded-md border border-gray-200 bg-white text-[10px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider">
                      {values.length > 0 ? `${values.length} selected` : 'None selected'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {!hideSelectAll && filteredOptions.length > 0 ? (
                        <button
                          type="button"
                          onClick={selectAllFiltered}
                          disabled={allFilteredSelected}
                          className={`text-[9.5px] font-bold uppercase tracking-wider transition-colors ${
                            allFilteredSelected ? 'text-[#CBD5E1] cursor-not-allowed' : 'text-[#1D4ED8] hover:text-[#1E3A8A]'
                          }`}
                        >
                          Select all
                        </button>
                      ) : null}
                      {values.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearAll}
                          className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#DC2626] hover:text-[#991B1B] transition-colors"
                        >
                          <X size={9} /> Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="overflow-y-auto p-1.5">
                {filteredOptions.length === 0 ? (
                  <div className="px-2 py-4 text-center">
                    <p className="text-[10px] font-semibold text-[#475569]">No matches found</p>
                    <p className="text-[8px] text-[#94A3B8] mt-0.5">Try a different search.</p>
                  </div>
                ) : (
                  filteredOptions.map((option) => {
                    const checked = valueSet.has(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleValue(option.value)}
                        className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                          checked ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {/* Checkbox */}
                          <span
                            className={`relative w-3.5 h-3.5 rounded-[4px] border-[1.5px] shrink-0 transition-all flex items-center justify-center ${
                              checked
                                ? 'bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] border-[#1D4ED8] shadow-[0_1px_3px_rgba(29,78,216,0.3)]'
                                : 'bg-white border-[#CBD5E1]'
                            }`}
                          >
                            {checked ? <Check size={9} strokeWidth={3.5} className="text-white" /> : null}
                          </span>
                          {option.dotColor ? (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: option.dotColor }} />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] font-semibold text-[#0F172A] truncate">{option.label}</p>
                              {option.badgeLabel ? (
                                <span
                                  className="inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-bold shrink-0"
                                  style={{
                                    background: option.badgeBg || '#EFF6FF',
                                    color: option.badgeText || '#1D4ED8',
                                  }}
                                >
                                  {option.badgeLabel}
                                </span>
                              ) : null}
                            </div>
                            {option.description ? (
                              <p className="text-[8px] text-[#94A3B8] truncate">{option.description}</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

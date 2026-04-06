import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

export type FancyDropdownOption = {
  value: string
  label: string
  description?: string
  dotColor?: string
  badgeLabel?: string
  badgeBg?: string
  badgeText?: string
}

type FancyDropdownProps = {
  value: string
  onChange: (value: string) => void
  options: FancyDropdownOption[]
  placeholder: string
  disabled?: boolean
  searchable?: boolean
  minWidth?: number
  panelWidth?: number
}

export default function FancyDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  searchable = true,
  minWidth = 180,
  panelWidth,
}: FancyDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<{ 
    top?: number; 
    bottom?: number; 
    left: number; 
    width: number;
    maxHeight?: number;
  }>({
    top: 0,
    left: 0,
    width: minWidth,
  })

  const selected = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description || ''} ${option.badgeLabel || ''}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [options, query])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const estimatedHeight = 400
      const width = Math.max(rect.width, panelWidth || minWidth)
      
      // Horizontal positioning: align left by default, but shift left if it overflows screen
      let left = rect.left
      const margin = 16 // Margin from screen edge
      if (left + width > window.innerWidth - margin) {
        left = rect.right - width
      }
      if (left < margin) {
        left = margin
      }

      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        // Not enough space below, open upwards
        setPanelStyle({
          bottom: window.innerHeight - rect.top + 8,
          left,
          width,
          maxHeight: spaceAbove - 24
        })
      } else {
        // Open downwards
        setPanelStyle({
          top: rect.bottom + 8,
          left,
          width,
          maxHeight: spaceBelow - 24
        })
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
  }, [open, minWidth])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
        className={`rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left transition-colors shadow-sm ${
          disabled
            ? 'cursor-not-allowed opacity-60'
            : open
              ? 'border-[#3B82F6] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
              : 'hover:border-gray-300'
        }`}
        style={{ minWidth }}
      >
        <div className="flex items-center gap-1.5">
          {selected?.dotColor ? (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: selected.dotColor }} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[#0F172A] truncate">{selected?.label || placeholder}</p>
          </div>
          <ChevronDown
            size={12}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
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
                maxHeight: panelStyle.maxHeight
              }}
              className="fixed z-[100] flex flex-col rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            >
              {searchable ? (
                <div className="px-2 py-1.5 border-b border-gray-200 bg-gradient-to-br from-[#F8FBFF] to-white shrink-0">
                  <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={`Search ${placeholder.toLowerCase()}`}
                      className="w-full pl-6 pr-2 py-1 rounded-md border border-gray-200 bg-white text-[10px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                    />
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
                  filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                        option.value === value ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {option.dotColor ? (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: option.dotColor }} />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#CBD5E1]" />
                        )}
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
                        {option.value === value ? <Check size={12} className="text-[#1D4ED8] shrink-0" /> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, UserRound } from 'lucide-react'

export type RepresentativePickerOption = {
  id: string
  name: string
  phone?: string
  callAvailabilityStatus?: string | null
  activeCallSid?: string | null
}

type RepresentativePickerProps = {
  value: string | null
  onChange: (value: string | null) => void
  options: RepresentativePickerOption[]
  allowUnassigned?: boolean
  disabled?: boolean
  placeholder?: string
  compact?: boolean
}

const statusMeta: Record<string, { label: string; dot: string; chipBg: string; chipText: string }> = {
  available: { label: 'Available', dot: '#16A34A', chipBg: '#F0FDF4', chipText: '#15803D' },
  dialing: { label: 'Dialing', dot: '#D97706', chipBg: '#FFFBEB', chipText: '#B45309' },
  'in-call': { label: 'In Call', dot: '#2563EB', chipBg: '#EFF6FF', chipText: '#1D4ED8' },
  offline: { label: 'Offline', dot: '#94A3B8', chipBg: '#F8FAFC', chipText: '#64748B' },
}

const getRepresentativeStatus = (option?: RepresentativePickerOption | null) => {
  if (!option) return statusMeta.offline
  if (option.callAvailabilityStatus === 'offline') return statusMeta.offline
  if (option.callAvailabilityStatus === 'in-call') return statusMeta['in-call']
  if (option.activeCallSid) return statusMeta.dialing
  return statusMeta.available
}

export default function RepresentativePicker({
  value,
  onChange,
  options,
  allowUnassigned = true,
  disabled = false,
  placeholder = 'Unassigned',
  compact = false,
}: RepresentativePickerProps) {
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
    width: 280,
  })

  const selected = useMemo(
    () => options.find((option) => String(option.id) === String(value || '')) || null,
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => {
      const haystack = `${option.name} ${option.phone || ''}`.toLowerCase()
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
      const width = Math.max(rect.width, 200)

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
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
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
  }, [open])

  const triggerStatus = getRepresentativeStatus(selected)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          if (disabled) return
          setOpen((current) => !current)
        }}
        className={`w-full rounded-md border border-[#D8E1F0] bg-white text-left transition-all ${
          compact ? 'px-1.5 py-1 min-w-[120px]' : 'px-2 py-1.5 min-w-[140px]'
        } ${
          disabled
            ? 'cursor-not-allowed opacity-60'
            : open
              ? 'border-[#3B82F6] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
              : 'hover:border-[#BFDBFE] hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: selected ? triggerStatus.dot : '#CBD5E1' }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[#0F172A] truncate">{selected?.name || placeholder}</p>
            <p className="text-[8px] text-[#94A3B8] truncate">
              {selected ? triggerStatus.label : allowUnassigned ? 'Manager assignment pending' : 'Select representative'}
            </p>
          </div>
          <ChevronDown
            size={12}
            className={`text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
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
              className="fixed z-[100] flex flex-col rounded-lg border border-[#DBE5F3] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] overflow-hidden"
            >
              <div className="px-2.5 py-1.5 border-b border-[#EEF2F7] bg-gradient-to-br from-[#F8FBFF] to-white shrink-0">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search representative"
                    className="w-full pl-7 pr-2 py-1 rounded-md border border-[#E2E8F0] bg-white text-[10px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="overflow-y-auto p-1">
                {allowUnassigned ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full rounded-md px-1.5 py-1.5 text-left transition-colors ${
                      !value ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
                        <UserRound size={11} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-[#0F172A]">Unassigned</p>
                        <p className="text-[8px] text-[#94A3B8]">Stay in manager queue-free pool</p>
                      </div>
                      {!value ? <Check size={12} className="text-[#1D4ED8]" /> : null}
                    </div>
                  </button>
                ) : null}

                {filteredOptions.length === 0 ? (
                  <div className="px-2.5 py-4 text-center">
                    <p className="text-[10px] font-semibold text-[#475569]">No representatives found</p>
                    <p className="text-[8px] text-[#94A3B8] mt-1">Try a different name or phone search.</p>
                  </div>
                ) : (
                  filteredOptions.map((option) => {
                    const status = getRepresentativeStatus(option)
                    const initials = option.name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onChange(option.id)
                          setOpen(false)
                          setQuery('')
                        }}
                        className={`w-full rounded-md px-1.5 py-1.5 text-left transition-colors ${
                          String(value || '') === String(option.id) ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center text-[#1D4ED8] text-[9px] font-bold shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] font-semibold text-[#0F172A] truncate">{option.name}</p>
                              <span
                                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[7px] font-bold shrink-0"
                                style={{ background: status.chipBg, color: status.chipText }}
                              >
                                <span className="w-0.5 h-0.5 rounded-full" style={{ background: status.dot }} />
                                {status.label}
                              </span>
                            </div>
                            <p className="text-[8px] text-[#94A3B8] truncate">{option.phone || 'No phone configured'}</p>
                          </div>
                          {String(value || '') === String(option.id) ? (
                            <Check size={12} className="text-[#1D4ED8] shrink-0" />
                          ) : null}
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

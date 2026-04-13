import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
import { format, addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns'

export interface DateRange {
  from: Date | null
  to: Date | null
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  placeholder?: string
  className?: string
}

const PRESET_RANGES = [
  { 
    label: 'Today', 
    range: { 
      from: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), 
      to: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) 
    } 
  },
  { 
    label: 'Yesterday', 
    range: { 
      from: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1), 
      to: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1) 
    } 
  },
  { 
    label: 'Last 7 days', 
    range: { 
      from: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 7), 
      to: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) 
    } 
  },
  { 
    label: 'Last 30 days', 
    range: { 
      from: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 30), 
      to: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) 
    } 
  },
  { 
    label: 'This Month', 
    range: { 
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
      to: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) 
    } 
  },
  { 
    label: 'Last Month', 
    range: { 
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 
      to: new Date(new Date().getFullYear(), new Date().getMonth(), 0) 
    } 
  },
]

export default function DateRangePicker({ 
  value, 
  onChange, 
  placeholder = 'Select date range',
  className = ''
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    // Update panel position
    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect()
      if (!triggerRect) return

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const margin = 16
      const panelWidth = 280 // Fixed width for the date picker
      const panelHeight = 350 // Approximate height

      // Calculate horizontal position
      let left = triggerRect.left
      
      // If panel would overflow right edge, align to right edge of trigger
      if (left + panelWidth > viewportWidth - margin) {
        left = triggerRect.right - panelWidth
      }
      
      // Ensure panel doesn't go past left edge
      if (left < margin) {
        left = margin
      }

      // Calculate vertical position - default to below
      let top = triggerRect.bottom + 8
      
      // If panel would overflow bottom edge, show above
      if (top + panelHeight > viewportHeight - margin) {
        top = triggerRect.top - panelHeight - 8
      }
      
      // Ensure panel doesn't go past top edge
      if (top < margin) {
        top = margin
      }

      // Apply position after a small delay to ensure panel is rendered
      setTimeout(() => {
        if (panelRef.current) {
          panelRef.current.style.left = `${left}px`
          panelRef.current.style.top = `${top}px`
          panelRef.current.style.width = `${panelWidth}px`
        }
      }, 0)
    }

    document.addEventListener('mousedown', handleClickOutside)
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  const formatDateRange = () => {
    if (!value.from && !value.to) return placeholder
    if (value.from && !value.to) return format(value.from, 'MMM d')
    if (!value.from && value.to) return `Until ${format(value.to, 'MMM d')}`
    if (value.from && value.to) {
      const sameMonth = value.from.getMonth() === value.to.getMonth() && 
                       value.from.getFullYear() === value.to.getFullYear()
      if (sameMonth) {
        return `${format(value.from, 'MMM d')} - ${format(value.to, 'd')}`
      }
      return `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d')}`
    }
    return placeholder
  }

  const handlePresetClick = (preset: typeof PRESET_RANGES[0]) => {
    onChange(preset.range)
    setOpen(false)
  }

  const handleDateClick = (date: Date) => {
    // Create a new date at midnight UTC to avoid timezone issues
    const clickedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    if (!value.from || (value.from && value.to)) {
      // Start new selection or reset selection
      onChange({ from: clickedDate, to: null })
    } else if (clickedDate < value.from) {
      // Selected date is before from date, swap
      onChange({ from: clickedDate, to: value.from })
    } else {
      // Complete the range
      onChange({ from: value.from, to: clickedDate })
      setOpen(false)
    }
  }

  const handleClear = () => {
    onChange({ from: null, to: null })
    setOpen(false)
  }

  const isDateSelected = (date: Date) => {
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (!value.from && !value.to) return false
    if (value.from && !value.to) {
      const fromDate = new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate())
      return format(compareDate, 'yyyy-MM-dd') === format(fromDate, 'yyyy-MM-dd')
    }
    if (value.from && value.to) {
      const fromDate = new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate())
      const toDate = new Date(value.to.getFullYear(), value.to.getMonth(), value.to.getDate())
      return format(compareDate, 'yyyy-MM-dd') === format(fromDate, 'yyyy-MM-dd') || 
             format(compareDate, 'yyyy-MM-dd') === format(toDate, 'yyyy-MM-dd')
    }
    return false
  }

  const isDateInRange = (date: Date) => {
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (!value.from || !value.to) return false
    const fromDate = new Date(value.from.getFullYear(), value.from.getMonth(), value.from.getDate())
    const toDate = new Date(value.to.getFullYear(), value.to.getMonth(), value.to.getDate())
    return compareDate >= fromDate && compareDate <= toDate
  }

  const renderCalendar = () => {
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days = []
    const current = new Date(startDate)
    
    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
      if (days.length > 42) break
    }

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    return (
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setSelectedMonth(new Date(year, month - 1))}
            className="p-0.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronDown size={12} className="rotate-90" />
          </button>
          <div className="text-[10px] font-semibold text-gray-900">
            {format(selectedMonth, 'MMM yyyy')}
          </div>
          <button
            onClick={() => setSelectedMonth(new Date(year, month + 1))}
            className="p-0.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronDown size={12} className="-rotate-90" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[8px] font-medium text-gray-500 py-0.5">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((date, index) => {
            const isCurrentMonth = date.getMonth() === month
            const isSelected = isDateSelected(date)
            const isInRange = isDateInRange(date)
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            
            return (
              <button
                key={index}
                onClick={() => handleDateClick(date)}
                className={`
                  h-6 w-6 text-[9px] rounded-md transition-colors relative
                  ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                  ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                  ${!isSelected && isInRange ? 'bg-blue-100 text-blue-700' : ''}
                  ${!isSelected && !isInRange ? 'hover:bg-gray-100' : ''}
                  ${isToday && !isSelected ? 'ring-1 ring-blue-400' : ''}
                `}
              >
                {format(date, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-left hover:border-gray-300 transition-colors shadow-sm"
      >
        <Calendar size={12} className="text-gray-400" />
        <span className="text-[10px] text-gray-700 truncate flex-1">
          {formatDateRange()}
        </span>
        {(value.from || value.to) && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={10} className="text-gray-400" />
          </button>
        )}
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          style={{ width: '280px', maxHeight: '90vh' }}
        >
          {/* Preset Ranges */}
          <div className="border-b border-gray-200 p-2">
            <div className="text-[10px] font-semibold text-gray-700 mb-1.5">Quick Select</div>
            <div className="grid grid-cols-2 gap-1">
              {PRESET_RANGES.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className="px-1.5 py-1 text-[9px] text-left rounded-md hover:bg-gray-100 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          {renderCalendar()}

          {/* Footer */}
          <div className="border-t border-gray-200 p-2 flex items-center justify-between">
            <div className="text-[9px] text-gray-500">
              {value.from && value.to 
                ? `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d')}`
                : value.from 
                  ? `From ${format(value.from, 'MMM d')}`
                  : 'Select date range'
              }
            </div>
            <button
              onClick={() => setOpen(false)}
              className="px-2 py-1 text-[9px] bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { CalendarDays, Clock3 } from 'lucide-react'

const padValue = (value: number) => String(value).padStart(2, '0')
const MIN_CREATED_AT_YEAR = 2000
const MAX_CREATED_AT_YEAR = 2090

const getTodayDateInput = () => {
  const now = new Date()
  return `${now.getFullYear()}-${padValue(now.getMonth() + 1)}-${padValue(now.getDate())}`
}

const getCurrentTimeInput = () => {
  const now = new Date()
  return `${padValue(now.getHours())}:${padValue(now.getMinutes())}`
}

const composeDateTimeValue = (datePart: string, timePart: string) => {
  if (!datePart) return ''
  return `${datePart}T${(timePart || '00:00').slice(0, 5)}`
}

export const formatDateTimeLocalInput = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const splitDateTimeValue = (value: string) => {
  if (!value) {
    return { datePart: '', timePart: '' }
  }

  if (value.includes('T')) {
    const [datePart, timeWithZone = ''] = value.split('T')
    return {
      datePart: datePart || '',
      timePart: timeWithZone.slice(0, 5) || '',
    }
  }

  const normalized = formatDateTimeLocalInput(value)
  if (!normalized) {
    return { datePart: '', timePart: '' }
  }

  const [datePart, timePart = ''] = normalized.split('T')
  return { datePart, timePart }
}

interface CreatedAtEditorProps {
  value: string
  onChange: (nextValue: string) => void
  label?: string
  helperText?: string
  description?: string
  disabled?: boolean
  compact?: boolean
}

export default function CreatedAtEditor({
  value,
  onChange,
  label = 'Created At',
  helperText = 'Uses your local date and time.',
  description,
  disabled = false,
  compact = false,
}: CreatedAtEditorProps) {
  const [draftValue, setDraftValue] = useState(() => splitDateTimeValue(value))

  const { datePart, timePart } = draftValue
  const activeYear = datePart ? Number(datePart.slice(0, 4)) : new Date().getFullYear()
  const safeYear = Number.isNaN(activeYear)
    ? new Date().getFullYear()
    : Math.min(MAX_CREATED_AT_YEAR, Math.max(MIN_CREATED_AT_YEAR, activeYear))
  const yearOptions = Array.from(
    { length: MAX_CREATED_AT_YEAR - MIN_CREATED_AT_YEAR + 1 },
    (_, index) => MAX_CREATED_AT_YEAR - index
  )

  const emit = (nextDatePart: string, nextTimePart: string) => {
    const nextValue = composeDateTimeValue(nextDatePart, nextTimePart)
    setDraftValue({ datePart: nextDatePart, timePart: nextTimePart })
    onChange(nextValue)
  }

  const updateDate = (nextDate: string) => {
    if (!nextDate) {
      setDraftValue({ datePart: '', timePart: '' })
      onChange('')
      return
    }
    emit(nextDate, timePart || getCurrentTimeInput())
  }

  const updateTime = (nextTime: string) => {
    if (!datePart) return
    emit(datePart, nextTime || '00:00')
  }

  const updateYear = (nextYear: string) => {
    const numericYear = Number(nextYear)
    if (Number.isNaN(numericYear)) return

    const baseDate = datePart || getTodayDateInput()
    const [, month, day] = baseDate.split('-')
    emit(`${numericYear}-${month}-${day}`, timePart || getCurrentTimeInput())
  }

  const applyToday = () => {
    emit(getTodayDateInput(), timePart || getCurrentTimeInput())
  }

  const applyNow = () => {
    const { datePart: d, timePart: t } = splitDateTimeValue(formatDateTimeLocalInput(new Date().toISOString()))
    emit(d, t)
  }

  return (
    <div
      className={compact
        ? 'rounded-[18px] border border-[#DBEAFE] bg-[linear-gradient(180deg,#F8FBFF_0%,#EFF6FF_100%)] p-2.5 shadow-sm'
        : 'rounded-[22px] border border-[#DBEAFE] bg-[linear-gradient(180deg,#F8FBFF_0%,#EFF6FF_100%)] p-3.5 shadow-sm'}
    >
      {!compact ? (
        <div className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1D4ED8]">{label}</p>
              {description ? <p className="mt-1 text-xs text-[#64748B]">{description}</p> : null}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#1D4ED8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
              Local time
            </div>
          </div>
        </div>
      ) : null}

      <div className={compact ? 'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_90px]' : 'grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_100px]'}>
        <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            <CalendarDays size={12} className="text-[#1D4ED8]" />
            Date
          </div>
          <input
            type="date"
            value={datePart}
            onChange={(event) => updateDate(event.target.value)}
            disabled={disabled}
            className="mt-2 w-full bg-transparent text-sm font-semibold text-[#0F172A] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            <Clock3 size={12} className="text-[#1D4ED8]" />
            Time
          </div>
          <input
            type="time"
            value={timePart}
            onChange={(event) => updateTime(event.target.value)}
            step={60}
            disabled={disabled || !datePart}
            className="mt-2 w-full bg-transparent text-sm font-semibold text-[#0F172A] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Year</div>
          <select
            value={String(safeYear)}
            onChange={(event) => updateYear(event.target.value)}
            disabled={disabled}
            className="mt-2 w-full bg-transparent text-sm font-semibold text-[#0F172A] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={compact ? 'mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between' : 'mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'}>
        {helperText ? <p className="text-[11px] text-[#64748B]">{helperText}</p> : <span />}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={applyToday}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={applyNow}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1.5 text-[11px] font-semibold text-[#4338CA] hover:bg-[#E0E7FF] disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            Now
          </button>
        </div>
      </div>
    </div>
  )
}

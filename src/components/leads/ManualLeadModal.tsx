import { useMemo, useState } from 'react'
import { X, Plus, MapPin, DollarSign, User, Mail, Phone, Building, ChevronDown, CheckCircle2, Building2 } from 'lucide-react'
import type { Lead } from '../../api/leads'
import type { LeadFieldConfig } from '../../api/settings'
import { normalizeLeadFieldConfigs } from '../../utils/leadFields'

interface ManualLeadModalProps {
  onSubmit: (lead: Partial<Lead>) => void
  onClose: () => void
  cities: string[]
  sources: string[]
  defaultCity: string
  leadFields?: LeadFieldConfig[]
  initialValues?: Partial<Pick<Lead, 'name' | 'phone' | 'city'>>
  ownerMode?: 'unassigned' | 'self'
}

const fieldLabelClass = 'text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1 group-focus-within:text-[#1D4ED8] transition-colors'
const inputClass =
  'w-full px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all'
const selectClass =
  'w-full appearance-none px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer'
const selectWithIconClass =
  'w-full pl-8 pr-7 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all appearance-none cursor-pointer'

export default function ManualLeadModal({
  onSubmit,
  onClose,
  cities,
  sources,
  defaultCity,
  leadFields,
  initialValues,
  ownerMode = 'unassigned',
}: ManualLeadModalProps) {
  const resolvedLeadFields = useMemo(
    () => normalizeLeadFieldConfigs(leadFields).filter((field) => field.active),
    [leadFields]
  )

  const buildTypeField = resolvedLeadFields.find((field) => field.key === 'buildType')
  const plotSizeUnitField = resolvedLeadFields.find((field) => field.key === 'plotSizeUnit')
  const plotSizeField = resolvedLeadFields.find((field) => field.key === 'plotSize')
  const coreFields = resolvedLeadFields.filter((field) => field.section === 'core')
  const qualificationFields = resolvedLeadFields.filter(
    (field) => field.section === 'qualification' && !['plotSize', 'plotSizeUnit'].includes(field.key)
  )

  const [form, setForm] = useState({
    name: initialValues?.name || '',
    email: '',
    phone: initialValues?.phone || '',
    city: initialValues?.city || defaultCity,
    source: sources.find((source) => source === 'Manual') || sources[0] || 'Manual',
    campaign: '',
    budget: '',
    plotOwned: false,
    plotSize: '',
    plotUnit: plotSizeUnitField?.options?.[0] || 'sq ft',
    buildType: '',
    notes: '',
  })

  const updateForm = (key: keyof typeof form, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    onSubmit({
      name: form.name,
      email: form.email || null,
      phone: form.phone,
      city: form.city,
      source: form.source,
      budget: form.budget || null,
      plotOwned: form.plotOwned,
      plotSize: form.plotSize ? parseFloat(form.plotSize) : null,
      plotSizeUnit: form.plotUnit,
      buildType: form.buildType || null,
      campaign: form.campaign || null,
      notes: form.notes || null,
    })
  }

  const renderField = (field: LeadFieldConfig) => {
    const commonLabel = (
      <label className={fieldLabelClass}>
        {field.label}
        {field.required ? <span className="text-[#DC2626]"> *</span> : null}
      </label>
    )

    if (field.key === 'city') {
      return (
        <div key={field.key} className="group">
          <label className={fieldLabelClass}>
            {field.label}
            {field.required ? <span className="text-[#DC2626]"> *</span> : null}
          </label>
          <div className="relative">
            <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
            <select
              value={form.city}
              onChange={(event) => updateForm('city', event.target.value)}
              className={selectWithIconClass}
              required={field.required}
            >
              {cities.length === 0 ? <option value="">Select City</option> : null}
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
          </div>
        </div>
      )
    }

    if (field.key === 'plotOwned') {
      return (
        <div key={field.key} className="group">
          <label className={fieldLabelClass}>
            {field.label}
            {field.required ? <span className="text-[#DC2626]"> *</span> : null}
          </label>
          <div className="relative">
            <CheckCircle2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
            <select
              value={form.plotOwned ? 'Yes' : 'No'}
              onChange={(event) => updateForm('plotOwned', event.target.value === 'Yes')}
              className={selectWithIconClass}
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
          </div>
        </div>
      )
    }

    if (field.type === 'select') {
      const options =
        field.key === 'buildType'
          ? field.options || []
          : field.key === 'plotSizeUnit'
            ? plotSizeUnitField?.options || []
            : field.options || []

      const value =
        field.key === 'buildType'
          ? form.buildType
          : field.key === 'plotSizeUnit'
            ? form.plotUnit
            : ''

      const Icon = field.key === 'buildType' ? Building2 : undefined

      return (
        <div key={field.key} className="group">
          <label className={fieldLabelClass}>
            {field.label}
            {field.required ? <span className="text-[#DC2626]"> *</span> : null}
          </label>
          <div className="relative">
            {Icon && (
              <Icon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
            )}
            <select
              value={value}
              onChange={(event) =>
                updateForm(field.key === 'plotSizeUnit' ? 'plotUnit' : field.key, event.target.value)
              }
              className={Icon ? selectWithIconClass : selectClass}
              required={field.required}
            >
              <option value="">{field.placeholder || 'Select...'}</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
          </div>
        </div>
      )
    }

    const icon =
      field.key === 'name'
        ? User
        : field.key === 'email'
          ? Mail
        : field.key === 'phone'
            ? Phone
        : field.key === 'budget'
            ? DollarSign
            : undefined

    const value =
      field.key === 'name'
        ? form.name
        : field.key === 'email'
          ? form.email
        : field.key === 'phone'
          ? form.phone
        : field.key === 'budget'
          ? form.budget
        : field.key === 'campaign'
          ? form.campaign
          : field.key === 'plotSize'
            ? form.plotSize
            : ''

    const inputType =
      field.type === 'email'
        ? 'email'
        : field.type === 'number'
          ? 'number'
        : field.key === 'phone'
          ? 'tel'
          : 'text'

    return (
      <div key={field.key} className="group">
        <label className={fieldLabelClass}>
          {field.label}
          {field.required ? <span className="text-[#DC2626]"> *</span> : null}
        </label>
        <div className="relative">
          {icon && (
            (() => {
              const Icon = icon
              return <Icon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
            })()
          )}
          <input
            type={inputType}
            value={value}
            onChange={(event) => updateForm(field.key as keyof typeof form, event.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className={icon ? selectWithIconClass : inputClass}
            required={field.required}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
              <Plus size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-[17px] leading-none text-[#0F172A]">Add Manual Lead</h2>
              <p className="text-[11px] text-[#64748B] mt-0.5">Quick lead entry form</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition-colors">
            <X size={16} className="text-[#64748B]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-600 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-bold text-blue-600 leading-none">Lead Source</p>
                  <p className="text-[10px] text-[#475569] mt-0.5">
                    {ownerMode === 'self'
                      ? 'Lead will be automatically assigned to you.'
                      : 'Lead will remain unassigned until manager assigns it.'}
                  </p>
                </div>
                <select
                  value={form.source}
                  onChange={(event) => updateForm('source', event.target.value)}
                  className="min-w-[180px] px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                >
                  {sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {coreFields.map(renderField)}
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Building size={14} className="text-[#1D4ED8]" />
                Qualification Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {qualificationFields.map(renderField)}
            </div>

            {plotSizeField || plotSizeUnitField ? (
              <div className="grid grid-cols-2 gap-2 group">
                <label className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1 block px-1 group-focus-within:text-[#1D4ED8] transition-colors col-span-2">
                  {plotSizeField?.label || 'Plot Size'}
                  {plotSizeUnitField ? ' & Units' : ''}
                </label>
                <div className="flex gap-2">
                  {plotSizeField ? (
                    <input
                      type="text"
                      value={form.plotSize}
                      onChange={(e) => updateForm('plotSize', e.target.value)}
                      placeholder={plotSizeField.placeholder || 'Size...'}
                      className="flex-1 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all"
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                  {plotSizeUnitField ? (
                    <div className="relative w-28">
                      <select
                        value={form.plotUnit}
                        onChange={(e) => updateForm('plotUnit', e.target.value)}
                        className="w-full appearance-none px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/5 focus:border-[#1D4ED8] focus:bg-white transition-all cursor-pointer"
                      >
                        {(plotSizeUnitField.options || []).map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] group-hover:text-[#1D4ED8] transition-colors pointer-events-none" />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label className={fieldLabelClass}>Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="Any additional information about this lead..."
              rows={2}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8] resize-none"
            />
          </div>

          <div className="sticky bottom-0 -mx-4 px-4 py-2.5 bg-white/95 backdrop-blur border-t border-[#E2E8F0] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1" />
            <button
              type="submit"
              disabled={!form.name || !form.phone || !form.city}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-xs font-bold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg"
            >
              <Plus size={14} />
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

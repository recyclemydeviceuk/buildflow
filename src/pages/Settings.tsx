import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Ban,
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  LayoutList,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Settings2,
  Shield,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { settingsAPI, type FeatureControls, type LeadFieldConfig, type LeadFieldKey, type SmsTemplate, type CityAssignmentRule } from '../api/settings'
import { teamAPI, type TeamMember } from '../api/team'
import { uploadsAPI } from '../api/uploads'
import { authAPI, DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../api/auth'
import { DEFAULT_LEAD_FIELDS, broadcastLeadFieldsUpdated, normalizeLeadFieldConfigs, sortLeadFields } from '../utils/leadFields'
import { broadcastFeatureControlsUpdated, DEFAULT_FEATURE_CONTROLS, normalizeFeatureControls } from '../utils/featureControls'

const managerSections = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'routing', label: 'Lead Assignment', icon: Settings2 },
  { id: 'leadfields', label: 'Lead Fields', icon: LayoutList },
  { id: 'cities', label: 'Cities', icon: MapPin },
  { id: 'sources', label: 'Lead Sources', icon: Search },
  { id: 'features', label: 'Feature Controls', icon: Shield },
  { id: 'sms-templates', label: 'SMS Templates', icon: MessageSquare },
  { id: 'security', label: 'Security', icon: Shield },
]

const repSections = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'sms-templates', label: 'SMS Templates', icon: MessageSquare },
  { id: 'security', label: 'Security', icon: Shield },
]

const defaultCities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad']

interface SectionProps {
  onSave: () => void
}

function LeadFieldsSection({ onSave }: SectionProps) {
  const [fields, setFields] = useState<LeadFieldConfig[]>(DEFAULT_LEAD_FIELDS)
  const [newFieldKey, setNewFieldKey] = useState<LeadFieldKey | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    settingsAPI.getSettings().then(res => {
      if (res.success && res.data.leadFields) {
        setFields(normalizeLeadFieldConfigs(res.data.leadFields.fields || []))
      }
    })
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      const res = await settingsAPI.updateLeadFields({
        fields: sortLeadFields(fields).map((field, index) => ({
          ...field,
          order: index,
        })),
      })
      if (res.success) {
        const latest = await settingsAPI.getSettings()
        setFields(normalizeLeadFieldConfigs(latest.data.leadFields.fields || res.data.leadFields.fields || []))
        setSuccessMessage('Lead fields saved and synced successfully.')
        broadcastLeadFieldsUpdated()
        onSave()
      }
    } catch (err) {
      console.error('Failed to save lead fields:', err)
      setError('Could not save lead field settings right now.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (key: LeadFieldKey, patch: Partial<LeadFieldConfig>) => {
    setSuccessMessage('')
    setFields((current) =>
      normalizeLeadFieldConfigs(
        current.map((field) => (field.key === key ? { ...field, ...patch } : field))
      )
    )
  }

  const removeField = (key: LeadFieldKey) => {
    if (['name', 'phone', 'city'].includes(key)) return
    setSuccessMessage('')
    setFields((current) =>
      normalizeLeadFieldConfigs(
        current.map((field) => (field.key === key ? { ...field, active: false } : field))
      )
    )
  }

  const moveField = (key: LeadFieldKey, direction: 'up' | 'down') => {
    setSuccessMessage('')
    setFields((current) => {
      const sorted = sortLeadFields(current)
      const visible = sorted.filter((field) => field.active || ['name', 'phone', 'city'].includes(field.key))
      const hidden = sorted.filter((field) => !visible.some((visibleField) => visibleField.key === field.key))
      const index = visible.findIndex((field) => field.key === key)
      if (index < 0) return current
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= visible.length) return current
      const nextVisible = [...visible]
      const [item] = nextVisible.splice(index, 1)
      nextVisible.splice(targetIndex, 0, item)
      return [...nextVisible, ...hidden].map((field, nextIndex) => ({ ...field, order: nextIndex }))
    })
  }

  const addField = () => {
    if (!newFieldKey) return
    setSuccessMessage('')
    setFields((current) =>
      normalizeLeadFieldConfigs(
        current.map((field) => (field.key === newFieldKey ? { ...field, active: true } : field))
      )
    )
    setNewFieldKey('')
  }

  const editableFields = sortLeadFields(fields)
  const visibleFields = editableFields.filter(
    (field) => field.active || ['name', 'phone', 'city'].includes(field.key)
  )
  const missingFieldOptions = editableFields.filter(
    (field) => !['name', 'phone', 'city'].includes(field.key) && !field.active
  )

  const typeColors: Record<string, { bg: string; text: string }> = {
    text:    { bg: '#EFF6FF', text: '#1D4ED8' },
    email:   { bg: '#F0FDF4', text: '#16A34A' },
    number:  { bg: '#FFF7ED', text: '#EA580C' },
    select:  { bg: '#F5F3FF', text: '#7C3AED' },
    boolean: { bg: '#FDF4FF', text: '#9333EA' },
  }
  const sectionColors: Record<string, { bg: string; text: string }> = {
    core:          { bg: '#EFF6FF', text: '#1D4ED8' },
    qualification: { bg: '#ECFDF5', text: '#059669' },
  }

  return (
    <div className="space-y-5">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-3 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">Lead Fields</h2>
          <p className="text-xs text-[#94A3B8]">Configure fields used in lead forms &amp; the lead detail page.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-[#1D4ED8] text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-blue-200"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Saving…
            </>
          ) : (
            <>
              <Check size={14} />
              Save Fields
            </>
          )}
        </button>
      </div>

      {successMessage ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4]">
          <Check size={15} className="text-[#16A34A] shrink-0" />
          <p className="text-sm font-semibold text-[#166534]">{successMessage}</p>
        </div>
      ) : null}

      {error ? (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-semibold text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      {/* Field count summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
          {visibleFields.length} Active Field{visibleFields.length !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-[#94A3B8]">Changes are applied after saving</p>
      </div>

      {/* Field cards */}
      <div className="space-y-3">
        {visibleFields.map((field, index) => {
          const canRemove = !['name', 'phone', 'city'].includes(field.key)
          const isLocked = !canRemove
          const supportsOptions = field.key === 'buildType' || field.key === 'plotSizeUnit'
          const tc = typeColors[field.type] || typeColors.text
          const sc = sectionColors[field.section] || sectionColors.qualification

          return (
            <div
              key={field.key}
              className={`group relative rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
                field.active ? 'border-[#E2E8F0]' : 'border-dashed border-[#CBD5E1] opacity-60'
              }`}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${field.active ? 'bg-[#1D4ED8]' : 'bg-[#CBD5E1]'}`} />

              <div className="pl-4 pr-4 pt-4 pb-4 space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#0F172A] truncate">{field.label}</p>
                      {isLocked && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#F1F5F9] text-[#64748B] uppercase tracking-wider">Locked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: tc.bg, color: tc.text }}>{field.type}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.text }}>{field.section}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]">{field.key}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveField(field.key, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569] disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(field.key, 'down')}
                      disabled={index === visibleFields.length - 1}
                      className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569] disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(field.key)}
                      disabled={isLocked}
                      className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#94A3B8] hover:text-[#DC2626] disabled:opacity-20 transition-colors"
                      title="Remove field"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Label & Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">Label</span>
                    <input
                      value={field.label}
                      onChange={(event) => updateField(field.key, { label: event.target.value })}
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">Placeholder</span>
                    <input
                      value={field.placeholder || ''}
                      onChange={(event) => updateField(field.key, { placeholder: event.target.value })}
                      disabled={field.key === 'city' || field.key === 'plotOwned'}
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-4 flex-wrap pt-1">
                  {/* Required toggle */}
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && updateField(field.key, { required: !field.required })}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      field.required
                        ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${field.required ? 'border-[#EA580C] bg-[#EA580C]' : 'border-[#CBD5E1]'}`}>
                      {field.required && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                    Required
                  </button>

                  {/* Active/Show toggle */}
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && updateField(field.key, { active: !field.active })}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      field.active
                        ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <span className={`relative w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${field.active ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                      <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${field.active ? 'translate-x-3' : 'translate-x-0'}`} />
                    </span>
                    Show in forms
                  </button>
                </div>

                {/* Dropdown options */}
                {supportsOptions ? (
                  <div className="space-y-2 pt-1 border-t border-[#F1F5F9]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Dropdown Options</span>
                    <div className="space-y-2">
                      {(field.options || []).map((option, optionIndex) => (
                        <div key={`${field.key}-${optionIndex}`} className="flex items-center gap-2">
                          <input
                            value={option}
                            onChange={(event) => {
                              const nextOptions = [...(field.options || [])]
                              nextOptions[optionIndex] = event.target.value
                              updateField(field.key, { options: nextOptions })
                            }}
                            className="flex-1 px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextOptions = (field.options || []).filter((_, idx) => idx !== optionIndex)
                              updateField(field.key, { options: nextOptions })
                            }}
                            disabled={(field.options || []).length <= 1}
                            className="p-2 rounded-xl hover:bg-[#FEF2F2] text-[#94A3B8] hover:text-[#DC2626] disabled:opacity-25 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField(field.key, { options: [...(field.options || []), ''] })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#BFDBFE] bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                    >
                      <Plus size={12} />
                      Add Option
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Restore hidden field */}
      {missingFieldOptions.length ? (
        <div className="rounded-2xl border border-dashed border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF]/60 to-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#1D4ED8] uppercase tracking-wider">Hidden Fields</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Pick one to add back to the form</p>
            </div>
            {newFieldKey && (
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1D4ED8] text-white text-xs font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow shadow-blue-200"
              >
                <Plus size={12} />
                Restore Field
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {missingFieldOptions.map((field) => {
              const selected = newFieldKey === field.key
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => setNewFieldKey(selected ? '' : field.key as LeadFieldKey)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    selected
                      ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-md shadow-blue-200'
                      : 'bg-white border-[#BFDBFE] text-[#1D4ED8] hover:bg-[#EFF6FF] hover:border-[#1D4ED8]'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-white bg-white' : 'border-[#93C5FD]'}`}>
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />}
                  </span>
                  {field.label}
                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${selected ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] text-[#93C5FD]'}`}>{field.key}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CitiesSection({ onSave }: SectionProps) {
  const [cities, setCities] = useState<string[]>([])
  const [newCity, setNewCity] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsAPI.getSettings().then(res => {
      if (res.success && res.data.cities) {
        setCities(res.data.cities)
      }
    })
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await settingsAPI.updateCities(cities)
      if (res.success) {
        onSave()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">Cities</h2>
        <p className="text-sm text-[#64748B]">Manage city values used across leads and filters.</p>
      </div>
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4">
        <div className="space-y-2">
          {cities.map((city) => (
            <div key={city} className="flex items-center justify-between px-4 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
              <span className="text-sm font-semibold text-[#0F172A]">{city}</span>
              <button
                onClick={() => setCities((current) => current.filter((item) => item !== city))}
                disabled={cities.length <= 1}
                className="p-1.5 text-[#CBD5E1] hover:text-[#DC2626] disabled:opacity-30"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newCity}
            onChange={(event) => setNewCity(event.target.value)}
            placeholder="Add city"
            className="flex-1 px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
          />
          <button
            onClick={() => {
              const trimmed = newCity.trim()
              if (trimmed && !cities.includes(trimmed)) {
                setCities((current) => [...current, trimmed])
                setNewCity('')
              }
            }}
            className="px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-semibold rounded-xl"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] text-white rounded-xl font-semibold text-sm disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Cities'}
      </button>
    </div>
  )
}

function SourcesSection({ onSave }: SectionProps) {
  const [sources, setSources] = useState<string[]>([])
  const [discoveredSources, setDiscoveredSources] = useState<string[]>([]) // in DB but not yet in settings
  const [newSource, setNewSource] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        // getLeadFilters returns merged settings + DB sources
        const [settingsRes, filtersRes] = await Promise.all([
          settingsAPI.getSettings(),
          import('../api/leads').then(m => m.leadsAPI.getLeadFilters()),
        ])
        const configured: string[] = (settingsRes.success && settingsRes.data.sources?.length)
          ? settingsRes.data.sources
          : ['Direct', 'Manual', 'Meta', 'Website', 'Google ADS']
        const allFromDB: string[] = filtersRes.success ? filtersRes.data.sources : []
        // Sources in DB that aren't yet in configured list
        const discovered = allFromDB.filter(
          s => !configured.map(c => c.toLowerCase()).includes(s.toLowerCase())
        )
        setSources(configured)
        setDiscoveredSources(discovered)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      setSuccess('')
      setError('')
      const res = await settingsAPI.updateSources(sources)
      if (res.success) {
        setSuccess('Lead sources saved successfully.')
        onSave()
      }
    } catch {
      setError('Failed to save sources. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addSource = (name?: string) => {
    const trimmed = (name ?? newSource).trim()
    if (!trimmed) return
    if (sources.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError('This source already exists.')
      return
    }
    setSources(current => [...current, trimmed])
    setDiscoveredSources(current => current.filter(s => s.toLowerCase() !== trimmed.toLowerCase()))
    if (!name) setNewSource('')
    setError('')
    setSuccess('')
  }

  const removeSource = (index: number) => {
    setSources(current => current.filter((_, i) => i !== index))
    setSuccess('')
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditingValue(sources[index])
    setSuccess('')
  }

  const saveEdit = (index: number) => {
    const trimmed = editingValue.trim()
    if (!trimmed) { setEditingIndex(null); return }
    setSources(current => current.map((s, i) => i === index ? trimmed : s))
    setEditingIndex(null)
    setEditingValue('')
  }

  const addAllDiscovered = () => {
    const toAdd = discoveredSources.filter(
      d => !sources.map(s => s.toLowerCase()).includes(d.toLowerCase())
    )
    setSources(current => [...current, ...toAdd])
    setDiscoveredSources([])
    setSuccess('')
  }

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-3 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">Lead Sources</h2>
          <p className="text-xs text-[#94A3B8]">Manage all sources — configured ones and those from bulk imports.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-[#1D4ED8] text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-blue-200"
        >
          {saving ? (
            <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</>
          ) : (
            <><Check size={14} />Save Sources</>
          )}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4]">
          <Check size={14} className="text-[#16A34A] shrink-0" />
          <p className="text-sm font-semibold text-[#166534]">{success}</p>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-semibold text-[#B91C1C]">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-[#94A3B8]">Loading sources…</div>
      ) : (
        <>
          {/* Discovered from DB but not yet configured */}
          {discoveredSources.length > 0 && (
            <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">Discovered from Imports</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">These sources exist in your leads but aren't configured yet. Add them to manage.</p>
                </div>
                <button
                  type="button"
                  onClick={addAllDiscovered}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EA580C] text-white text-xs font-bold rounded-xl hover:bg-orange-700 active:scale-95 transition-all"
                >
                  <Plus size={11} />
                  Add All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {discoveredSources.map(src => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => addSource(src)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#FED7AA] bg-white text-xs font-bold text-[#EA580C] hover:bg-[#FFF7ED] hover:border-[#EA580C] active:scale-95 transition-all"
                  >
                    <Plus size={11} />
                    {src}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Configured sources list */}
          <div>
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2 px-1">
              Configured Sources ({sources.length})
            </p>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              {sources.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-[#94A3B8]">No sources yet. Add one below.</div>
              )}
              {sources.map((source, index) => (
                <div key={`${source}-${index}`} className="flex items-center gap-3 px-5 py-3 border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] group transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#1D4ED8] shrink-0 opacity-60" />

                  {editingIndex === index ? (
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onBlur={() => saveEdit(index)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(index); if (e.key === 'Escape') setEditingIndex(null) }}
                      className="flex-1 px-3 py-1 bg-[#F8FAFC] border border-[#1D4ED8] rounded-xl text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-semibold text-[#0F172A]">{source}</span>
                  )}

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => startEdit(index)}
                      className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#94A3B8] hover:text-[#1D4ED8] transition-colors"
                      title="Rename"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSource(index)}
                      disabled={sources.length <= 1}
                      className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#94A3B8] hover:text-[#DC2626] disabled:opacity-25 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add new source */}
          <div className="flex gap-2">
            <input
              value={newSource}
              onChange={e => { setNewSource(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') addSource() }}
              placeholder="e.g. WhatsApp, 99acres, MagicBricks…"
              className="flex-1 px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/10 focus:border-[#1D4ED8] focus:bg-white transition-all"
            />
            <button
              type="button"
              onClick={() => addSource()}
              disabled={!newSource.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={15} />
              Add
            </button>
          </div>

          <p className="text-xs text-[#94A3B8] px-1">
            Saving updates all dropdowns across the CRM — lead filters, detail page, and manual lead form. Leads already using a removed source keep it untouched.
          </p>
        </>
      )}
    </div>
  )
}

function SectionShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
        {description ? <p className="text-sm text-[#64748B] mt-1">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export default function Settings({ role }: { role?: string }) {
  const { user, updateUser } = useAuth()
  const isManager = (role || user?.role) === 'manager'
  const sections = isManager ? managerSections : repSections
  const [active, setActive] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [notificationSaving, setNotificationSaving] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [securitySaving, setSecuritySaving] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securitySuccess, setSecuritySuccess] = useState('')
  const [teamSaving, setTeamSaving] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [createdPassword, setCreatedPassword] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    callDeviceMode: user?.callDeviceMode || 'phone',
  })
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS)
  const [hasNotificationChanges, setHasNotificationChanges] = useState(false)
  const [routing, setRouting] = useState({
    mode: 'manual',
    offerTimeout: '0',
    skipLimit: '0',
    autoEscalate: false,
  })
  // Editable draft of city → representative rules. Persisted via
  // settingsAPI.updateCityAssignmentRules when the user hits Save.
  const [cityRules, setCityRules] = useState<CityAssignmentRule[]>([])
  const [routingSaving, setRoutingSaving] = useState(false)
  const [routingError, setRoutingError] = useState('')
  // Snapshot of configured cities from the Settings doc. The Cities tab owns
  // its own local state; this is a read-only copy just for the routing picker.
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [featureControls, setFeatureControls] = useState<FeatureControls>(DEFAULT_FEATURE_CONTROLS)
  const [featureSaving, setFeatureSaving] = useState(false)
  const [featureError, setFeatureError] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([])
  const [smsTemplateSaving, setSmsTemplateSaving] = useState(false)
  const [smsTemplateError, setSmsTemplateError] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  })
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'representative' as 'manager' | 'representative',
    managerKey: '',
    password: '',
    confirmPassword: '',
  })
  const [newMemberPasswordVisible, setNewMemberPasswordVisible] = useState({ password: false, confirmPassword: false })
  const [expandedPasswordMemberId, setExpandedPasswordMemberId] = useState<string | null>(null)
  const [memberPasswordForm, setMemberPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [memberPasswordVisible, setMemberPasswordVisible] = useState({ newPassword: false, confirmPassword: false })
  const [memberPasswordSaving, setMemberPasswordSaving] = useState(false)
  const [memberPasswordResult, setMemberPasswordResult] = useState<{ memberId: string; password: string } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ member: TeamMember } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      callDeviceMode: user?.callDeviceMode || 'phone',
    })
  }, [user?.callDeviceMode, user?.email, user?.name, user?.phone])

  useEffect(() => {
    if (user?.notificationPrefs) {
      setNotifications({
        ...DEFAULT_NOTIFICATION_PREFS,
        ...user.notificationPrefs,
      })
      setHasNotificationChanges(false)
    }
  }, [user?.notificationPrefs])

  useEffect(() => {
    setAvatarUrl(user?.avatarUrl || null)
  }, [user?.avatarUrl])

  useEffect(() => {
    if (!isManager) return

    settingsAPI
      .getSettings()
      .then((response) => {
        if (!response.success) return

        if (response.data.leadRouting) {
          setRouting({
            mode: response.data.leadRouting.mode,
            offerTimeout: String(response.data.leadRouting.offerTimeout ?? 0),
            skipLimit: String(response.data.leadRouting.skipLimit ?? 0),
            autoEscalate: Boolean(response.data.leadRouting.autoEscalate),
          })
          setCityRules(response.data.leadRouting.cityAssignmentRules || [])
        }

        setAvailableCities(Array.isArray(response.data.cities) ? response.data.cities : [])

        setFeatureControls(normalizeFeatureControls(response.data.featureControls))
      })
      .catch((error) => {
        console.error('Failed to load manager settings:', error)
      })
  }, [isManager])

  useEffect(() => {
    if (!isManager) return

    teamAPI.getTeamMembers()
      .then((response) => {
        if (response.success) {
          setTeamMembers(response.data)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch team members:', error)
      })
  }, [isManager])

  useEffect(() => {
    settingsAPI.getSmsTemplates()
      .then((response) => {
        if (response.success) {
          setSmsTemplates(response.data)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch sms templates:', error)
      })
  }, [])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveFeatures = async () => {
    try {
      setFeatureSaving(true)
      setFeatureError('')
      const response = await settingsAPI.updateFeatureControls(featureControls)

      if (response.success) {
        const savedControls = normalizeFeatureControls(response.data.featureControls)
        setFeatureControls(savedControls)
        setRouting((current) => ({
          ...current,
          mode: response.data.leadRouting?.mode || (savedControls.manualAssignment ? 'manual' : 'auto'),
        }))
        broadcastFeatureControlsUpdated(savedControls)
        handleSave()
      }
    } catch (error: any) {
      console.error('Failed to save feature controls:', error)
      setFeatureError(error?.response?.data?.message || 'Could not save feature controls right now.')
    } finally {
      setFeatureSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setProfileSaving(true)
      setProfileError('')
      const response = await settingsAPI.updateMyProfile({
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        callDeviceMode: profileForm.callDeviceMode as 'phone' | 'web',
      })

      if (response.success) {
        updateUser(response.data)
        handleSave()
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
      setProfileError('Could not save profile settings. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    try {
      setNotificationSaving(true)
      setNotificationError('')
      
      // Convert to plain object to avoid sending Mongoose document metadata
      const plainNotifications: NotificationPrefs = {
        newLeadAlerts: notifications.newLeadAlerts,
        reminderAlerts: notifications.reminderAlerts,
        missedCallAlerts: notifications.missedCallAlerts,
        assignmentAlerts: notifications.assignmentAlerts,
        dailyDigest: notifications.dailyDigest,
        loginAlerts: notifications.loginAlerts,
      }
      
      console.log('[DEBUG] Saving notifications:', plainNotifications)
      
      const response = await settingsAPI.updateMyProfile({
        notificationPrefs: plainNotifications,
      })

      console.log('[DEBUG] Save response:', response)

      if (response.success) {
        console.log('[DEBUG] Saved user notificationPrefs:', response.data.notificationPrefs)
        updateUser(response.data)
        setHasNotificationChanges(false)
        handleSave()
      } else {
        setNotificationError('Failed to save notification settings.')
      }
    } catch (error: any) {
      console.error('Failed to save notification settings:', error)
      setNotificationError(error?.response?.data?.message || 'Could not save notification preferences right now.')
    } finally {
      setNotificationSaving(false)
    }
  }

  const handleCreateMember = async () => {
    try {
      setTeamSaving(true)
      setTeamError('')
      const response = await teamAPI.createTeamMember(newMember)
      if (response.success) {
        setTeamMembers((current) => [...current, response.data])
        setNewMember({ name: '', email: '', phone: '', role: 'representative', managerKey: '', password: '', confirmPassword: '' })
        setNewMemberPasswordVisible({ password: false, confirmPassword: false })
        setShowAddMember(false)
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Could not create the team member. Check the details and try again.'
      setTeamError(msg)
    } finally {
      setTeamSaving(false)
    }
  }

  const handleUpdateMember = async (memberId: string, patch: Partial<TeamMember>) => {
    try {
      setTeamError('')
      const response = await teamAPI.updateTeamMember(memberId, patch)
      if (response.success) {
        setTeamMembers((current) =>
          current.map((member) => (member.id === memberId ? response.data : member))
        )
      }
    } catch (error) {
      console.error('Failed to update team member:', error)
      setTeamError('Could not update that team member right now.')
    }
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    void (async () => {
      try {
        setAvatarUploading(true)
        setProfileError('')
        const response = await uploadsAPI.uploadAvatar(file)
        if (response.success) {
          setAvatarUrl(response.data.avatarUrl)
          updateUser(response.data.user)
        }
      } catch (error) {
        console.error('Failed to upload avatar:', error)
        setProfileError('Could not upload profile photo. Please try again.')
      } finally {
        setAvatarUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    })()
  }

  const handleAvatarDelete = async () => {
    try {
      setAvatarUploading(true)
      setProfileError('')
      const response = await uploadsAPI.deleteAvatar()
      if (response.success) {
        setAvatarUrl(null)
        updateUser({ avatarUrl: undefined })
      }
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      setProfileError('Could not remove profile photo right now.')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm

    if (!currentPassword.trim()) {
      setSecurityError('Please enter your current password.')
      setSecuritySuccess('')
      return
    }

    if (newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters long.')
      setSecuritySuccess('')
      return
    }

    if (newPassword !== confirmPassword) {
      setSecurityError('New password and confirm password must match.')
      setSecuritySuccess('')
      return
    }

    try {
      setSecuritySaving(true)
      setSecurityError('')
      setSecuritySuccess('')

      const response = await authAPI.changePassword(currentPassword, newPassword)
      if (response.success) {
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        setSecuritySuccess(response.message || 'Password updated successfully.')
      }
    } catch (error: any) {
      console.error('Failed to change password:', error)
      setSecurityError(
        error?.response?.data?.message || 'Could not update the password right now. Please try again.'
      )
    } finally {
      setSecuritySaving(false)
    }
  }

  const displayName = user?.name || (isManager ? 'Manager Kumar' : 'Representative')
  const displayEmail = user?.email || (isManager ? 'manager@buildflow.in' : 'rep@buildflow.in')
  const displayRole = user?.role === 'manager' ? 'Manager' : 'Representative'
  const displayInitials = displayName.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()

  const handleFeatureToggle = (key: keyof FeatureControls) => {
    setFeatureControls((current) => ({
      ...current,
      [key]: !current[key],
    }))
    if (featureError) setFeatureError('')
  }

  const handleNotificationToggle = (key: keyof NotificationPrefs) => {
    setNotifications((current) => ({ ...current, [key]: !current[key] }))
    setHasNotificationChanges(true)
  }

  const renderNotificationToggle = (
    key: keyof NotificationPrefs,
    label: string,
    desc: string
  ) => {
    const enabled = notifications[key]

    return (
      <button
        key={String(key)}
        type="button"
        onClick={() => handleNotificationToggle(key)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">{desc}</p>
        </div>
        <div className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-[#1D4ED8]' : 'bg-[#E2E8F0]'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </div>
      </button>
    )
  }

  const renderFeatureToggle = (
    key: keyof FeatureControls,
    label: string,
    desc: string
  ) => {
    const enabled = featureControls[key]

    return (
      <button
        key={String(key)}
        type="button"
        onClick={() => handleFeatureToggle(key)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">{desc}</p>
        </div>
        <div className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-[#1D4ED8]' : 'bg-[#E2E8F0]'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </div>
      </button>
    )
  }

  const renderProfileSection = () => (
    <SectionShell
      title="My Profile"
      description="Update the profile details and calling device settings used across BuildFlow."
    >
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center text-2xl font-bold border border-[#DBEAFE] overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover rounded-[2rem]" />
              ) : (
                displayInitials
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] text-[#1D4ED8] flex items-center justify-center shadow-sm hover:bg-[#F8FAFC]"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-sm font-semibold text-[#0F172A]">{displayName}</p>
              <p className="text-sm text-[#64748B] mt-1">{displayEmail}</p>
              <span className="inline-flex mt-3 px-3 py-1 rounded-full text-xs font-bold bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]">
                {displayRole}
              </span>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                    avatarUploading
                      ? 'bg-[#CBD5E1] border-[#CBD5E1] text-white cursor-not-allowed'
                      : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]'
                  }`}
                >
                  <Camera size={14} />
                  {avatarUploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    disabled={avatarUploading}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                      avatarUploading
                        ? 'bg-[#E2E8F0] border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                        : 'bg-white border-[#FECACA] text-[#DC2626]'
                    }`}
                  >
                    <Trash2 size={14} />
                    Remove Photo
                  </button>
                ) : null}
                <p className="text-xs text-[#94A3B8]">
                  JPEG, PNG or WebP up to 2 MB.
                </p>
              </div>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Full Name</span>
              <input
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Email</span>
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Enter email address"
                className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Phone</span>
              <input
                value={profileForm.phone}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Enter a representative phone"
                className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
              />
            </label>

            <div className="col-span-2 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Calling Device Mode</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border bg-[#1D4ED8] border-[#1D4ED8] text-white"
                >
                  Phone Bridged
                </button>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Every call is bridged to your personal phone via Exotel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {profileError ? (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
          {profileError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSaveProfile}
        disabled={profileSaving}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ${
          profileSaving ? 'bg-[#CBD5E1] text-white cursor-not-allowed' : 'bg-[#1D4ED8] text-white'
        }`}
      >
        {profileSaving ? 'Saving...' : saved ? <><Check size={14} /> Saved</> : 'Save Profile'}
      </button>
    </SectionShell>
  )

  const renderNotificationsSection = () => (
    <SectionShell
      title="Notifications"
      description="Control the operational alerts surfaced to your team."
    >
      {notificationError ? (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
          {notificationError}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
        {renderNotificationToggle('newLeadAlerts', 'New Lead Alerts', 'Email managers and the assigned owner when a fresh lead enters BuildFlow.')}
        {renderNotificationToggle('reminderAlerts', 'Reminder Alerts', 'Get email reminders when a follow-up becomes due soon or ignored.')}
        {renderNotificationToggle('missedCallAlerts', 'Missed Call Alerts', 'Get notified when a call ends as missed, busy, or unanswered.')}
        {renderNotificationToggle('assignmentAlerts', 'Assignment Alerts', 'Notify representatives when a lead is assigned or transferred to them.')}
        {renderNotificationToggle('dailyDigest', 'Daily Digest', 'Receive a daily BuildFlow performance summary by email.')}
        {renderNotificationToggle('loginAlerts', 'Login Alerts', 'Get an email whenever your BuildFlow account signs in from a new session.')}
      </div>
      <button
        type="button"
        onClick={handleSaveNotifications}
        disabled={notificationSaving || !hasNotificationChanges}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          notificationSaving
            ? 'bg-[#CBD5E1] text-white cursor-not-allowed'
            : !hasNotificationChanges
              ? 'bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
              : 'bg-[#1D4ED8] text-white hover:bg-blue-700'
        }`}
      >
        {notificationSaving ? 'Saving...' : 'Save Notifications'}
      </button>
    </SectionShell>
  )

  const handleResetMemberPassword = async (memberId: string) => {
    const pw = memberPasswordForm.newPassword.trim()
    const confirm = memberPasswordForm.confirmPassword.trim()
    if (pw && pw !== confirm) {
      setTeamError('Passwords do not match.')
      return
    }
    try {
      setMemberPasswordSaving(true)
      setTeamError('')
      const response = await teamAPI.resetMemberPassword(memberId, pw || undefined)
      if (response.success) {
        setMemberPasswordResult({ memberId, password: response.data.temporaryPassword })
        setMemberPasswordForm({ newPassword: '', confirmPassword: '' })
        setExpandedPasswordMemberId(null)
      }
    } catch {
      setTeamError('Could not reset the password right now.')
    } finally {
      setMemberPasswordSaving(false)
    }
  }

  const renderTeamSection = () => (
    <SectionShell
      title="Team"
      description="Manage managers and representatives, along with their call routing details."
    >

      {memberPasswordResult ? (
        <div className="px-4 py-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#166534]">Password updated successfully</p>
            <p className="text-xs text-[#166534] mt-1">Share this password with the team member securely.</p>
            <p className="text-sm text-[#166534] mt-2 font-mono bg-white border border-[#BBF7D0] rounded-lg px-3 py-1.5 inline-block">{memberPasswordResult.password}</p>
          </div>
          <button type="button" onClick={() => setMemberPasswordResult(null)} className="text-[#16A34A] hover:text-[#166534] text-xs font-semibold mt-0.5">Dismiss</button>
        </div>
      ) : null}

      {teamError ? (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
          {teamError}
        </div>
      ) : null}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          value={teamSearch}
          onChange={e => setTeamSearch(e.target.value)}
          placeholder="Search team members by name, email or role..."
          className="w-full pl-9 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
        {teamMembers.filter(m => {
          const q = teamSearch.toLowerCase()
          return !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.role?.toLowerCase().includes(q)
        }).map((member) => (
          <div key={member.id} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    member.isActive
                      ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                      : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                  }`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] capitalize">
                    {member.role}
                  </span>
                </div>
              </div>

              {member.id !== user?.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  {member.isActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTeamError('')
                        teamAPI.deactivateTeamMember(member.id)
                          .then((res) => {
                            if (res.success) {
                              setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, isActive: false } : item))
                            }
                          })
                          .catch(() => setTeamError('Could not deactivate that team member right now.'))
                      }}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border border-[#FED7AA] text-[#C2410C] hover:bg-[#FFF7ED] transition-colors"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTeamError('')
                        teamAPI.activateTeamMember(member.id)
                          .then((res) => {
                            if (res.success) {
                              setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, isActive: true } : item))
                            }
                          })
                          .catch(() => setTeamError('Could not activate that team member right now.'))
                      }}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border border-[#BBF7D0] text-[#16A34A] hover:bg-[#F0FDF4] transition-colors"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModal({ member })
                      setDeleteConfirmText('')
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-semibold border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Full Name</label>
                <input
                  value={member.name || ''}
                  onChange={(event) => setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, name: event.target.value } : item))}
                  placeholder="Full name"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Email</label>
                <input
                  value={member.email || ''}
                  onChange={(event) => setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, email: event.target.value } : item))}
                  placeholder="Email address"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Phone</label>
                <input
                  value={member.phone || ''}
                  onChange={(event) => setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, phone: event.target.value } : item))}
                  placeholder="Phone number"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Role</label>
                <select
                  value={member.role}
                  onChange={(event) => setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, role: event.target.value as TeamMember['role'] } : item))}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                >
                  <option value="representative">Representative</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Availability</label>
                <select
                  value={member.callAvailabilityStatus || 'available'}
                  onChange={(event) => setTeamMembers((current) => current.map((item) => item.id === member.id ? { ...item, callAvailabilityStatus: event.target.value as TeamMember['callAvailabilityStatus'] } : item))}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                >
                  <option value="available">Available</option>
                  <option value="offline">Offline</option>
                  <option value="in-call">In Call</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleUpdateMember(member.id, {
                    name: member.name,
                    email: member.email,
                    phone: member.phone,
                    role: member.role,
                    callAvailabilityStatus: member.callAvailabilityStatus,
                    callDeviceMode: member.callDeviceMode,
                    isActive: member.isActive,
                  })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Update
                </button>
              </div>
            </div>

            {member.id !== user?.id ? (
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedPasswordMemberId(expandedPasswordMemberId === member.id ? null : member.id)
                    setMemberPasswordForm({ newPassword: '', confirmPassword: '' })
                    setMemberPasswordVisible({ newPassword: false, confirmPassword: false })
                    setTeamError('')
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAFC] text-sm font-semibold text-[#475569] hover:bg-[#F1F5F9] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Shield size={14} className="text-[#94A3B8]" />
                    Change / Reset Password
                  </span>
                  {expandedPasswordMemberId === member.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {expandedPasswordMemberId === member.id ? (
                  <div className="px-4 py-4 space-y-3 bg-white border-t border-[#E2E8F0]">
                    <p className="text-xs text-[#64748B]">Enter a new password, or leave blank to auto-generate one.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">New Password</label>
                        <input
                          type={memberPasswordVisible.newPassword ? 'text' : 'password'}
                          value={memberPasswordForm.newPassword}
                          onChange={(e) => setMemberPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                          placeholder="Leave blank to auto-generate"
                          className="w-full pr-10 pl-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                        />
                        <button
                          type="button"
                          onClick={() => setMemberPasswordVisible((v) => ({ ...v, newPassword: !v.newPassword }))}
                          className="absolute right-3 top-[calc(1.5rem+0.625rem)] -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                        >
                          {memberPasswordVisible.newPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <div className="relative">
                        <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Confirm Password</label>
                        <input
                          type={memberPasswordVisible.confirmPassword ? 'text' : 'password'}
                          value={memberPasswordForm.confirmPassword}
                          onChange={(e) => setMemberPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          placeholder="Repeat new password"
                          className="w-full pr-10 pl-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                        />
                        <button
                          type="button"
                          onClick={() => setMemberPasswordVisible((v) => ({ ...v, confirmPassword: !v.confirmPassword }))}
                          className="absolute right-3 top-[calc(1.5rem+0.625rem)] -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                        >
                          {memberPasswordVisible.confirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleResetMemberPassword(member.id)}
                        disabled={memberPasswordSaving}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${memberPasswordSaving ? 'bg-[#CBD5E1] text-white cursor-not-allowed' : 'bg-[#1D4ED8] text-white hover:bg-blue-700'}`}
                      >
                        {memberPasswordSaving ? 'Saving...' : memberPasswordForm.newPassword ? 'Set Password' : 'Generate & Set Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedPasswordMemberId(null)
                          setMemberPasswordForm({ newPassword: '', confirmPassword: '' })
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Add Team Member</p>
            <p className="text-xs text-[#94A3B8] mt-1">Create a new manager or representative login.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddMember((current) => !current)}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#475569]"
          >
            {showAddMember ? 'Close' : 'Add Member'}
          </button>
        </div>

        {showAddMember ? (
          <div className="grid grid-cols-2 gap-3">
            <input
              value={newMember.name}
              onChange={(event) => setNewMember((current) => ({ ...current, name: event.target.value }))}
              placeholder="Full name"
              className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm"
            />
            <input
              value={newMember.email}
              onChange={(event) => setNewMember((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm"
            />
            <input
              value={newMember.phone}
              onChange={(event) => setNewMember((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone"
              className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm"
            />
            <select
              value={newMember.role}
              onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value as 'manager' | 'representative', managerKey: '' }))}
              className="px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm"
            >
              <option value="representative">Representative</option>
              <option value="manager">Manager</option>
            </select>

            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Password</label>
                <input
                  type={newMemberPasswordVisible.password ? 'text' : 'password'}
                  value={newMember.password}
                  onChange={(event) => setNewMember((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
                <button
                  type="button"
                  onClick={() => setNewMemberPasswordVisible((v) => ({ ...v, password: !v.password }))}
                  className="absolute right-3 top-[30px] text-[#94A3B8] hover:text-[#475569]"
                >
                  {newMemberPasswordVisible.password ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Confirm Password</label>
                <input
                  type={newMemberPasswordVisible.confirmPassword ? 'text' : 'password'}
                  value={newMember.confirmPassword}
                  onChange={(event) => setNewMember((current) => ({ ...current, confirmPassword: event.target.value }))}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className={`w-full px-3.5 py-2.5 pr-10 bg-[#F8FAFC] border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                    newMember.confirmPassword && newMember.confirmPassword !== newMember.password
                      ? 'border-[#FECACA] focus:ring-[#DC2626]'
                      : 'border-[#E2E8F0] focus:ring-[#1D4ED8]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setNewMemberPasswordVisible((v) => ({ ...v, confirmPassword: !v.confirmPassword }))}
                  className="absolute right-3 top-[30px] text-[#94A3B8] hover:text-[#475569]"
                >
                  {newMemberPasswordVisible.confirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {newMember.confirmPassword && newMember.confirmPassword !== newMember.password ? (
              <p className="col-span-2 text-xs font-medium text-[#DC2626] -mt-1">Passwords do not match</p>
            ) : null}

            {newMember.role === 'manager' ? (
              <div className="col-span-2">
                <div className="rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3 mb-2">
                  <p className="text-xs font-semibold text-[#92400E] flex items-center gap-1.5">
                    <span>🔐</span> Manager Authorization Required
                  </p>
                  <p className="text-xs text-[#A16207] mt-1">
                    Creating a manager account requires a secret authorization key. Contact your system administrator to obtain it.
                  </p>
                </div>
                <input
                  type="password"
                  value={newMember.managerKey}
                  onChange={(event) => setNewMember((current) => ({ ...current, managerKey: event.target.value }))}
                  placeholder="Enter manager authorization key"
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#FDE68A] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-[#F59E0B]"
                />
              </div>
            ) : null}

            <div className="col-span-2 space-y-2">
              <p className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <span>✉️</span> Login credentials will be emailed to the member automatically.
              </p>
              <button
                type="button"
                onClick={handleCreateMember}
                disabled={
                  teamSaving ||
                  !newMember.password ||
                  newMember.password.length < 8 ||
                  newMember.password !== newMember.confirmPassword ||
                  (newMember.role === 'manager' && !newMember.managerKey.trim())
                }
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  teamSaving ||
                  !newMember.password ||
                  newMember.password.length < 8 ||
                  newMember.password !== newMember.confirmPassword ||
                  (newMember.role === 'manager' && !newMember.managerKey.trim())
                    ? 'bg-[#CBD5E1] text-white cursor-not-allowed'
                    : 'bg-[#1D4ED8] text-white hover:bg-blue-700'
                }`}
              >
                {teamSaving ? 'Creating...' : 'Create Member & Send Credentials'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {deleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-[#FEE2E2] bg-[#FEF2F2]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-[#DC2626]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">Permanently delete member</p>
                  <p className="text-xs text-[#64748B] mt-0.5 capitalize">{deleteModal.member.role} · {deleteModal.member.email}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[#475569] leading-relaxed">
                This action <span className="font-bold text-[#0F172A]">cannot be undone</span>. This will permanently delete the account for{' '}
                <span className="font-bold text-[#0F172A]">{deleteModal.member.name}</span> and remove all their data from BuildFlow.
              </p>

              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                <p className="text-xs text-[#64748B]">
                  Please type <span className="font-mono font-bold text-[#0F172A] select-all">{deleteModal.member.name}</span> to confirm.
                </p>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModal.member.name}
                  autoFocus
                  className="mt-2 w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-[#DC2626]"
                />
              </div>

              {teamError ? (
                <p className="text-xs font-medium text-[#DC2626]">{teamError}</p>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-[#F1F5F9] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteModal(null)
                  setDeleteConfirmText('')
                  setTeamError('')
                }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== deleteModal.member.name || deleteLoading}
                onClick={async () => {
                  try {
                    setDeleteLoading(true)
                    setTeamError('')
                    const res = await teamAPI.deleteTeamMember(deleteModal.member.id)
                    if (res.success) {
                      setTeamMembers((current) => current.filter((item) => item.id !== deleteModal.member.id))
                      setDeleteModal(null)
                      setDeleteConfirmText('')
                    }
                  } catch {
                    setTeamError('Could not delete this team member. Please try again.')
                  } finally {
                    setDeleteLoading(false)
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  deleteConfirmText !== deleteModal.member.name || deleteLoading
                    ? 'bg-[#FCA5A5] text-white cursor-not-allowed'
                    : 'bg-[#DC2626] text-white hover:bg-red-700'
                }`}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionShell>
  )

const reps = teamMembers.filter((member) => member.role === 'representative' && member.isActive !== false)

  const saveRoutingMode = async (nextMode: 'manual' | 'auto') => {
    try {
      setRoutingSaving(true)
      setRoutingError('')
      const res = await settingsAPI.updateLeadRouting({
        mode: nextMode,
        offerTimeout: routing.offerTimeout,
        skipLimit: routing.skipLimit,
      })
      if (res.success) {
        setRouting((current) => ({ ...current, mode: nextMode }))
        // Keep featureControls in sync locally — the backend already flipped
        // manualAssignment on our behalf.
        if (res.data?.featureControls) {
          const synced = normalizeFeatureControls(res.data.featureControls)
          setFeatureControls(synced)
          broadcastFeatureControlsUpdated(synced)
        }
        handleSave()
      }
    } catch (error: any) {
      console.error('Failed to update routing mode:', error)
      setRoutingError(error?.response?.data?.message || 'Could not update the routing mode.')
    } finally {
      setRoutingSaving(false)
    }
  }

  const saveCityRules = async () => {
    try {
      setRoutingSaving(true)
      setRoutingError('')
      // Strip down to the payload shape the backend expects. Server hydrates
      // userNames from the matching User documents.
      const payload = cityRules
        .filter((rule) => rule.userIds.length > 0 && rule.cities.length > 0)
        .map((rule) => ({ userIds: rule.userIds, cities: rule.cities }))
      const res = await settingsAPI.updateCityAssignmentRules(payload)
      if (res.success) {
        setCityRules(res.data?.leadRouting?.cityAssignmentRules || [])
        handleSave()
      }
    } catch (error: any) {
      console.error('Failed to save city rules:', error)
      setRoutingError(error?.response?.data?.message || 'Could not save the city rules.')
    } finally {
      setRoutingSaving(false)
    }
  }

  const addCityRule = () => {
    setCityRules((current) => [...current, { cities: [], userIds: [], userNames: [] }])
  }

  const removeCityRule = (index: number) => {
    setCityRules((current) => current.filter((_, i) => i !== index))
  }

  const toggleCityOnRule = (index: number, city: string) => {
    setCityRules((current) =>
      current.map((rule, i) => {
        if (i !== index) return rule
        const has = rule.cities.includes(city)
        return {
          ...rule,
          cities: has ? rule.cities.filter((c) => c !== city) : [...rule.cities, city],
        }
      })
    )
  }

  const toggleRepOnRule = (index: number, userId: string) => {
    const rep = reps.find((r) => r.id === userId)
    if (!rep) return
    setCityRules((current) =>
      current.map((rule, i) => {
        if (i !== index) return rule
        const has = rule.userIds.includes(userId)
        if (has) {
          // Deselect — keep userIds and userNames positionally aligned.
          const keptIds: string[] = []
          const keptNames: string[] = []
          rule.userIds.forEach((id, idx) => {
            if (id !== userId) {
              keptIds.push(id)
              keptNames.push(rule.userNames[idx] || '')
            }
          })
          return { ...rule, userIds: keptIds, userNames: keptNames }
        }
        return {
          ...rule,
          userIds: [...rule.userIds, userId],
          userNames: [...rule.userNames, rep.name],
        }
      })
    )
  }

  const isAutoMode = routing.mode === 'auto'

  // Per-rep "block from receiving leads" toggle. Reuses the same PATCH
  // endpoint as the rest of the team editor so the change is broadcast over
  // the user-availability socket channel — every connected client sees it
  // immediately. Optimistically flips the row, rolls back on error.
  const [leadReceivingPendingId, setLeadReceivingPendingId] = useState<string | null>(null)
  const [leadReceivingError, setLeadReceivingError] = useState('')
  const handleToggleCanReceiveLeads = async (memberId: string, nextValue: boolean) => {
    setLeadReceivingError('')
    setLeadReceivingPendingId(memberId)
    const previous = teamMembers
    setTeamMembers((current) =>
      current.map((m) => (m.id === memberId ? { ...m, canReceiveLeads: nextValue } : m))
    )
    try {
      const res = await teamAPI.updateTeamMember(memberId, { canReceiveLeads: nextValue })
      if (res.success) {
        setTeamMembers((current) =>
          current.map((m) => (m.id === memberId ? { ...m, ...res.data } : m))
        )
      } else {
        setTeamMembers(previous)
        setLeadReceivingError('Could not update that representative right now.')
      }
    } catch (error: any) {
      setTeamMembers(previous)
      setLeadReceivingError(error?.response?.data?.message || 'Could not update that representative right now.')
    } finally {
      setLeadReceivingPendingId(null)
    }
  }

  // All reps (active + inactive) who could potentially receive leads. We show
  // inactive ones too so the manager has a single place to see the routing
  // posture of every account, but they're rendered greyed out.
  const allReps = teamMembers.filter((m) => m.role === 'representative')
  const blockedReps = allReps.filter((m) => m.isActive && m.canReceiveLeads === false)

  const renderRoutingSection = () => (
    <SectionShell
      title="Lead Assignment"
      description="Choose how new leads are owned. City rules take priority, then fall back to round-robin."
    >
      {/* ── Mode toggle ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5">
        <div>
          <p className="text-sm font-bold text-[#0F172A]">Assignment Mode</p>
          <p className="text-xs text-[#64748B] mt-0.5">Pick the default behavior for newly-arrived leads.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => saveRoutingMode('manual')}
            disabled={routingSaving}
            className={`text-left p-4 rounded-2xl border-2 transition-all ${
              !isAutoMode
                ? 'border-[#1D4ED8] bg-[#EFF6FF] shadow-sm ring-2 ring-[#1D4ED8]/10'
                : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE]'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-extrabold ${!isAutoMode ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>
                Manual
              </span>
              {!isAutoMode && (
                <span className="px-2 py-0.5 rounded-full bg-[#1D4ED8] text-white text-[10px] font-bold uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              New leads land unassigned. Manager picks the owner manually.
            </p>
          </button>

          <button
            type="button"
            onClick={() => saveRoutingMode('auto')}
            disabled={routingSaving}
            className={`text-left p-4 rounded-2xl border-2 transition-all ${
              isAutoMode
                ? 'border-[#16A34A] bg-[#F0FDF4] shadow-sm ring-2 ring-[#16A34A]/10'
                : 'border-[#E2E8F0] bg-white hover:border-[#BBF7D0]'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-extrabold ${isAutoMode ? 'text-[#16A34A]' : 'text-[#0F172A]'}`}>
                Round Robin
              </span>
              {isAutoMode && (
                <span className="px-2 py-0.5 rounded-full bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              New leads auto-assign. City rules win first, everyone else goes in rotation.
            </p>
          </button>
        </div>

        {routingError && (
          <p className="text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {routingError}
          </p>
        )}
      </div>

      {/* ── Lead Receiving (blocks reps from auto-routing) ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4 mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Lead Receiving</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Toggle off to stop auto-routing new leads to a rep. They keep all existing leads and stay active for calls and follow-ups.
            </p>
          </div>
          {blockedReps.length > 0 ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[10px] font-bold">
              <Ban size={11} /> {blockedReps.length} blocked
            </span>
          ) : null}
        </div>

        {leadReceivingError && (
          <p className="text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {leadReceivingError}
          </p>
        )}

        {allReps.length === 0 ? (
          <p className="text-xs text-[#94A3B8] italic px-1">No representatives yet. Add reps from the Team tab.</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9] -mx-1">
            {allReps.map((rep) => {
              const receiving = rep.canReceiveLeads !== false
              const inactive = !rep.isActive
              const pending = leadReceivingPendingId === rep.id
              return (
                <div
                  key={rep.id}
                  className={`flex items-center justify-between gap-3 px-1 py-2.5 ${inactive ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{rep.name}</p>
                      {inactive ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F1F5F9] text-[#64748B] uppercase tracking-wide">
                          Inactive
                        </span>
                      ) : !receiving ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] uppercase tracking-wide">
                          Blocked
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-[#94A3B8] truncate">{rep.email}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={receiving}
                    aria-label={receiving ? `Block ${rep.name} from receiving leads` : `Allow ${rep.name} to receive leads`}
                    disabled={pending || inactive}
                    onClick={() => handleToggleCanReceiveLeads(rep.id, !receiving)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      receiving ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        receiving ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── City Rules (only when Round Robin is active) ── */}
      {isAutoMode && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5 mt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#0F172A]">City Assignment Rules</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                Leads from these cities always go to the chosen rep. Everything else falls back to round-robin.
              </p>
            </div>
            <button
              type="button"
              onClick={addCityRule}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-xs font-bold hover:bg-[#DBEAFE] transition-colors"
            >
              <Plus size={13} /> Add Rule
            </button>
          </div>

          {cityRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-8 text-center">
              <p className="text-xs text-[#64748B]">
                No city rules yet — all leads will round-robin across active reps.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cityRules.map((rule, index) => (
                <div
                  key={rule._id || `new-${index}`}
                  className="rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Rule #{index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeCityRule(index)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-[11px] font-bold hover:bg-[#FEE2E2] transition-colors"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1.5">
                      Cities
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCities.length === 0 ? (
                        <p className="text-xs text-[#94A3B8] italic">
                          No cities configured. Add cities from the Cities tab first.
                        </p>
                      ) : (
                        availableCities.map((city) => {
                          const selected = rule.cities.includes(city)
                          return (
                            <button
                              key={city}
                              type="button"
                              onClick={() => toggleCityOnRule(index, city)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                                selected
                                  ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-sm'
                                  : 'bg-white border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]'
                              }`}
                            >
                              {city}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1.5">
                      Assigns to{' '}
                      <span className="font-normal normal-case tracking-normal text-[10px] text-[#64748B]">
                        (pick one or more — leads rotate among them)
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {reps.length === 0 ? (
                        <p className="text-xs text-[#94A3B8] italic">
                          No active representatives available.
                        </p>
                      ) : (
                        reps.map((rep) => {
                          const selected = rule.userIds.includes(rep.id)
                          const blocked = rep.canReceiveLeads === false
                          return (
                            <button
                              key={rep.id}
                              type="button"
                              onClick={() => toggleRepOnRule(index, rep.id)}
                              title={blocked ? `${rep.name} is blocked from receiving leads — toggle them on in the Lead Receiving panel above to start auto-routing.` : undefined}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                                selected
                                  ? blocked
                                    ? 'bg-[#94A3B8] border-[#94A3B8] text-white shadow-sm line-through decoration-1'
                                    : 'bg-[#16A34A] border-[#16A34A] text-white shadow-sm'
                                  : blocked
                                    ? 'bg-[#F8FAFC] border-[#FECACA] text-[#B91C1C]'
                                    : 'bg-white border-[#E2E8F0] text-[#475569] hover:border-[#BBF7D0]'
                              }`}
                            >
                              {blocked ? <Ban size={10} /> : null}
                              {rep.name}
                            </button>
                          )
                        })
                      )}
                    </div>
                    {rule.userIds.length > 1 && (
                      <p className="text-[10px] text-[#16A34A] font-semibold mt-2">
                        {rule.userIds.length} reps selected · leads will round-robin between them
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={saveCityRules}
              disabled={routingSaving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                saved ? 'bg-[#16A34A] text-white' : 'bg-[#1D4ED8] text-white hover:bg-blue-700'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {saved ? <><Check size={14} /> Saved</> : routingSaving ? 'Saving…' : 'Save City Rules'}
            </button>
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 mt-4">
        <p className="text-sm font-semibold text-[#0F172A] mb-2">How it works</p>
        <ul className="space-y-1 text-xs text-[#475569] leading-relaxed list-disc pl-5">
          {isAutoMode ? (
            <>
              <li>City rules are checked first. Leads from a matched city go straight to the chosen rep.</li>
              <li>All other leads round-robin across active reps — the one who has waited longest gets the next lead.</li>
              <li>The rep sees a "New Lead Assigned" popup the moment they're auto-assigned.</li>
              <li>Reps placing a dialer call still self-own that lead. Incoming call leads go to whoever answered.</li>
            </>
          ) : (
            <>
              <li>New leads arrive unassigned on the manager's Leads page.</li>
              <li>Managers hand-pick the owner for each lead.</li>
              <li>Reps can transfer a lead they own to another rep.</li>
              <li>Switch to Round Robin to automate this.</li>
            </>
          )}
        </ul>
      </div>
    </SectionShell>
  )

  const renderFeaturesSection = () => {
    type ToggleGroup = {
      group: string
      description: string
      color: string
      items: { key: keyof FeatureControls; label: string; desc: string; badge?: string }[]
    }
    const groups: ToggleGroup[] = [
      {
        group: 'Lead Management',
        description: 'Control how leads flow into and through the CRM.',
        color: '#1D4ED8',
        items: [
          { key: 'manualAssignment', label: 'Manual Assignment', desc: 'Keep new leads under manager control until someone assigns or transfers them.' },
          { key: 'autoQueueing', label: 'Auto Queueing', desc: 'Automatically queue incoming leads for representatives to accept and work on.' },
          { key: 'duplicateDetection', label: 'Duplicate Detection', desc: 'Block or flag leads with duplicate phone numbers on import and manual entry.' },
          { key: 'exportLeads', label: 'Export Leads', desc: 'Allow managers to export lead data as CSV or Excel from the leads list.' },
          { key: 'bulkEdit', label: 'Bulk Edit', desc: 'Enable bulk status updates, assignment, and deletion from the leads list.' },
        ],
      },
      {
        group: 'Calling & Recording',
        description: 'Toggle Exotel calling features for your team.',
        color: '#7C3AED',
        items: [
          { key: 'dialer', label: 'Dialer', desc: 'Turn outbound calling on or off across the sidebar, dialer page, and lead workspace.' },
          { key: 'callRecording', label: 'Call Recordings', desc: 'Allow recording playback and recording request buttons inside BuildFlow.' },
        ],
      },
      {
        group: 'Messaging & Notifications',
        description: 'Control SMS, WhatsApp, and follow-up reminder features.',
        color: '#EA580C',
        items: [
          { key: 'smsEnabled', label: 'SMS', desc: 'Enable sending SMS messages to leads directly from the lead detail page.', badge: 'Requires Exotel SMS' },
          { key: 'whatsappEnabled', label: 'WhatsApp', desc: 'Enable WhatsApp messaging integration for lead communication.', badge: 'Requires Integration' },
          { key: 'followUpReminders', label: 'Follow-up Reminders', desc: 'Show follow-up due popups to representatives when a follow-up is scheduled.' },
        ],
      },
      {
        group: 'Access & Visibility',
        description: 'Control what representatives can see and do.',
        color: '#16A34A',
        items: [
          { key: 'analyticsAccess', label: 'Analytics Access', desc: 'Allow representatives to view analytics and performance dashboards.' },
          { key: 'auditLog', label: 'Audit Log', desc: 'Show the audit log section to managers for tracking all CRM activity.' },
          { key: 'representativeCanDelete', label: 'Rep Can Delete Leads', desc: 'Allow representatives to delete leads. Disabled by default for data safety.', badge: 'Caution' },
        ],
      },
    ]

    return (
      <div className="space-y-5">
        {/* Sticky save bar */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-3 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between gap-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Feature Controls</h2>
            <p className="text-xs text-[#94A3B8]">Toggle every module and permission your team can access across BuildFlow.</p>
          </div>
          <button
            type="button"
            onClick={handleSaveFeatures}
            disabled={featureSaving}
            className={`shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-md ${
              featureSaving ? 'bg-[#CBD5E1] text-white cursor-not-allowed shadow-none' : saved ? 'bg-[#16A34A] text-white shadow-green-200' : 'bg-[#1D4ED8] text-white shadow-blue-200 hover:bg-blue-700'
            }`}
          >
            {featureSaving ? (
              <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</>
            ) : saved ? (
              <><Check size={14} />Saved</>
            ) : (
              <><Check size={14} />Save Controls</>
            )}
          </button>
        </div>

        {featureError ? (
          <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-semibold text-[#B91C1C]">{featureError}</div>
        ) : null}

        {/* Active summary pills */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(featureControls) as (keyof FeatureControls)[]).filter(k => featureControls[k]).map(k => {
            const label = groups.flatMap(g => g.items).find(i => i.key === k)?.label || k
            return (
              <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                {label}
              </span>
            )
          })}
        </div>

        {/* Groups */}
        {groups.map(group => (
          <div key={group.group} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-3 rounded-full" style={{ background: group.color }} />
              <div>
                <p className="text-xs font-bold text-[#0F172A]">{group.group}</p>
                <p className="text-[10px] text-[#94A3B8]">{group.description}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#F8FAFC] overflow-hidden">
              {group.items.map(({ key, label, desc, badge }) => {
                const enabled = featureControls[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleFeatureToggle(key)}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[#F8FAFC] transition-colors group"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
                        {badge && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            badge === 'Caution' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F1F5F9] text-[#64748B]'
                          }`}>{badge}</span>
                        )}
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-0.5">{desc}</p>
                    </div>
                    <div className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-[#1D4ED8]' : 'bg-[#E2E8F0]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${enabled ? 'left-6' : 'left-1'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderSecuritySection = () => (
    <SectionShell
      title="Security"
      description="Review login ownership and access hygiene for this account."
    >
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-[#1D4ED8] mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Access is tied to your BuildFlow login</p>
            <p className="text-sm text-[#64748B] mt-1">
              Update your password directly here without leaving the Settings screen.
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Current Login</p>
          <p className="text-sm font-semibold text-[#0F172A] mt-2">{displayEmail}</p>
        </div>

        {securityError ? (
          <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
            {securityError}
          </div>
        ) : null}

        {securitySuccess ? (
          <div className="px-4 py-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] text-sm font-medium text-[#166534]">
            {securitySuccess}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              key: 'currentPassword' as const,
              label: 'Current Password',
              placeholder: 'Enter current password',
            },
            {
              key: 'newPassword' as const,
              label: 'New Password',
              placeholder: 'Enter new password',
            },
            {
              key: 'confirmPassword' as const,
              label: 'Confirm New Password',
              placeholder: 'Re-enter new password',
            },
          ].map((field) => (
            <label
              key={field.key}
              className={`space-y-2 ${field.key === 'currentPassword' ? 'md:col-span-2' : ''}`}
            >
              <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">{field.label}</span>
              <div className="relative">
                <input
                  type={passwordVisibility[field.key] ? 'text' : 'password'}
                  value={passwordForm[field.key]}
                  onChange={(event) => {
                    setPasswordForm((current) => ({ ...current, [field.key]: event.target.value }))
                    if (securityError) setSecurityError('')
                    if (securitySuccess) setSecuritySuccess('')
                  }}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPasswordVisibility((current) => ({
                      ...current,
                      [field.key]: !current[field.key],
                    }))
                  }
                  className="absolute inset-y-0 right-0 px-4 text-[#64748B] hover:text-[#1D4ED8]"
                >
                  {passwordVisibility[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-[#94A3B8]">Use at least 8 characters for a stronger password.</p>
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={securitySaving}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ${
              securitySaving ? 'bg-[#CBD5E1] text-white cursor-not-allowed' : 'bg-[#1D4ED8] text-white'
            }`}
          >
            {securitySaving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </SectionShell>
  )

  const handleSaveSmsTemplates = async () => {
    try {
      setSmsTemplateSaving(true)
      setSmsTemplateError('')
      const normalizedTemplates = smsTemplates
        .map((template, index) => ({
          id: template.id || `template-${index + 1}`,
          title: template.title.trim(),
          body: template.body.trim(),
          isActive: template.isActive !== false,
        }))
        .filter((template) => template.title && template.body)

      const response = await settingsAPI.updateSmsTemplates(normalizedTemplates)
      if (response.success) {
        setSmsTemplates(response.data)
        handleSave()
      }
    } catch (error) {
      console.error('Failed to save sms templates:', error)
      setSmsTemplateError('Could not save SMS templates right now.')
    } finally {
      setSmsTemplateSaving(false)
    }
  }

  const renderSmsTemplatesSection = () => (
    <SectionShell
      title="SMS Templates"
      description="Create and manage reusable Exotel SMS templates that can be picked from the Call Log composer."
    >
      {smsTemplateError ? (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
          {smsTemplateError}
        </div>
      ) : null}

      <div className="space-y-4">
        {smsTemplates.map((template, index) => (
          <div key={template.id || index} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <input
                  value={template.title}
                  onChange={(event) =>
                    setSmsTemplates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: event.target.value } : item
                      )
                    )
                  }
                  placeholder="Template title"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#0F172A]"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setSmsTemplates((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                className="p-2 rounded-xl border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <textarea
              value={template.body}
              onChange={(event) =>
                setSmsTemplates((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, body: event.target.value.slice(0, 640) } : item
                  )
                )
              }
              rows={4}
              placeholder="Template message"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] resize-none"
            />

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                <input
                  type="checkbox"
                  checked={template.isActive}
                  onChange={(event) =>
                    setSmsTemplates((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isActive: event.target.checked } : item
                      )
                    )
                  }
                />
                Active in dropdown
              </label>
              <span className="text-[11px] text-[#94A3B8]">{template.body.length}/640</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setSmsTemplates((current) => [
              ...current,
              {
                id: `template-${Date.now()}`,
                title: '',
                body: '',
                isActive: true,
              },
            ])
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569]"
        >
          <Plus size={14} />
          Add Template
        </button>

        <button
          type="button"
          onClick={handleSaveSmsTemplates}
          disabled={smsTemplateSaving}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ${
            smsTemplateSaving ? 'bg-[#CBD5E1] text-white cursor-not-allowed' : 'bg-[#1D4ED8] text-white'
          }`}
        >
          {smsTemplateSaving ? 'Saving...' : 'Save Templates'}
        </button>
      </div>
    </SectionShell>
  )

  const renderActiveSection = () => {
    switch (active) {
      case 'profile':
        return renderProfileSection()
      case 'notifications':
        return renderNotificationsSection()
      case 'team':
        return renderTeamSection()
      case 'routing':
        return renderRoutingSection()
      case 'leadfields':
        return <LeadFieldsSection onSave={handleSave} />
      case 'cities':
        return <CitiesSection onSave={handleSave} />
      case 'sources':
        return <SourcesSection onSave={handleSave} />
      case 'features':
        return renderFeaturesSection()
      case 'sms-templates':
        return renderSmsTemplatesSection()
      case 'security':
        return renderSecuritySection()
      default:
        return renderProfileSection()
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-5 py-3">
        <h1 className="text-base font-bold text-[#0F172A]">Settings</h1>
        <p className="text-xs text-[#64748B] mt-0.5">Manage your profile, team, lead assignment, and CRM configuration.</p>
      </div>

      <div className="p-4 grid grid-cols-[220px_1fr] gap-4">
        <aside className="bg-white rounded-xl border border-[#E2E8F0] p-3 h-fit shadow-sm">
          <div className="space-y-0.5">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = active === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActive(section.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'text-[#475569] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-xs font-semibold">
                    <Icon size={14} />
                    {section.label}
                  </span>
                  <ChevronRight size={13} />
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-w-0">
          {renderActiveSection()}
        </main>
      </div>
    </div>
  )
}

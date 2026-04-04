import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import { settingsAPI, type FeatureControls, type LeadFieldConfig, type LeadFieldKey, type SmsTemplate } from '../api/settings'
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">Lead Fields</h2>
        <p className="text-sm text-[#64748B]">Manage the real lead form fields used across manual leads and lead detail screens.</p>
      </div>

      {successMessage ? (
        <div className="px-4 py-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] text-sm font-medium text-[#166534]">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Configured Fields</p>
              <p className="text-sm text-[#94A3B8] mt-1">Add, edit, reorder, or remove lead fields from the CRM form.</p>
            </div>
            <div className="text-xs font-semibold text-[#64748B]">
              {editableFields.length} fields
            </div>
          </div>

          <div className="space-y-3">
            {visibleFields.map((field, index) => {
              const canRemove = !['name', 'phone', 'city'].includes(field.key)
              const supportsOptions = field.key === 'buildType' || field.key === 'plotSizeUnit'

              return (
                <div key={field.key} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">{field.label}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#E2E8F0] text-[#475569]">
                          {field.key}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#E2E8F0] text-[#475569] capitalize">
                          {field.section}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#E2E8F0] text-[#475569] capitalize">
                          {field.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveField(field.key, 'up')}
                        disabled={index === 0}
                        className="p-2 rounded-xl border border-[#E2E8F0] text-[#475569] disabled:opacity-40"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(field.key, 'down')}
                        disabled={index === visibleFields.length - 1}
                        className="p-2 rounded-xl border border-[#E2E8F0] text-[#475569] disabled:opacity-40"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(field.key)}
                        disabled={!canRemove}
                        className="p-2 rounded-xl border border-[#FECACA] text-[#DC2626] disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Label</span>
                      <input
                        value={field.label}
                        onChange={(event) => updateField(field.key, { label: event.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Placeholder</span>
                      <input
                        value={field.placeholder || ''}
                        onChange={(event) => updateField(field.key, { placeholder: event.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm"
                        disabled={field.key === 'city' || field.key === 'plotOwned'}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={['name', 'phone', 'city'].includes(field.key)}
                        onChange={(event) => updateField(field.key, { required: event.target.checked })}
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
                      <input
                        type="checkbox"
                        checked={field.active}
                        disabled={['name', 'phone', 'city'].includes(field.key)}
                        onChange={(event) => updateField(field.key, { active: event.target.checked })}
                      />
                      Show in forms
                    </label>
                  </div>

                  {supportsOptions ? (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Dropdown Options</span>
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
                              className="flex-1 px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const nextOptions = (field.options || []).filter((_, idx) => idx !== optionIndex)
                                updateField(field.key, { options: nextOptions })
                              }}
                              disabled={(field.options || []).length <= 1}
                              className="p-2 rounded-xl border border-[#FECACA] text-[#DC2626] disabled:opacity-30"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => updateField(field.key, { options: [...(field.options || []), ''] })}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-[#475569]"
                      >
                        <Plus size={13} />
                        Add Option
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

                  {missingFieldOptions.length ? (
            <div className="pt-4 border-t border-[#E2E8F0] flex flex-col md:flex-row items-start md:items-end gap-3">
              <label className="flex-1 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Restore Hidden Field</span>
                <select
                  value={newFieldKey}
                  onChange={(event) => setNewFieldKey(event.target.value as LeadFieldKey | '')}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm"
                >
                  <option value="">Select a lead field</option>
                  {missingFieldOptions.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={addField}
                disabled={!newFieldKey}
                className="px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                Add Field
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] text-white rounded-xl font-semibold text-sm disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Lead Fields'}
      </button>
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
        }

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
        {renderNotificationToggle('reminderAlerts', 'Reminder Alerts', 'Get email reminders when a follow-up becomes due soon or overdue.')}
        {renderNotificationToggle('missedCallAlerts', 'Missed Call Alerts', 'Get notified when a call ends as missed, busy, or unanswered.')}
        {renderNotificationToggle('assignmentAlerts', 'Assignment Alerts', 'Notify representatives when managers assign a lead to them.')}
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

const renderRoutingSection = () => (
    <SectionShell
      title="Lead Assignment"
      description={
        featureControls.manualAssignment
          ? 'BuildFlow is currently using manager-controlled manual lead assignment.'
          : 'Manual assignment is turned off, so this panel is showing the stored routing fallback.'
      }
    >
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#1D4ED8]">Mode</p>
            <p className="text-sm font-bold text-[#0F172A] mt-2">
              {featureControls.manualAssignment ? 'Manual Assignment' : 'Stored Auto Mode'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Auto Assign</p>
            <p className="text-sm font-bold text-[#0F172A] mt-2">{featureControls.manualAssignment ? 'Disabled' : 'Saved as Enabled'}</p>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Auto Escalate</p>
            <p className="text-sm font-bold text-[#0F172A] mt-2">Disabled</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-[#0F172A]">How the flow works now</p>
          <ul className="space-y-1 text-sm text-[#475569]">
            {featureControls.manualAssignment ? (
              <>
                <li>All new leads land unassigned on the manager Leads page.</li>
                <li>Managers manually assign leads to representatives from Leads and Lead Detail.</li>
                <li>Representatives only see leads assigned to them.</li>
                <li>Queue-based round robin and live queue flows are disabled.</li>
              </>
            ) : (
              <>
                <li>Manual assignment has been switched off from Feature Controls.</li>
                <li>The stored routing mode is preserved as auto for future queue-based logic.</li>
                <li>Use Feature Controls to turn manual assignment back on whenever needed.</li>
              </>
            )}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          await settingsAPI.updateLeadRouting({ offerTimeout: routing.offerTimeout, skipLimit: routing.skipLimit })
          handleSave()
        }}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ${saved ? 'bg-[#16A34A] text-white' : 'bg-[#1D4ED8] text-white'}`}
      >
        {saved ? <><Check size={14} /> Saved</> : 'Reapply Manual Flow'}
      </button>
    </SectionShell>
  )

  const renderFeaturesSection = () => (
    <SectionShell
      title="Feature Controls"
      description="Control the live modules your team can access across BuildFlow."
    >
      <div className="space-y-4">
        {featureError ? (
          <div className="px-4 py-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-medium text-[#B91C1C]">
            {featureError}
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
          {renderFeatureToggle(
            'manualAssignment',
            'Manual Assignment',
            'Keep new leads under manager control until someone assigns them.'
          )}
          {renderFeatureToggle(
            'dialer',
            'Dialer',
            'Turn outbound calling on or off across the sidebar, dialer page, and lead workspace.'
          )}
          {renderFeatureToggle(
            'callRecording',
            'Call Recordings',
            'Allow recording playback and recording requests for Exotel calls inside BuildFlow.'
          )}
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <p className="text-sm font-semibold text-[#0F172A]">Current app behavior</p>
          <ul className="mt-2 space-y-1 text-sm text-[#475569]">
            <li>{featureControls.manualAssignment ? 'Manual lead assignment is active.' : 'Manual lead assignment is turned off.'}</li>
            <li>{featureControls.dialer ? 'Dialer navigation and call placement are enabled.' : 'Dialer navigation and call placement are disabled.'}</li>
            <li>{featureControls.callRecording ? 'Recording playback is available in call-facing screens.' : 'Recording playback is hidden and blocked.'}</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={handleSaveFeatures}
          disabled={featureSaving}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold ${
            featureSaving ? 'bg-[#CBD5E1] text-white cursor-not-allowed' : saved ? 'bg-[#16A34A] text-white' : 'bg-[#1D4ED8] text-white'
          }`}
        >
          {featureSaving ? 'Saving...' : saved ? <><Check size={14} /> Saved</> : 'Save Feature Controls'}
        </button>
      </div>
    </SectionShell>
  )

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

import { client } from './client'
import type { NotificationPrefs, User } from './auth'
import { DEFAULT_NOTIFICATION_PREFS } from './auth'

export type LeadFieldKey =
  | 'name'
  | 'phone'
  | 'city'
  | 'email'
  | 'budget'
  | 'buildType'
  | 'plotOwned'
  | 'campaign'
  | 'plotSize'
  | 'plotSizeUnit'

export interface LeadFieldConfig {
  key: LeadFieldKey
  label: string
  placeholder?: string | null
  type: 'text' | 'email' | 'number' | 'select' | 'boolean'
  section: 'core' | 'qualification'
  options?: string[]
  required: boolean
  active: boolean
  order: number
}

export interface FeatureControls {
  manualAssignment: boolean
  dialer: boolean
  callRecording: boolean
  duplicateDetection: boolean
  autoQueueing: boolean
  smsEnabled: boolean
  whatsappEnabled: boolean
  followUpReminders: boolean
  exportLeads: boolean
  bulkEdit: boolean
  auditLog: boolean
  analyticsAccess: boolean
  representativeCanDelete: boolean
}

export interface SettingsData {
  leadRouting?: {
    mode: 'manual' | 'auto'
    offerTimeout: number
    skipLimit: number
    autoEscalate: boolean
  }
  leadFields: {
    plotSizeUnits: string[]
    defaultUnit: string
    buildTypes: string[]
    fields: LeadFieldConfig[]
  }
  cities: string[]
  sources: string[]
  featureControls: FeatureControls
  notifications?: {
    reminderLeadTime: number
    dailyDigestTime: string
    escalationAlertEnabled: boolean
  }
  smsTemplates?: SmsTemplate[]
}

export interface AppConfigData {
  leadRouting: {
    mode: 'manual' | 'auto'
    offerTimeout: number
    skipLimit: number
    autoEscalate: boolean
  }
  featureControls: FeatureControls
}

export interface SmsTemplate {
  id: string
  title: string
  body: string
  isActive: boolean
}

const normalizeUser = (raw: any): User => ({
  id: String(raw?.id || raw?._id || ''),
  name: raw?.name || '',
  email: raw?.email || '',
  role: raw?.role,
  phone: raw?.phone ?? null,
  callAvailabilityStatus: raw?.callAvailabilityStatus || 'available',
  callDeviceMode: raw?.callDeviceMode || 'phone',
  activeCallSid: raw?.activeCallSid ?? null,
  isActive: raw?.isActive ?? true,
  avatarUrl: raw?.avatarUrl || undefined,
  notificationPrefs: {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(raw?.notificationPrefs || {}),
  },
})

export const settingsAPI = {
  getMyProfile: async (): Promise<{ success: boolean; data: User }> => {
    const response = await client.get('/settings/me')
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    }
  },

  updateMyProfile: async (
    data: Partial<User> & {
      notificationPrefs?: Partial<NotificationPrefs>
    }
  ): Promise<{ success: boolean; data: User }> => {
    const response = await client.patch('/settings/me', data)
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    }
  },

  getSmsTemplates: async (): Promise<{ success: boolean; data: SmsTemplate[] }> => {
    const response = await client.get('/settings/sms-templates')
    return response.data
  },

  updateSmsTemplates: async (
    templates: SmsTemplate[]
  ): Promise<{ success: boolean; data: SmsTemplate[] }> => {
    const response = await client.put('/settings/sms-templates', { templates })
    return response.data
  },

  updateLeadRouting: async (data: { offerTimeout: string | number; skipLimit: string | number }) => {
    const response = await client.patch('/settings/lead-routing', data)
    return response.data
  },

  getSettings: async () => {
    const response = await client.get('/settings')
    return response.data as { success: boolean; data: SettingsData }
  },

  getAppConfig: async () => {
    const response = await client.get('/settings/app-config')
    return response.data as { success: boolean; data: AppConfigData }
  },

  updateCities: async (cities: string[]) => {
    const response = await client.patch('/settings/cities', { cities })
    return response.data
  },

  updateSources: async (sources: string[]) => {
    const response = await client.patch('/settings/sources', { sources })
    return response.data
  },

  updateLeadFields: async (data: {
    fields?: LeadFieldConfig[]
    plotSizeUnits?: string[]
    defaultUnit?: string
    buildTypes?: string[]
  }) => {
    const response = await client.patch('/settings/lead-fields', data)
    return response.data as { success: boolean; data: SettingsData }
  },

  updateFeatureControls: async (data: Partial<FeatureControls>) => {
    const response = await client.patch('/settings/feature-controls', data)
    return response.data as { success: boolean; data: SettingsData }
  },
}

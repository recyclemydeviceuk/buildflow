import { client } from './client'
import { UserRole } from '../App'

export interface NotificationPrefs {
  newLeadAlerts: boolean
  reminderAlerts: boolean
  missedCallAlerts: boolean
  assignmentAlerts: boolean
  dailyDigest: boolean
  loginAlerts: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newLeadAlerts: true,
  reminderAlerts: true,
  missedCallAlerts: true,
  assignmentAlerts: true,
  dailyDigest: false,
  loginAlerts: false,
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  phone?: string | null
  callAvailabilityStatus?: 'available' | 'offline' | 'in-call'
  callDeviceMode?: 'phone' | 'web'
  activeCallSid?: string | null
  isActive?: boolean
  avatarUrl?: string
  notificationPrefs?: NotificationPrefs
}

export interface AuthResponse {
  success: boolean
  data: {
    accessToken: string
    refreshToken: string
    user: User
  }
}

export interface ChangePasswordResponse {
  success: boolean
  message: string
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

export const authAPI = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await client.post('/auth/login', { 
      email: email.trim().toLowerCase(), 
      password 
    })
    return {
      ...response.data,
      data: {
        ...response.data.data,
        user: normalizeUser(response.data.data.user),
      },
    }
  },
  
  getMe: async (): Promise<{ success: boolean; data: User }> => {
    const response = await client.get('/auth/me')
    return {
      ...response.data,
      data: normalizeUser(response.data.data),
    }
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> => {
    const response = await client.patch('/auth/change-password', {
      currentPassword,
      newPassword,
    })
    return response.data
  },
  
  logout: async (): Promise<void> => {
    await client.post('/auth/logout')
  }
}

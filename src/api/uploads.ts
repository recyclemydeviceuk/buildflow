import { client } from './client'
import type { User } from './auth'

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
  isDemo: Boolean(raw?.isDemo),
  avatarUrl: raw?.avatarUrl || undefined,
})

export const uploadsAPI = {
  uploadAvatar: async (file: File): Promise<{ success: boolean; data: { avatarUrl: string; user: User } }> => {
    const formData = new FormData()
    formData.append('avatar', file)

    const response = await client.post('/uploads/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return {
      ...response.data,
      data: {
        avatarUrl: response.data.data.avatarUrl,
        user: normalizeUser(response.data.data.user),
      },
    }
  },

  deleteAvatar: async (): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete('/uploads/avatar')
    return response.data
  },
}

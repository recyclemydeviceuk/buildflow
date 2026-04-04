import { client } from './client'
import { User } from './auth'

export interface TeamMember extends User {
  phone?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  temporaryPassword?: string
}

const normalizeTeamMember = (raw: any): TeamMember => ({
  id: String(raw?.id || raw?._id || ''),
  name: raw?.name || '',
  email: raw?.email || '',
  role: raw?.role,
  phone: raw?.phone || '',
  isActive: raw?.isActive ?? true,
  avatarUrl: raw?.avatarUrl || undefined,
  callAvailabilityStatus: raw?.callAvailabilityStatus || 'available',
  callDeviceMode: raw?.callDeviceMode || 'phone',
  activeCallSid: raw?.activeCallSid ?? null,
  lastLoginAt: raw?.lastLoginAt,
  createdAt: raw?.createdAt || new Date().toISOString(),
  temporaryPassword: raw?.temporaryPassword,
})

export const teamAPI = {
  getTeamMembers: async (): Promise<{ success: boolean; data: TeamMember[] }> => {
    const response = await client.get('/settings/team')
    return {
      ...response.data,
      data: (response.data.data || []).map(normalizeTeamMember),
    }
  },

  createTeamMember: async (data: Partial<TeamMember>): Promise<{ success: boolean; data: TeamMember }> => {
    const response = await client.post('/settings/team', data)
    return {
      ...response.data,
      data: normalizeTeamMember(response.data.data),
    }
  },

  updateTeamMember: async (id: string, data: Partial<TeamMember>): Promise<{ success: boolean; data: TeamMember }> => {
    const response = await client.patch(`/settings/team/${id}`, data)
    return {
      ...response.data,
      data: normalizeTeamMember(response.data.data),
    }
  },

  deactivateTeamMember: async (id: string): Promise<{ success: boolean; data: TeamMember }> => {
    const response = await client.patch(`/settings/team/${id}/deactivate`)
    return response.data
  },

  activateTeamMember: async (id: string): Promise<{ success: boolean; data: TeamMember }> => {
    const response = await client.patch(`/settings/team/${id}/activate`)
    return response.data
  },

  deleteTeamMember: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/settings/team/${id}`)
    return response.data
  },

  resetMemberPassword: async (id: string, newPassword?: string): Promise<{ success: boolean; data: { temporaryPassword: string } }> => {
    const response = await client.patch(`/settings/team/${id}/password`, { newPassword })
    return response.data
  },
}

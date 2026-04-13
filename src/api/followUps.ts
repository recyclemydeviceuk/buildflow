import { client } from './client'

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled'

export interface FollowUpNotificationState {
  confirmedAt?: string | null
  lastPromptAt?: string | null
}

export interface FollowUpRecord {
  _id: string
  lead: string
  leadName: string
  owner: string
  ownerName: string
  scheduledAt: string
  notes?: string | null
  status: FollowUpStatus
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  notificationState?: FollowUpNotificationState | null
}

export interface FollowUpsResponse {
  success: boolean
  data: FollowUpRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export const followUpsAPI = {
  getFollowUps: async (params?: {
    owner?: string
    page?: string
    limit?: string
    search?: string
    status?: FollowUpStatus
  }): Promise<FollowUpsResponse> => {
    const response = await client.get('/follow-ups', { params })
    return response.data
  },

  getNextPopup: async (): Promise<{ success: boolean; data: FollowUpRecord | null }> => {
    const response = await client.get('/follow-ups/notifications/next')
    return response.data
  },

  confirmPopup: async (id: string): Promise<{ success: boolean; data: FollowUpRecord }> => {
    const response = await client.patch(`/follow-ups/${id}/notifications/confirm`)
    return response.data
  },

  skipPopup: async (id: string): Promise<{ success: boolean; data: FollowUpRecord }> => {
    const response = await client.patch(`/follow-ups/${id}/notifications/skip`)
    return response.data
  },
}

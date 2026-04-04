import { client } from './client'

export type QueueSegment = 'Unassigned' | 'Timed Out' | 'Skipped' | 'Escalated'
export type QueueStatus = 'waiting' | 'offered' | 'assigned' | 'on_hold' | 'completed' | 'invalid'

export interface QueueItem {
  _id: string
  leadId: string
  leadName: string
  phone: string
  city: string
  source: string
  segment: QueueSegment
  status: QueueStatus
  urgency: number
  skipCount: number
  holdUntil?: string | null
  notes?: string | null
  offeredToName?: string | null
  assignedToName?: string | null
  createdAt: string
}

export interface QueueResponse<T> {
  success: boolean
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export const queueAPI = {
  getQueue: async (params?: { segment?: QueueSegment; page?: string; limit?: string }): Promise<QueueResponse<QueueItem[]>> => {
    const query: Record<string, string> = {}
    if (params?.segment) query.segment = params.segment
    if (params?.page) query.page = params.page
    if (params?.limit) query.limit = params.limit

    const response = await client.get('/queue', { params: query })
    return response.data
  },

  getLiveQueue: async (): Promise<QueueResponse<QueueItem[]>> => {
    const response = await client.get('/queue/live')
    return response.data
  },

  assignQueueItem: async (id: string, data: { assignedTo: string; assignedName: string }): Promise<QueueResponse<QueueItem>> => {
    const response = await client.patch(`/queue/${id}/assign`, data)
    return response.data
  },

  requeueItem: async (id: string): Promise<QueueResponse<QueueItem>> => {
    const response = await client.patch(`/queue/${id}/requeue`)
    return response.data
  },

  holdQueueItem: async (id: string, holdUntilISO: string): Promise<QueueResponse<QueueItem>> => {
    const response = await client.patch(`/queue/${id}/hold`, { holdUntil: holdUntilISO })
    return response.data
  },

  markInvalid: async (id: string, reason: string): Promise<QueueResponse<QueueItem>> => {
    const response = await client.patch(`/queue/${id}/invalid`, { reason })
    return response.data
  },

  skipQueueItem: async (id: string): Promise<QueueResponse<QueueItem>> => {
    const response = await client.patch(`/queue/${id}/skip`)
    return response.data
  },
}


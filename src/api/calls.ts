import { client } from './client'

export interface Call {
  _id: string
  exotelCallSid?: string
  exophoneNumber?: string | null
  exotelStatusRaw?: string | null
  // Backend `getCalls()` populates `lead`, so this can be either a string id or a populated object.
  lead: string | { _id: string }
  leadName: string
  phone: string
  representative: string
  representativeName: string
  status: string
  representativeLegStatus?: string | null
  customerLegStatus?: string | null
  representativeAnswered?: boolean | null
  customerAnswered?: boolean | null
  // Backend uses `incoming` / `outbound`
  direction: 'incoming' | 'outbound'
  outcome?: string
  duration?: number
  recordingRequested?: boolean | null
  recordingUrl?: string
  transcript?: { speaker: 'rep' | 'lead'; text: string; timestamp: string }[]
  summary?: string
  feedback?: { rating: number; notes: string; disposition: string }
  startedAt: string
  endedAt?: string
  createdAt: string
}

export interface SmsMessage {
  _id: string
  lead: string
  call?: string | null
  phone: string
  from: string
  to: string
  body: string
  direction: 'outbound'
  provider: 'Exotel'
  providerMessageSid?: string | null
  status: 'queued' | 'sending' | 'submitted' | 'sent' | 'failed-dnd' | 'failed'
  detailedStatus?: string | null
  detailedStatusCode?: string | null
  customField?: string | null
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface InitiateCallPayload {
  leadId?: string
  phone?: string
  leadName?: string
  city?: string
  representativeId?: string
  agentPhone?: string
  recordCall?: boolean
}

export interface CallsResponse {
  success: boolean
  data: Call[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface CallFilters {
  page?: string
  limit?: string
  outcome?: string
  direction?: string
  representative?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export const callsAPI = {
  getCalls: async (params?: CallFilters): Promise<CallsResponse> => {
    const response = await client.get('/calls', { params })
    return response.data
  },

  syncCall: async (callSid: string): Promise<{ success: boolean; data: Call | null }> => {
    const response = await client.post(`/calls/${callSid}/sync`)
    return response.data
  },

  getCallById: async (id: string): Promise<{ success: boolean; data: Call }> => {
    const response = await client.get(`/calls/${id}`)
    return response.data
  },

  getCallsByLead: async (leadId: string): Promise<{ success: boolean; data: Call[] }> => {
    const response = await client.get(`/calls/lead/${leadId}`)
    return response.data
  },

  getMessagesForCall: async (id: string): Promise<{ success: boolean; data: SmsMessage[] }> => {
    const response = await client.get(`/calls/${id}/messages`)
    return response.data
  },

  sendMessageForCall: async (
    id: string,
    body: string
  ): Promise<{ success: boolean; data: SmsMessage; message?: string }> => {
    const response = await client.post(`/calls/${id}/messages`, { body })
    return response.data
  },

  initiateCall: async (
    payloadOrLeadId: InitiateCallPayload | string,
    agentPhone?: string
  ): Promise<{ success: boolean; data: Call }> => {
    const payload =
      typeof payloadOrLeadId === 'string'
        ? { leadId: payloadOrLeadId, agentPhone }
        : payloadOrLeadId

    const response = await client.post('/calls/initiate', payload)
    return response.data
  },

  postCallFeedback: async (
    id: string,
    feedback: {
      outcome?: string
      notes?: string
      disposition?: string
      nextFollowUp?: string | null
      followUpAt?: string | null
    }
  ): Promise<{ success: boolean; data: Call }> => {
    const response = await client.patch(`/calls/${id}/feedback`, feedback)
    return response.data
  },

  syncCalls: async (params?: { days?: number; dateFrom?: string; dateTo?: string }): Promise<{
    success: boolean
    message: string
    createdCount: number
    updatedCount: number
    fetchedCount: number
  }> => {
    const response = await client.post('/calls/sync', null, { params })
    return response.data
  },

  purgeOrphanedCalls: async (): Promise<{
    success: boolean
    message: string
    orphanedRemoved: number
    duplicatesRemoved: number
  }> => {
    const response = await client.post('/calls/purge-orphaned')
    return response.data
  },

  getRecordingUrl: (id: string): string => {
    const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api'
    const token = localStorage.getItem('token')
    return `${baseURL}/calls/${id}/recording${token ? `?token=${token}` : ''}`
  },

  reconcileStatuses: async (): Promise<{ success: boolean; fixed: number }> => {
    const response = await client.post('/calls/reconcile-statuses')
    return response.data
  },
}

import { client } from './client'
import type { LeadFieldConfig } from './settings'

export type Disposition = 'New' | 'Contacted/Open' | 'Qualified' | 'Visit Done' | 'Meeting Done' | 'Negotiation Done' | 'Booking Done' | 'Agreement Done' | 'Failed'

export interface LeadStatusNote {
  _id?: string
  status: Disposition | string
  note: string
  createdAt: string
  createdBy?: string | null
  createdByName?: string | null
}

export interface FollowUp {
  _id: string
  lead: string
  leadName: string
  owner: string
  ownerName: string
  scheduledAt: string
  notes?: string | null
  status: 'pending' | 'completed' | 'cancelled'
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Lead {
  _id: string
  name: string
  phone: string
  alternatePhone?: string | null
  email?: string | null
  city: string
  source: string
  disposition: Disposition
  meetingType?: 'VC' | 'Client Place' | null
  meetingLocation?: string | null
  failedReason?: string | null
  // Booking Done fields
  bookingPackage?: string | null
  proposedProjectValue?: string | null
  bookingAmountCollected?: string | null
  bookingDate?: string | null
  numberOfFloors?: string | null
  assignedArchitect?: string | null
  // Agreement Done fields
  agreementProjectValue?: string | null
  agreementDate?: string | null
  agreementAmount?: string | null
  totalCollection?: string | null
  owner?: string | null
  ownerName?: string | null
  budget?: string | null
  plotSize?: string | number | null
  plotSizeUnit?: string | null
  plotOwned?: boolean | null
  buildType?: string | null
  campaign?: string | null
  campaignId?: string | null
  lastActivity?: string | null
  lastActivityNote?: string | null
  nextFollowUp?: string | null
  tags: string[]
  notes?: string | null
  statusNotes?: LeadStatusNote[]
  // UTM / attribution tracking fields
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
  googleClickId?: string | null
  /** All raw form fields captured from the website submission (label → value) */
  websiteFormData?: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

export interface LeadsResponse {
  success: boolean
  data: Lead[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface LeadResponse {
  success: boolean
  data: Lead
}

export interface LeadFiltersResponse {
  success: boolean
  data: {
    cities: string[]
    sources: string[]
    dispositions: string[]
    owners: { id: string; name: string }[]
    leadFields: {
      plotSizeUnits: string[]
      defaultUnit: string
      buildTypes: string[]
      fields: LeadFieldConfig[]
    }
  }
}

export interface PhoneLeadLookupItem {
  exists: boolean
  lead: Pick<Lead, '_id' | 'name' | 'phone' | 'alternatePhone' | 'city' | 'source' | 'disposition'> | null
}

export interface PhoneLeadLookupResponse {
  success: boolean
  data: Record<string, PhoneLeadLookupItem>
}

export interface BulkDeleteLeadsResponse {
  success: boolean
  message: string
  data: {
    deletedIds: string[]
    deletedCount: number
    skippedIds: string[]
    skippedCount: number
  }
}

export interface BulkUpdateLeadsPayload {
  ids: string[]
  source?: string
  disposition?: string
  owner?: string | null
  createdAt?: string
  statusNote?: string
}

export interface BulkUpdateLeadsResponse {
  success: boolean
  message: string
  data: {
    updatedIds: string[]
    updatedCount: number
    skippedIds: string[]
    skippedCount: number
  }
}

export const leadsAPI = {
  getLeads: async (params?: Record<string, string>): Promise<LeadsResponse> => {
    const response = await client.get('/leads', { params })
    return response.data
  },

  getLeadFilters: async (): Promise<LeadFiltersResponse> => {
    const response = await client.get('/leads/filters')
    return response.data
  },

  getLeadById: async (id: string): Promise<LeadResponse> => {
    const response = await client.get(`/leads/${id}`)
    return response.data
  },

  lookupByPhone: async (phones: string[]): Promise<PhoneLeadLookupResponse> => {
    const response = await client.post('/leads/lookup-by-phone', { phones })
    return response.data
  },

  createLead: async (data: Partial<Lead>): Promise<LeadResponse> => {
    const response = await client.post('/leads', data)
    return response.data
  },

  updateLead: async (id: string, data: Partial<Lead>): Promise<LeadResponse> => {
    const response = await client.put(`/leads/${id}`, data)
    return response.data
  },

  deleteLead: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/leads/${id}`)
    return response.data
  },

  bulkDeleteLeads: async (ids: string[]): Promise<BulkDeleteLeadsResponse> => {
    const response = await client.post('/leads/bulk-delete', { ids })
    return response.data
  },

  bulkUpdateLeads: async (data: BulkUpdateLeadsPayload): Promise<BulkUpdateLeadsResponse> => {
    const response = await client.post('/leads/bulk-update', data)
    return response.data
  },

  assignLead: async (id: string, userId: string | null): Promise<LeadResponse> => {
    const response = await client.patch(`/leads/${id}/assign`, { userId })
    return response.data
  },

  updateDisposition: async (id: string, disposition: string, notes?: string): Promise<LeadResponse> => {
    const response = await client.patch(`/leads/${id}/disposition`, { disposition, notes })
    return response.data
  },

  addStatusNote: async (id: string, status: string, note: string): Promise<LeadResponse> => {
    const response = await client.patch(`/leads/${id}/status-notes`, { status, note })
    return response.data
  },

  updateStatusNote: async (id: string, noteId: string, status: string, note: string): Promise<LeadResponse> => {
    const response = await client.patch(`/leads/${id}/status-notes/${noteId}`, { status, note })
    return response.data
  },

  deleteStatusNote: async (id: string, noteId: string): Promise<LeadResponse> => {
    const response = await client.delete(`/leads/${id}/status-notes/${noteId}`)
    return response.data
  },

  exportLeads: async (data: { dateRange: string; fields?: string[]; format?: string; owner?: string }): Promise<Blob> => {
    const response = await client.post('/leads/export', data, { responseType: 'blob' })
    return response.data
  },

  // Follow-up methods
  getLeadFollowUps: async (id: string): Promise<{ success: boolean; data: FollowUp[] }> => {
    const response = await client.get(`/leads/${id}/follow-ups`)
    return response.data
  },

  createFollowUp: async (id: string, data: { scheduledAt: string; notes?: string }): Promise<{ success: boolean; data: FollowUp }> => {
    const response = await client.post(`/leads/${id}/follow-ups`, data)
    return response.data
  },

  updateFollowUp: async (id: string, followUpId: string, data: { scheduledAt?: string; notes?: string; status?: 'pending' | 'completed' | 'cancelled' }): Promise<{ success: boolean; data: FollowUp }> => {
    const response = await client.patch(`/leads/${id}/follow-ups/${followUpId}`, data)
    return response.data
  },

  deleteFollowUp: async (id: string, followUpId: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/leads/${id}/follow-ups/${followUpId}`)
    return response.data
  },
}

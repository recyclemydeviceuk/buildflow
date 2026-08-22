import { client } from './client'

export interface AuditLogRow {
  _id: string
  actor: string
  actorName: string
  actorRole: string
  action: string
  entity: string
  entityId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export type LeadTransferType = 'assignment' | 'transfer' | 'unassignment'

export interface LeadTransferHistoryRow {
  id: string
  leadId: string
  leadName: string
  leadPhone: string
  performedBy: {
    id: string | null
    name: string
    role: string
  }
  from: { id: string | null; name: string } | null
  to: { id: string | null; name: string } | null
  type: LeadTransferType
  source: 'direct' | 'bulk' | 'queue' | 'assistant' | 'call' | 'declined' | 'legacy'
  action: string
  createdAt: string
}

export interface LeadTransferHistoryResponse {
  success: boolean
  data: LeadTransferHistoryRow[]
  pagination: AuditLogsResponse['pagination']
}

export interface AuditLogsResponse {
  success: boolean
  data: AuditLogRow[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface AuditLogFiltersResponse {
  success: boolean
  data: {
    actions: string[]
    roles: string[]
    leadStatuses: string[]
  }
}

export const auditAPI = {
  getAuditLogs: async (params?: {
    page?: string
    limit?: string
    actor?: string
    actorRole?: string
    action?: string
    leadStatus?: string
    entity?: string
    entityId?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }): Promise<AuditLogsResponse> => {
    const response = await client.get('/audit-logs', { params })
    return response.data
  },

  getAuditLogFilters: async (): Promise<AuditLogFiltersResponse> => {
    const response = await client.get('/audit-logs/filters')
    return response.data
  },

  getLeadTransferHistory: async (params?: {
    page?: string
    limit?: string
    search?: string
    type?: LeadTransferType
    actorRole?: 'manager' | 'representative'
    dateFrom?: string
    dateTo?: string
  }): Promise<LeadTransferHistoryResponse> => {
    const response = await client.get('/audit-logs/transfers', { params })
    return response.data
  },
}

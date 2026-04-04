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
}


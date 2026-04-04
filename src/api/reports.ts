import { client } from './client'

export interface LeadPipelineReport {
  byDisposition: { _id: string; count: number }[]
  bySource: { _id: string; count: number }[]
  byCity: { _id: string; count: number }[]
}

export interface CallActivityReport {
  byOutcome: { _id: string; count: number }[]
  byRep: { _id: string; name: string; total: number; connected: number; totalDuration: number }[]
  dailyVolume: { _id: string; count: number; connected: number }[]
}

export const reportsAPI = {
  getLeadPipelineReport: async (params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data: LeadPipelineReport }> => {
    const response = await client.get('/reports/lead-pipeline', { params })
    return response.data
  },

  getCallActivityReport: async (params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data: CallActivityReport }> => {
    const response = await client.get('/reports/call-activity', { params })
    return response.data
  },

  exportLeadsCSV: async (params?: { dateFrom?: string; dateTo?: string; source?: string; disposition?: string }): Promise<Blob> => {
    const response = await client.get('/reports/export/leads', {
      params,
      responseType: 'blob',
    })
    return response.data
  },

  exportCallsCSV: async (params?: { dateFrom?: string; dateTo?: string; representative?: string }): Promise<Blob> => {
    const response = await client.get('/reports/export/calls', {
      params,
      responseType: 'blob',
    })
    return response.data
  },
}


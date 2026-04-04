import { client } from './client'
import type { Lead } from './leads'
import type { Reminder } from './reminders'

export interface KPIResponse {
  success: boolean
  data: {
    totalLeads: number
    qualifiedLeads: number
    wonLeads: number
    totalCalls: number
    connectedCalls: number
    conversionRate: number
    callConnectRate: number
  }
}

export interface RepDashboardResponse {
  success: boolean
  data: {
    summary: {
      id: string
      name: string
      phone: string
      avatarUrl?: string | null
      callsToday: number
      connectedCallsToday: number
      leadsAssigned: number
      leadsContacted: number
      qualifiedThisWeek: number
      overdueReminders: number
      dueSoonReminders: number
      activeReminders: number
      score: number
      rank: number
    } | null
    callsTarget: number
    manualAssignmentEnabled: boolean
    leads: Lead[]
    reminders: Reminder[]
    leaderboard: Array<{
      id: string
      name: string
      phone: string
      avatarUrl?: string | null
      callsToday: number
      connectedCallsToday: number
      leadsAssigned: number
      leadsContacted: number
      qualifiedThisWeek: number
      overdueReminders: number
      dueSoonReminders: number
      activeReminders: number
      score: number
      rank: number
    }>
  }
}

export interface RepPerformanceDashboardResponse {
  success: boolean
  data: {
    summary: {
      totalCalls: number
      connectedCalls: number
      qualifiedLeads: number
      wonLeads: number
      conversionRate: number
      avgCallDuration: number
    }
    sourcePerformance: Array<{
      source: string
      totalLeads: number
      qualifiedLeads: number
      wonLeads: number
      conversionRate: number
    }>
    leaderboard: Array<{
      id: string
      representativeName: string
      phone: string
      avatarUrl?: string | null
      totalCalls: number
      connectedCalls: number
      qualifiedLeads: number
      wonLeads: number
      conversionRate: number
      avgDuration: number
      score: number
      rank: number
    }>
  }
}

export const analyticsAPI = {
  getKPIs: async (params?: { dateFrom?: string; dateTo?: string }): Promise<KPIResponse> => {
    const response = await client.get('/analytics/kpis', { params })
    return response.data
  },

  getSourcePerformance: async (params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data: any }> => {
    const response = await client.get('/analytics/source-performance', { params })
    return response.data
  },

  getUtmPerformance: async (params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data: any }> => {
    const response = await client.get('/analytics/utm-performance', { params })
    return response.data
  },

  getConversionFunnel: async (params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data: any }> => {
    const response = await client.get('/analytics/conversion-funnel', { params })
    return response.data
  },

  getRepPerformance: async (params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data: any }> => {
    const response = await client.get('/analytics/rep-performance', { params })
    return response.data
  },

  getRepDashboard: async (): Promise<RepDashboardResponse> => {
    const response = await client.get('/analytics/rep-dashboard')
    return response.data
  },

  getRepPerformanceDashboard: async (params?: { dateFrom?: string; dateTo?: string }): Promise<RepPerformanceDashboardResponse> => {
    const response = await client.get('/analytics/rep-performance-dashboard', { params })
    return response.data
  },
}

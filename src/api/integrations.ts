import { client } from './client'

export type IntegrationProvider = string
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

export interface Integration {
  _id: string
  provider: IntegrationProvider
  status: IntegrationStatus
  externalAccountId?: string | null
  externalAccountName?: string | null
  connectedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface MetaSyncResponse {
  subscriptions?: Array<{ pageId: string; pageName: string; success: boolean; tasks?: string[] }>
  pages?: Array<{ id: string; name: string; tasks?: string[] }>
  forms?: Array<{ id: string; name: string; pageId: string; pageName: string; status?: string; locale?: string }>
}

export interface MetaLeadImportResponse {
  pages: Array<{ id: string; name: string; tasks?: string[] }>
  forms: Array<{ id: string; name: string; pageId: string; pageName: string; status?: string; locale?: string }>
  totalLeads: number
  importedCount: number
  createdCount: number
  skippedCount: number
}

export const integrationsAPI = {
  getIntegrations: async (): Promise<{ success: boolean; data: Integration[] }> => {
    const response = await client.get('/integrations')
    return response.data
  },

  disconnectIntegration: async (id: string): Promise<{ success: boolean; data: Integration }> => {
    const response = await client.delete(`/integrations/${id}`)
    return response.data
  },

  getMetaConnectUrl: async (): Promise<{ success: boolean; data: { url: string } }> => {
    const response = await client.get('/integrations/meta/connect')
    return response.data
  },

  subscribeMetaPages: async (): Promise<{ success: boolean; data: MetaSyncResponse }> => {
    const response = await client.post('/integrations/meta/subscribe')
    return response.data
  },

  fetchMetaLeads: async (): Promise<{ success: boolean; data: MetaLeadImportResponse }> => {
    const response = await client.post('/integrations/meta/fetch-leads')
    return response.data
  },

  getLinkedInConnectUrl: async (): Promise<{ success: boolean; data: { url: string } }> => {
    const response = await client.get('/integrations/linkedin/connect')
    return response.data
  },

  getGoogleAdsConnectUrl: async (): Promise<{ success: boolean; data: { url: string } }> => {
    const response = await client.get('/integrations/google-ads/connect')
    return response.data
  },
}


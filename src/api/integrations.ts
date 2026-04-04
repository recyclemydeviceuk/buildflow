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

  getLinkedInConnectUrl: async (): Promise<{ success: boolean; data: { url: string } }> => {
    const response = await client.get('/integrations/linkedin/connect')
    return response.data
  },

  getGoogleAdsConnectUrl: async (): Promise<{ success: boolean; data: { url: string } }> => {
    const response = await client.get('/integrations/google-ads/connect')
    return response.data
  },
}


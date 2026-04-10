import { client } from './client'

export interface EmiCalculation {
  _id: string
  userId: string
  userName: string
  loanAmount: number
  interestRate: number
  tenureYears: number
  tenureMonths: number
  monthlyEmi: number
  totalAmount: number
  totalInterest: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface EmiCalculationPayload {
  loanAmount: number
  interestRate: number
  tenureYears: number
  tenureMonths: number
  monthlyEmi: number
  totalAmount: number
  totalInterest: number
  notes?: string | null
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export const emiCalculatorAPI = {
  getCalculations: async (params?: {
    page?: string
    limit?: string
  }): Promise<PaginatedResponse<EmiCalculation[]>> => {
    const response = await client.get('/emi-calculator', { params })
    return response.data
  },

  saveCalculation: async (
    payload: EmiCalculationPayload
  ): Promise<{ success: boolean; data: EmiCalculation }> => {
    const response = await client.post('/emi-calculator', payload)
    return response.data
  },

  deleteCalculation: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/emi-calculator/${id}`)
    return response.data
  },

  sendEmail: async (
    id: string,
    recipientEmail: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await client.post(`/emi-calculator/${id}/send-email`, { recipientEmail })
    return response.data
  },
}

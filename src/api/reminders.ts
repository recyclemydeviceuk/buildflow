import { client } from './client'

export type ReminderStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed'
export type ReminderPriority = 'high' | 'medium' | 'low'

export interface Reminder {
  _id: string
  lead: string
  leadName: string
  owner: string
  ownerName: string
  title: string
  notes?: string | null
  dueAt: string
  priority: ReminderPriority
  status: ReminderStatus
  completedAt?: string | null
  createdAt: string
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

export const remindersAPI = {
  getReminders: async (params?: { status?: ReminderStatus; leadId?: string; page?: string; limit?: string }): Promise<PaginatedResponse<Reminder[]>> => {
    const response = await client.get('/reminders', { params })
    return response.data
  },

  getOverdueReminders: async (): Promise<{ success: boolean; data: Reminder[] }> => {
    const response = await client.get('/reminders/overdue')
    return response.data
  },

  getReminderById: async (id: string): Promise<{ success: boolean; data: Reminder }> => {
    const response = await client.get(`/reminders/${id}`)
    return response.data
  },

  createReminder: async (data: { leadId: string; title: string; dueAt: string; notes?: string | null; priority?: ReminderPriority }): Promise<{ success: boolean; data: Reminder }> => {
    const response = await client.post('/reminders', data)
    return response.data
  },

  updateReminder: async (id: string, data: Partial<{ title: string; notes: string | null; dueAt: string; priority: ReminderPriority; status: ReminderStatus }>): Promise<{ success: boolean; data: Reminder }> => {
    const response = await client.put(`/reminders/${id}`, data)
    return response.data
  },

  deleteReminder: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/reminders/${id}`)
    return response.data
  },

  markReminderDone: async (id: string): Promise<{ success: boolean; data: Reminder }> => {
    const response = await client.patch(`/reminders/${id}/done`)
    return response.data
  },
}


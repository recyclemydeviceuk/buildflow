import { client } from './client'

// Types for performance data
export interface LeadMetrics {
  total: number
  today: number
  week: number
  month: number
  contacted: number
  qualified: number
  visitDone: number
  meetingDone: number
  bookingDone: number
  failed: number
  conversionRate: number
}

export interface CallMetrics {
  total: number
  today: number
  week: number
  month: number
  connected: number
  missed: number
  avgDuration: number
  connectionRate: number
}

export interface RepresentativePerformance {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  callAvailabilityStatus?: string
  lastLoginAt?: string | null
  leads: LeadMetrics
  calls: CallMetrics
  activityScore: number
}

export interface PerformanceSummary {
  totalRepresentatives: number
  totalLeadsAssigned: number
  totalCallsMade: number
  avgConversionRate: number
}

export interface DispositionBreakdown {
  status: string
  count: number
}

export interface SourceBreakdown {
  source: string
  count: number
}

export interface DailyActivity {
  date: string
  calls: number
  connected: number
  avgDuration: number
}

export interface CallOutcome {
  outcome: string
  count: number
}

export interface RecentLead {
  _id: string
  name: string
  phone: string
  city: string
  disposition: string
  source: string
  createdAt: string
}

export interface RecentCall {
  _id: string
  leadName: string
  phone: string
  status: string
  outcome?: string | null
  duration: number
  startedAt?: string | null
  endedAt?: string | null
}

export interface UpcomingReminder {
  id: string
  title: string
  dueAt: string
  status: string
  leadName?: string | null
  leadId?: string | null
}

export interface RepresentativeInfo {
  id: string
  name: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  callAvailabilityStatus?: string
  callDeviceMode?: string
  lastLoginAt?: string | null
  createdAt: string
}

export interface TimeMetrics {
  today: { calls: number; leads: number }
  week: { calls: number; leads: number }
  month: { calls: number; leads: number }
  total: { calls: number; leads: number }
}

export interface LeadAnalytics {
  dispositionBreakdown: DispositionBreakdown[]
  sourceBreakdown: SourceBreakdown[]
  recent: RecentLead[]
}

export interface CallAnalytics {
  outcomes: CallOutcome[]
  recent: RecentCall[]
  dailyActivity: DailyActivity[]
}

export interface RepresentativeDetailPerformance {
  representative: RepresentativeInfo
  timeMetrics: TimeMetrics
  leadAnalytics: LeadAnalytics
  callAnalytics: CallAnalytics
  upcomingReminders: UpcomingReminder[]
}

export const performanceAPI = {
  // Get all representatives performance summary
  getRepresentativesPerformance: async (): Promise<{
    success: boolean
    data: RepresentativePerformance[]
    summary: PerformanceSummary
  }> => {
    const response = await client.get('/performance/representatives')
    return response.data
  },

  // Get detailed performance for a specific representative
  getRepresentativeDetail: async (
    id: string
  ): Promise<{
    success: boolean
    data: RepresentativeDetailPerformance
  }> => {
    const response = await client.get(`/performance/representatives/${id}`)
    return response.data
  },
}

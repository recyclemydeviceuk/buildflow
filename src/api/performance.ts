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

// Turnaround time = how long after a lead is assigned to this rep before
// they make their first contact attempt (first Call record). All durations
// are in seconds. `null` for the percentile values means there is no data yet
// for this rep (e.g. no calls placed on any assigned lead).
export interface TurnaroundStats {
  avgSeconds: number | null
  medianSeconds: number | null
  p90Seconds: number | null
  contactedCount: number
  assignedCount: number
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
  turnaround?: TurnaroundStats
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
  turnaround?: TurnaroundStats
}

// Pretty-print a duration in seconds for the dashboard. Designed for at-a-
// glance reading by managers: "2m 14s", "1h 45m", "3d 2h".
export const formatTurnaround = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  return `${d}d ${h}h`
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

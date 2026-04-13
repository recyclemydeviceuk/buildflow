import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Target,
  TrendingUp,
  Clock,
  Calendar,
  User,
  Mail,
  PhoneCall,
  Activity,
  BarChart3,
  PieChart,
  Clock3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { performanceAPI, type RepresentativeDetailPerformance } from '../api/performance'
import { useAuth } from '../context/AuthContext'

const MetricCard = ({
  label,
  value,
  subValue,
  icon: Icon,
  color,
  trend,
}: {
  label: string
  value: string | number
  subValue?: string
  icon: React.ElementType
  color: string
  trend?: 'up' | 'down' | 'neutral'
}) => (
  <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-[#0F172A] mt-1">{value}</p>
        {subValue && <p className="text-xs text-[#64748B] mt-0.5">{subValue}</p>}
      </div>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
    {trend && (
      <div className="mt-2 flex items-center gap-1">
        {trend === 'up' ? (
          <TrendingUp size={14} className="text-[#10B981]" />
        ) : trend === 'down' ? (
          <TrendingUp size={14} className="text-[#EF4444] rotate-180" />
        ) : null}
        <span
          className={`text-xs ${
            trend === 'up' ? 'text-[#10B981]' : trend === 'down' ? 'text-[#EF4444]' : 'text-[#64748B]'
          }`}
        >
          {trend === 'up' ? 'Above average' : trend === 'down' ? 'Below average' : 'Average'}
        </span>
      </div>
    )}
  </div>
)

const SectionCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) => (
  <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
    <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
      <Icon size={18} className="text-[#1D4ED8]" />
      <h3 className="font-semibold text-[#0F172A]">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
)

const ProgressBar = ({ value, total, color }: { value: number; total: number; color: string }) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="w-full bg-[#F1F5F9] rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default function TeamPerformanceDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<RepresentativeDetailPerformance | null>(null)

  useEffect(() => {
    if (user?.role !== 'manager') {
      navigate('/dashboard')
      return
    }

    if (id) {
      fetchPerformanceDetail()
    }
  }, [id, user, navigate])

  const fetchPerformanceDetail = async () => {
    if (!id) return
    try {
      setLoading(true)
      const response = await performanceAPI.getRepresentativeDetail(id)
      if (response.success) {
        setData(response.data)
      }
    } catch (err) {
      setError('Failed to load representative performance data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#64748B]">
          <Loader2 size={20} className="animate-spin" />
          Loading performance data...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 border border-[#FECACA] text-center">
          <p className="text-[#DC2626] font-medium">{error || 'Representative not found'}</p>
          <button
            onClick={() => navigate('/performance')}
            className="mt-3 px-4 py-2 bg-[#1D4ED8] text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Back to Team Performance
          </button>
        </div>
      </div>
    )
  }

  const { representative, timeMetrics, leadAnalytics, callAnalytics, upcomingReminders } = data

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/performance')}
              className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-[#64748B]" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">Performance Report</h1>
              <p className="text-sm text-[#64748B]">Detailed metrics and analytics</p>
            </div>
          </div>
          <button
            onClick={fetchPerformanceDetail}
            className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className="text-[#64748B]" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Representative Profile Card */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-xl font-semibold">
                  {representative.avatarUrl ? (
                    <img
                      src={representative.avatarUrl}
                      alt={representative.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User size={28} />
                  )}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                    representative.callAvailabilityStatus === 'available'
                      ? 'bg-[#10B981]'
                      : representative.callAvailabilityStatus === 'in-call'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#94A3B8]'
                  }`}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">{representative.name}</h2>
                <div className="flex items-center gap-4 text-sm text-[#64748B] mt-1">
                  <span className="flex items-center gap-1">
                    <Mail size={14} />
                    {representative.email}
                  </span>
                  {representative.phone && (
                    <span className="flex items-center gap-1">
                      <PhoneCall size={14} />
                      {representative.phone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-[#F1F5F9] rounded text-xs text-[#64748B]">
                    Last login: {formatDate(representative.lastLoginAt)}
                  </span>
                  <span className="px-2 py-0.5 bg-[#F1F5F9] rounded text-xs text-[#64748B]">
                    Member since: {formatDate(representative.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    representative.callAvailabilityStatus === 'available'
                      ? 'bg-[#D1FAE5] text-[#065F46]'
                      : representative.callAvailabilityStatus === 'in-call'
                      ? 'bg-[#FEF3C7] text-[#92400E]'
                      : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                >
                  {representative.callAvailabilityStatus === 'available'
                    ? 'Available'
                    : representative.callAvailabilityStatus === 'in-call'
                    ? 'In Call'
                    : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Time-based Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Today's Calls"
            value={timeMetrics.today.calls}
            subValue={`${timeMetrics.today.leads} leads assigned`}
            icon={Phone}
            color="bg-[#1D4ED8]"
          />
          <MetricCard
            label="This Week"
            value={timeMetrics.week.calls}
            subValue={`${timeMetrics.week.leads} leads assigned`}
            icon={Activity}
            color="bg-[#10B981]"
          />
          <MetricCard
            label="This Month"
            value={timeMetrics.month.calls}
            subValue={`${timeMetrics.month.leads} leads assigned`}
            icon={BarChart3}
            color="bg-[#F59E0B]"
          />
          <MetricCard
            label="Total Activity"
            value={timeMetrics.total.calls}
            subValue={`${timeMetrics.total.leads} total leads`}
            icon={TrendingUp}
            color="bg-[#8B5CF6]"
          />
        </div>

        {/* Lead Analytics Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Disposition Breakdown */}
          <SectionCard title="Lead Disposition Breakdown" icon={PieChart}>
            <div className="space-y-3">
              {leadAnalytics.dispositionBreakdown.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No lead data available</p>
              ) : (
                leadAnalytics.dispositionBreakdown.map((item) => (
                  <div key={item.status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#475569]">{item.status}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <ProgressBar
                      value={item.count}
                      total={leadAnalytics.dispositionBreakdown.reduce((sum, d) => sum + d.count, 0)}
                      color={
                        item.status === 'Booking Done' || item.status === 'Agreement Done'
                          ? 'bg-[#10B981]'
                          : item.status === 'Failed'
                          ? 'bg-[#EF4444]'
                          : 'bg-[#1D4ED8]'
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Source Breakdown */}
          <SectionCard title="Lead Source Breakdown" icon={Target}>
            <div className="space-y-3">
              {leadAnalytics.sourceBreakdown.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No source data available</p>
              ) : (
                leadAnalytics.sourceBreakdown.map((item) => (
                  <div key={item.source}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#475569]">{item.source}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <ProgressBar
                      value={item.count}
                      total={leadAnalytics.sourceBreakdown.reduce((sum, s) => sum + s.count, 0)}
                      color="bg-[#8B5CF6]"
                    />
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* Call Analytics Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Call Outcomes */}
          <SectionCard title="Call Outcomes" icon={Phone}>
            <div className="space-y-3">
              {callAnalytics.outcomes.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No call data available</p>
              ) : (
                callAnalytics.outcomes.map((item) => (
                  <div key={item.outcome} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.outcome === 'Connected' ? (
                        <CheckCircle size={16} className="text-[#10B981]" />
                      ) : item.outcome === 'Not Answered' ? (
                        <XCircle size={16} className="text-[#EF4444]" />
                      ) : (
                        <AlertCircle size={16} className="text-[#F59E0B]" />
                      )}
                      <span className="text-sm text-[#475569]">{item.outcome || 'Unknown'}</span>
                    </div>
                    <span className="font-medium text-sm">{item.count}</span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Upcoming Reminders */}
          <SectionCard title="Upcoming Reminders" icon={Clock3}>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No upcoming reminders</p>
              ) : (
                upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-2 bg-[#F8FAFC] rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{reminder.title}</p>
                      <p className="text-xs text-[#64748B]">
                        {reminder.leadName && `Lead: ${reminder.leadName}`}
                      </p>
                    </div>
                    <span className="text-xs text-[#64748B]">
                      {new Date(reminder.dueAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* Daily Activity Chart */}
        <SectionCard title="Daily Activity (Last 30 Days)" icon={Activity}>
          <div className="space-y-4">
            {callAnalytics.dailyActivity.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-4">No daily activity data available</p>
            ) : (
              <div className="space-y-3">
                {callAnalytics.dailyActivity.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <span className="text-xs text-[#64748B] w-16">
                      {new Date(day.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-[#F1F5F9] rounded-full h-6 relative overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-[#1D4ED8] rounded-full transition-all"
                          style={{
                            width: `${
                              day.calls > 0 ? Math.min(100, (day.connected / Math.max(...callAnalytics.dailyActivity.map((d) => d.calls))) * 100) : 0
                            }%`,
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#0F172A]">
                          {day.calls} calls
                        </span>
                      </div>
                      <span className="text-xs text-[#64748B] w-20">
                        {day.connected} connected
                      </span>
                      <span className="text-xs text-[#64748B] w-16">
                        {formatDuration(day.avgDuration)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Recent Activity */}
        <div className="grid grid-cols-2 gap-6">
          {/* Recent Leads */}
          <SectionCard title="Recent Leads" icon={Target}>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {leadAnalytics.recent.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No recent leads</p>
              ) : (
                leadAnalytics.recent.map((lead) => (
                  <div
                    key={lead._id}
                    className="p-3 bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                    onClick={() => navigate(`/leads/${lead._id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{lead.name}</p>
                        <p className="text-xs text-[#64748B]">
                          {lead.city} • {lead.source}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          lead.disposition === 'Booking Done' || lead.disposition === 'Agreement Done'
                            ? 'bg-[#D1FAE5] text-[#065F46]'
                            : lead.disposition === 'Failed'
                            ? 'bg-[#FEE2E2] text-[#991B1B]'
                            : 'bg-[#F1F5F9] text-[#475569]'
                        }`}
                      >
                        {lead.disposition}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Recent Calls */}
          <SectionCard title="Recent Calls" icon={Phone}>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {callAnalytics.recent.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">No recent calls</p>
              ) : (
                callAnalytics.recent.map((call) => (
                  <div key={call._id} className="p-3 bg-[#F8FAFC] rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{call.leadName}</p>
                        <p className="text-xs text-[#64748B]">{call.phone}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            call.outcome === 'Connected'
                              ? 'bg-[#D1FAE5] text-[#065F46]'
                              : call.outcome === 'Not Answered'
                              ? 'bg-[#FEE2E2] text-[#991B1B]'
                              : 'bg-[#F1F5F9] text-[#475569]'
                          }`}
                        >
                          {call.outcome || 'Unknown'}
                        </span>
                        <p className="text-xs text-[#64748B] mt-1">
                          {formatDuration(call.duration)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

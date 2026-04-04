import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Phone,
  Target,
  TrendingUp,
  ArrowRight,
  Activity,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  PhoneCall,
  BarChart3,
  Award,
  Loader2,
  Trophy,
  Medal,
} from 'lucide-react'
import { performanceAPI, type RepresentativePerformance, type PerformanceSummary } from '../api/performance'
import { useAuth } from '../context/AuthContext'

const MetricCard = ({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  subValue?: string
  icon: React.ElementType
  color: string
}) => (
  <div className="bg-white rounded-lg p-3 border border-[#E2E8F0] hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-medium text-[#64748B] uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-[#0F172A] mt-0.5">{value}</p>
        {subValue && <p className="text-[10px] text-[#64748B] mt-0.5">{subValue}</p>}
      </div>
      <div className={`p-1.5 rounded-md ${color}`}>
        <Icon size={14} className="text-white" />
      </div>
    </div>
  </div>
)

const RepresentativeCard = ({
  rep,
  onClick,
  rank,
}: {
  rep: RepresentativePerformance
  onClick: () => void
  rank: number
}) => {
  const [expanded, setExpanded] = useState(false)

  const getActivityColor = (score: number) => {
    if (score >= 80) return 'bg-[#10B981]'
    if (score >= 50) return 'bg-[#F59E0B]'
    return 'bg-[#EF4444]'
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy size={14} className="text-[#F59E0B]" />
    if (rank === 2) return <Medal size={14} className="text-[#94A3B8]" />
    if (rank === 3) return <Award size={14} className="text-[#B45309]" />
    return <span className="text-xs font-medium text-[#64748B]">#{rank}</span>
  }

  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden hover:shadow-md transition-all">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white font-semibold text-sm">
              {rep.avatarUrl ? (
                <img src={rep.avatarUrl} alt={rep.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User size={16} />
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                rep.callAvailabilityStatus === 'available'
                  ? 'bg-[#10B981]'
                  : rep.callAvailabilityStatus === 'in-call'
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#94A3B8]'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-[#0F172A] text-sm">{rep.name}</h3>
              <span>{getRankBadge(rank)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-0">
              <span className="flex items-center gap-0.5">
                <Mail size={10} />
                {rep.email}
              </span>
              {rep.phone && (
                <span className="flex items-center gap-0.5">
                  <PhoneCall size={10} />
                  {rep.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getActivityColor(rep.activityScore)} text-white`}>
            {rep.activityScore}%
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-[#F1F5F9] rounded transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-3 pb-3 grid grid-cols-4 gap-2">
        <div className="text-center p-1.5 bg-[#F8FAFC] rounded-md">
          <p className="text-sm font-bold text-[#0F172A]">{rep.leads.total}</p>
          <p className="text-[10px] text-[#64748B]">Leads</p>
        </div>
        <div className="text-center p-1.5 bg-[#F8FAFC] rounded-md">
          <p className="text-sm font-bold text-[#0F172A]">{rep.calls.total}</p>
          <p className="text-[10px] text-[#64748B]">Calls</p>
        </div>
        <div className="text-center p-1.5 bg-[#F8FAFC] rounded-md">
          <p className="text-sm font-bold text-[#0F172A]">{rep.leads.conversionRate}%</p>
          <p className="text-[10px] text-[#64748B]">Conv.</p>
        </div>
        <div className="text-center p-1.5 bg-[#F8FAFC] rounded-md">
          <p className="text-sm font-bold text-[#0F172A]">{rep.calls.connectionRate}%</p>
          <p className="text-[10px] text-[#64748B]">Conn.</p>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[#E2E8F0] pt-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Lead Breakdown */}
            <div className="bg-[#F8FAFC] rounded-md p-2">
              <h4 className="text-[10px] font-semibold text-[#64748B] uppercase mb-2 flex items-center gap-1">
                <Target size={12} />
                Leads (30d)
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">New</span>
                  <span className="font-medium">{rep.leads.month}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Contacted</span>
                  <span className="font-medium">{rep.leads.contacted}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Qualified</span>
                  <span className="font-medium text-[#10B981]">{rep.leads.qualified}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Visits</span>
                  <span className="font-medium">{rep.leads.visitDone}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Bookings</span>
                  <span className="font-medium text-[#1D4ED8]">{rep.leads.bookingDone}</span>
                </div>
              </div>
            </div>

            {/* Call Breakdown */}
            <div className="bg-[#F8FAFC] rounded-md p-2">
              <h4 className="text-[10px] font-semibold text-[#64748B] uppercase mb-2 flex items-center gap-1">
                <Phone size={12} />
                Calls (30d)
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Made</span>
                  <span className="font-medium">{rep.calls.month}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Connected</span>
                  <span className="font-medium text-[#10B981]">{rep.calls.connected}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Missed</span>
                  <span className="font-medium text-[#EF4444]">{rep.calls.missed}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Avg Duration</span>
                  <span className="font-medium">{Math.round(rep.calls.avgDuration / 60)}m</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#475569]">Conn. Rate</span>
                  <span className="font-medium">{rep.calls.connectionRate}%</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClick}
            className="mt-3 w-full py-2 bg-[#1D4ED8] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
          >
            View Details
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* View Button (when collapsed) */}
      {!expanded && (
        <div className="px-3 pb-3">
          <button
            onClick={onClick}
            className="w-full py-1.5 text-[#1D4ED8] text-sm font-medium hover:bg-[#F1F5F9] rounded-md transition-colors flex items-center justify-center gap-1"
          >
            View Performance
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function TeamPerformance() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [representatives, setRepresentatives] = useState<RepresentativePerformance[]>([])
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)

  useEffect(() => {
    if (user?.role !== 'manager') {
      navigate('/dashboard')
      return
    }

    fetchPerformance()
  }, [user, navigate])

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      const response = await performanceAPI.getRepresentativesPerformance()
      if (response.success) {
        setRepresentatives(response.data)
        setSummary(response.summary)
      }
    } catch (err) {
      setError('Failed to load performance data')
    } finally {
      setLoading(false)
    }
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

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 border border-[#FECACA] text-center">
          <p className="text-[#DC2626] font-medium">{error}</p>
          <button
            onClick={fetchPerformance}
            className="mt-3 px-4 py-2 bg-[#1D4ED8] text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-1.5">
              <Activity className="text-[#1D4ED8]" size={18} />
              Team Performance
            </h1>
            <p className="text-xs text-[#64748B]">
              Monitor your team's performance metrics
            </p>
          </div>
          <button
            onClick={fetchPerformance}
            className="p-1.5 hover:bg-[#F1F5F9] rounded-md transition-colors"
            title="Refresh"
          >
            <TrendingUp size={16} className="text-[#64748B]" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <MetricCard
              label="Representatives"
              value={summary.totalRepresentatives}
              icon={Users}
              color="bg-[#1D4ED8]"
            />
            <MetricCard
              label="Leads Assigned"
              value={summary.totalLeadsAssigned.toLocaleString()}
              icon={Target}
              color="bg-[#10B981]"
            />
            <MetricCard
              label="Calls Made"
              value={summary.totalCallsMade.toLocaleString()}
              icon={Phone}
              color="bg-[#F59E0B]"
            />
            <MetricCard
              label="Conversion Rate"
              value={`${summary.avgConversionRate}%`}
              subValue="All reps"
              icon={Award}
              color="bg-[#8B5CF6]"
            />
          </div>
        )}

        {/* Representatives List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F172A]">Representative Performance</h2>
            <p className="text-xs text-[#64748B]">By activity score</p>
          </div>

          {representatives.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center border border-[#E2E8F0]">
              <div className="w-12 h-12 bg-[#F1F5F9] rounded-full flex items-center justify-center mx-auto mb-3">
                <Users size={18} className="text-[#94A3B8]" />
              </div>
              <h3 className="text-sm font-medium text-[#0F172A]">No Representatives Found</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Add representatives to see their performance metrics here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {representatives.map((rep, index) => (
                <RepresentativeCard
                  key={rep.id}
                  rep={rep}
                  rank={index + 1}
                  onClick={() => navigate(`/performance/${rep.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

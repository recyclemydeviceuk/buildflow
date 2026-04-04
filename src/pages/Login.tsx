import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, Users, Phone, CalendarCheck, ClipboardList, Headphones, TrendingUp, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api/auth'
import axios from 'axios'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const response = await authAPI.login(email, password)
      if (response.success) {
        login(response.data.accessToken, response.data.user)
      } else {
        setError('Login failed. Please check your credentials.')
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left — brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[520px] shrink-0 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)' }}
      >
        {/* Decorative radial glows */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #1D4ED8 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

        {/* Logo */}
        <div>
          <img src="https://res.cloudinary.com/desmurksp/image/upload/v1775226238/Buildflow_i2vkia.png" alt="BuildFlow" className="h-10 w-auto" />
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h1 className="text-[2.6rem] font-extrabold text-white leading-[1.15] tracking-tight mb-5">
            Close more deals.<br />
            <span style={{ color: '#3B82F6' }}>Miss nothing.</span>
          </h1>
          <p className="text-[#94A3B8] text-base leading-relaxed mb-10 max-w-xs">
            A focused CRM built for construction sales teams. Every lead, follow-up, and call — in one place.
          </p>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lead Management', desc: 'Track & organize leads', icon: Users, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
              { label: 'Smart Calling', desc: 'Auto-dial & recordings', icon: Phone, color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
              { label: 'Follow-up Timeline', desc: 'Never miss a follow-up', icon: CalendarCheck, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
              { label: 'Sales Pipeline', desc: 'Track deals to closure', icon: TrendingUp, color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
            ].map(f => (
              <div key={f.label}
                className="rounded-2xl p-4 border border-white/8 flex flex-col gap-2 hover:bg-white/8 transition-colors cursor-default"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: f.bg }}>
                  <f.icon size={15} style={{ color: f.color }} />
                </div>
                <p className="text-white text-sm font-semibold">{f.label}</p>
                <p className="text-[#94A3B8] text-[11px]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[#334155] text-xs relative z-10">© 2026 BuildFlow Technologies</p>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="w-full max-w-[420px] animate-slide-up">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <img src="https://res.cloudinary.com/desmurksp/image/upload/v1775226238/Buildflow_i2vkia.png" alt="BuildFlow" className="h-10 w-auto" />
          </div>

          <div className="bg-white rounded-3xl shadow-card-xl border border-[#E2E8F0] p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Welcome back</h2>
              <p className="text-[#64748B] text-sm mt-1.5">Sign in to your workspace</p>
            </div>

            {/* Welcome banner without role mock selector */}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@buildflow.com"
                  className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] text-sm placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-[#0F172A]">Password</label>
                  <button type="button" className="text-xs text-[#1D4ED8] font-semibold hover:underline">Forgot?</button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] text-sm placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#CBD5E1] hover:text-[#475569] transition-colors"
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-[#DC2626] shrink-0" />
                  <p className="text-[#DC2626] text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="keep" className="w-4 h-4 rounded border-[#E2E8F0] accent-[#1D4ED8]" />
                <label htmlFor="keep" className="text-sm text-[#64748B] cursor-pointer select-none">Keep me signed in</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: loading ? '#1D4ED8' : 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign in to workspace'}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-[#CBD5E1]">
            Need access? Contact your team administrator.
          </p>
        </div>
      </div>
    </div>
  )
}

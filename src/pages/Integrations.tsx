import { Construction } from 'lucide-react'

export default function Integrations() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
          <Construction size={28} className="text-[#1D4ED8]" />
        </div>
        <h1 className="text-xl font-bold text-[#0F172A] mb-2">Integrations</h1>
        <p className="text-sm text-[#64748B]">
          We are working on integrations. It may take a few more time.
        </p>
      </div>
    </div>
  )
}

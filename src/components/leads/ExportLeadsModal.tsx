import { useState } from 'react'
import { X, Download, Calendar, CheckSquare, Square, Loader2, FileSpreadsheet } from 'lucide-react'
import { leadsAPI } from '../../api/leads'

interface ExportLeadsModalProps {
  onClose: () => void
}

const DATE_RANGES = [
  { value: 'today', label: 'Today', description: 'Leads created today' },
  { value: 'week', label: 'This Week', description: 'Leads from Monday to today' },
  { value: 'month', label: 'This Month', description: 'Leads from start of month' },
  { value: 'lifetime', label: 'Lifetime', description: 'All leads ever created' },
]

const EXPORTABLE_FIELDS = [
  { key: 'name', label: 'Name', default: true },
  { key: 'phone', label: 'Phone', default: true },
  { key: 'email', label: 'Email', default: true },
  { key: 'city', label: 'City', default: true },
  { key: 'source', label: 'Source', default: true },
  { key: 'disposition', label: 'Disposition', default: true },
  { key: 'ownerName', label: 'Owner', default: true },
  { key: 'budget', label: 'Budget', default: false },
  { key: 'plotSize', label: 'Plot Size', default: false },
  { key: 'plotSizeUnit', label: 'Plot Size Unit', default: false },
  { key: 'plotOwned', label: 'Plot Owned', default: false },
  { key: 'buildType', label: 'Build Type', default: false },
  { key: 'campaign', label: 'Campaign', default: false },
  { key: 'meetingType', label: 'Meeting Type', default: false },
  { key: 'meetingLocation', label: 'Meeting Location', default: false },
  { key: 'failedReason', label: 'Failed Reason', default: false },
  { key: 'notes', label: 'Notes', default: false },
  { key: 'lastActivity', label: 'Last Activity', default: false },
  { key: 'lastActivityNote', label: 'Last Activity Note', default: false },
  { key: 'nextFollowUp', label: 'Next Follow Up', default: false },
  { key: 'createdAt', label: 'Created At', default: true },
  { key: 'updatedAt', label: 'Updated At', default: false },
]

export default function ExportLeadsModal({ onClose }: ExportLeadsModalProps) {
  const [dateRange, setDateRange] = useState('today')
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORTABLE_FIELDS.filter(f => f.default).map(f => f.key)
  )
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const toggleField = (key: string) => {
    setSelectedFields(current =>
      current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    )
  }

  const selectAllFields = () => {
    setSelectedFields(EXPORTABLE_FIELDS.map(f => f.key))
  }

  const deselectAllFields = () => {
    setSelectedFields([])
  }

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to export')
      return
    }

    try {
      setExporting(true)
      setError('')

      const blob = await leadsAPI.exportLeads({
        dateRange,
        fields: selectedFields,
        format: 'csv',
      })

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `leads_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      onClose()
    } catch (err) {
      setError('Failed to export leads. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-[#1D4ED8]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Export Leads</h2>
              <p className="text-xs text-[#64748B]">Download leads as CSV file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#F1F5F9] rounded-lg transition-colors"
          >
            <X size={18} className="text-[#64748B]" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Date Range Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-[#1D4ED8]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">Date Range</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    dateRange === range.value
                      ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                      : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <p className={`text-sm font-medium ${dateRange === range.value ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}`}>
                    {range.label}
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5">{range.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Fields Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-[#1D4ED8]" />
                <h3 className="text-sm font-semibold text-[#0F172A]">Fields to Export</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllFields}
                  className="text-xs font-medium text-[#1D4ED8] hover:text-blue-700"
                >
                  Select All
                </button>
                <span className="text-[#CBD5E1]">|</span>
                <button
                  onClick={deselectAllFields}
                  className="text-xs font-medium text-[#64748B] hover:text-[#475569]"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {EXPORTABLE_FIELDS.map((field) => (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                    selectedFields.includes(field.key)
                      ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                      : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {selectedFields.includes(field.key) ? (
                    <div className="w-4 h-4 rounded bg-[#1D4ED8] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded border border-[#CBD5E1]" />
                  )}
                  <span className={`text-sm ${selectedFields.includes(field.key) ? 'text-[#0F172A] font-medium' : 'text-[#475569]'}`}>
                    {field.label}
                  </span>
                </button>
              ))}
            </div>

            {selectedFields.length === 0 && (
              <p className="text-xs text-[#DC2626] mt-2">Please select at least one field</p>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
              <p className="text-sm text-[#DC2626]">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <p className="text-xs text-[#64748B]">
            {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || selectedFields.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

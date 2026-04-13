import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  UserCheck,
  X,
} from 'lucide-react'
import { importAPI, type ImportPreviewData, type ImportSummary, type ImportTargetField } from '../api/import'
import { leadsAPI } from '../api/leads'
import { teamAPI } from '../api/team'
import type { LeadFieldConfig, LeadFieldKey } from '../api/settings'
import { useAuth } from '../context/AuthContext'

interface MappingRow {
  csvColumn: string
  targetField: ImportTargetField
  preview: string[]
}

const EXTRA_FIELD_META: Record<
  'source' | 'disposition' | 'notes' | 'ownerName' | 'nextFollowUp' | 'receivedDate' | 'meetingType' | 'meetingLocation' | 'failedReason',
  { label: string; help: string }
> = {
  source: { label: 'Lead Source', help: 'Imports into the lead source field' },
  disposition: { label: 'Stage / Status', help: 'Sets the lead stage: New, Contacted/Open, Qualified, Visit Done, Meeting Done, Negotiation Done, Booking Done, Agreement Done, or Failed' },
  notes: { label: 'Notes', help: 'Combines remarks, requirements, and other note columns into lead status notes history. Each column becomes a labeled note entry.' },
  ownerName: { label: 'Representative / Handled By', help: 'Matches the representative from the sheet by name, phone, or email and assigns the lead if found' },
  nextFollowUp: { label: 'Next Follow Up', help: 'Stores the follow-up date on the lead and syncs the imported follow-up reminder when possible' },
  receivedDate: { label: 'Lead Received Date', help: 'Uses the sheet date as the imported lead received date' },
  meetingType: { label: 'Meeting Type', help: 'For Meeting Done stage — sets the meeting type: VC or Client Place' },
  meetingLocation: { label: 'Meeting Location', help: 'For Meeting Done (Client Place) — stores the client location or address' },
  failedReason: { label: 'Failed Reason', help: 'For Failed stage — reason for failure: Budget Issue, Not Interested, Location Issue, Timeline Issue, Competition, or Other' },
}

const sampleFieldValues: Partial<Record<LeadFieldKey, string>> = {
  name: 'Rajesh Kumar',
  phone: '9876543210',
  city: 'Bangalore',
  budget: '50L - 1Cr',
  buildType: 'Residential',
  plotOwned: 'Yes',
  campaign: 'April Meta Campaign',
  email: 'rajesh@example.com',
  plotSize: '2400',
  plotSizeUnit: 'sq ft',
}

const escapeCsvValue = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

const DEFAULT_TEMPLATE_HEADERS = [
  'SL No',
  'Month',
  'Lead Received Date',
  'Plot size',
  'Name',
  'Phone Number',
  'Email ID',
  'Location',
  'Handled by',
  'Source',
  'Status',
  'Folow Up',
  'REQUIREMENTS',
  'REMARKS',
  'Not Qualified Reason',
  'Meeting Type',
  'Meeting Location',
  'Failed Reason',
]

const DEFAULT_TEMPLATE_SAMPLE_ROW = [
  '1',
  'April',
  '03/04/2026',
  '2400 sq ft',
  sampleFieldValues.name || 'Rajesh Kumar',
  sampleFieldValues.phone || '9876543210',
  sampleFieldValues.email || 'rajesh@example.com',
  sampleFieldValues.city || 'Bangalore',
  'Amit Kumar',
  'Meta',
  'Meeting Done',
  '10/04/2026 10:30',
  'Needs a 3BHK villa on owned plot',
  'Requested pricing and floor plan',
  '',
  'Client Place',
  'Prestige Whitefield, Bangalore',
  '',
]

const getImportFieldLabel = (field: ImportTargetField, leadFields: LeadFieldConfig[]) => {
  if (field === 'skip') return 'Skip Column'
  if (field in EXTRA_FIELD_META) {
    return EXTRA_FIELD_META[field as keyof typeof EXTRA_FIELD_META].label
  }

  return leadFields.find((item) => item.key === field)?.label || field
}

export default function LeadImport() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null)
  const [mappedFields, setMappedFields] = useState<MappingRow[]>([])
  const [availableLeadFields, setAvailableLeadFields] = useState<LeadFieldConfig[]>([])
  const [dispositions, setDispositions] = useState<string[]>([])
  const [representatives, setRepresentatives] = useState<{ id: string; name: string }[]>([])
  const [fallbackRepresentativeId, setFallbackRepresentativeId] = useState('')
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'overwrite'>('skip')
  const [isDragging, setIsDragging] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isRefreshingRepresentativePreview, setIsRefreshingRepresentativePreview] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoadingConfig(true)
        const [filtersResponse, teamResponse] = await Promise.all([
          leadsAPI.getLeadFilters(),
          isManager ? teamAPI.getTeamMembers() : Promise.resolve(null),
        ])

        if (filtersResponse.success) {
          setAvailableLeadFields(
            (filtersResponse.data.leadFields?.fields || []).filter((field) => field.active)
          )
          setDispositions(filtersResponse.data.dispositions || [])
        }

        if (teamResponse?.success) {
          setRepresentatives(
            teamResponse.data
              .filter((member) => member.role === 'representative' && member.isActive)
              .map((member) => ({
                id: member.id,
                name: member.name,
              }))
          )
        }
      } catch (loadError) {
        console.error('Failed to load import config:', loadError)
        setError('Could not load the bulk import configuration right now.')
      } finally {
        setLoadingConfig(false)
      }
    }

    void loadConfig()
  }, [isManager])

  const requiredFieldsMapped = useMemo(() => {
    if (!previewData) return false

    return previewData.requiredFields.every((field) =>
      mappedFields.some((item) => item.targetField === field)
    )
  }, [mappedFields, previewData])

  const hasRepresentativeMapping = useMemo(
    () => mappedFields.some((field) => field.targetField === 'ownerName'),
    [mappedFields]
  )

  const importFieldOptions = useMemo(
    () => [
      ...availableLeadFields.map((field) => ({
        value: field.key as ImportTargetField,
        label: field.label,
        help: field.required ? 'Required lead field' : 'Optional lead field',
      })),
      ...(['source', 'disposition', 'notes', 'ownerName', 'nextFollowUp', 'receivedDate', 'meetingType', 'meetingLocation', 'failedReason'] as const).map((field) => ({
        value: field as ImportTargetField,
        label: EXTRA_FIELD_META[field].label,
        help: EXTRA_FIELD_META[field].help,
      })),
      {
        value: 'skip' as ImportTargetField,
        label: 'Skip Column',
        help: 'Ignore this CSV column during import',
      },
    ],
    [availableLeadFields]
  )

  const resetImporter = () => {
    setStep(1)
    setFile(null)
    setPreviewData(null)
    setMappedFields([])
    setFallbackRepresentativeId('')
    setDuplicateHandling('skip')
    setImportResult(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFile = async (uploadedFile: File) => {
    setError('')
    setImportResult(null)
    setFile(uploadedFile)
    setIsPreviewing(true)

    try {
      const response = await importAPI.previewImport(uploadedFile)
      if (!response.success) {
        throw new Error('Preview request failed')
      }

      setPreviewData(response.data)
      setAvailableLeadFields(response.data.leadFields)
      setDispositions(response.data.dispositions)
      setMappedFields(
        response.data.headers.map((header) => ({
          csvColumn: header,
          targetField: response.data.suggestedMappings[header] || 'skip',
          preview: response.data.previewRows.map((row) => row[header] || ''),
        }))
      )
      setStep(2)
    } catch (previewError: any) {
      console.error('Failed to preview import file:', previewError)
      setFile(null)
      setPreviewData(null)
      setMappedFields([])
      setError(previewError?.response?.data?.message || 'Could not read that file. Please upload a valid CSV or XLSX file.')
    } finally {
      setIsPreviewing(false)
    }
  }

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      await handleFile(droppedFile)
    }
  }

  const onFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      await handleFile(selectedFile)
    }
  }

  const updateMapping = (csvColumn: string, targetField: ImportTargetField) => {
    setMappedFields((current) =>
      current.map((field) =>
        field.csvColumn === csvColumn ? { ...field, targetField } : field
      )
    )
  }

  const refreshRepresentativePreview = async () => {
    if (!file || !previewData) {
      setStep(3)
      return
    }

    setIsRefreshingRepresentativePreview(true)
    setError('')

    try {
      const response = await importAPI.previewImport(
        file,
        mappedFields.reduce<Record<string, ImportTargetField>>((accumulator, field) => {
          accumulator[field.csvColumn] = field.targetField
          return accumulator
        }, {})
      )

      if (!response.success) {
        throw new Error('Representative preview request failed')
      }

      setPreviewData((current) => (current ? { ...current, representativePreview: response.data.representativePreview || null } : response.data))
      setStep(3)
    } catch (previewError: any) {
      console.error('Failed to refresh representative preview:', previewError)
      setError(previewError?.response?.data?.message || 'Could not validate representative assignments right now.')
    } finally {
      setIsRefreshingRepresentativePreview(false)
    }
  }

  const downloadTemplate = () => {
    const csv = [DEFAULT_TEMPLATE_HEADERS, DEFAULT_TEMPLATE_SAMPLE_ROW]
      .map((row) => row.map((value) => escapeCsvValue(String(value || ''))).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'buildflow_bulk_leads_template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!file) {
      setError('Upload a file before starting the import.')
      return
    }

    setIsImporting(true)
    setError('')

    try {
      const response = await importAPI.startImport({
        file,
        mappings: mappedFields.reduce<Record<string, ImportTargetField>>((accumulator, field) => {
          accumulator[field.csvColumn] = field.targetField
          return accumulator
        }, {}),
        settings: {
          fallbackRepresentativeId: fallbackRepresentativeId || undefined,
          duplicateHandling,
        },
      })

      if (!response.success) {
        throw new Error('Import request failed')
      }

      setImportResult(response.data)
      setStep(4)
    } catch (importError: any) {
      console.error('Failed to import leads:', importError)
      setError(importError?.response?.data?.message || 'Import failed. Please review the file and try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const steps = [
    { id: 1, label: 'Upload File' },
    { id: 2, label: 'Map Fields' },
    { id: 3, label: 'Import Settings' },
    { id: 4, label: 'Complete' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/leads')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#475569] hover:text-[#0F172A] transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Leads
            </button>
            <h1 className="text-xl font-bold text-[#0F172A] mt-3">Bulk Lead Import</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Import CSV or Excel leads using your standard sheet format and map them into the existing lead system with status, notes, representative assignment, and follow-up sync.
            </p>
            {!isManager ? (
              <p className="text-xs font-semibold text-[#1D4ED8] mt-2">
                Leads imported by you will be assigned to your account automatically. Any `Handled by` values in the sheet are ignored for representative uploads.
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={loadingConfig}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#475569] bg-white hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              <Download size={16} />
              Download Template
            </button>
            <button
              type="button"
              onClick={resetImporter}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#475569] bg-white hover:bg-[#F8FAFC]"
            >
              <RefreshCw size={15} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex items-center gap-3 flex-wrap">
          {steps.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= item.id ? 'bg-[#1D4ED8] text-white' : 'bg-[#E2E8F0] text-[#64748B]'
                }`}
              >
                {item.id}
              </div>
              <span className={`text-sm font-semibold ${step >= item.id ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                {item.label}
              </span>
              {index < steps.length - 1 ? <ChevronRight size={16} className="text-[#CBD5E1]" /> : null}
            </div>
          ))}
        </div>

        {error ? (
          <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Expected lead fields</h2>
                  <p className="text-sm text-[#64748B] mt-1">
                    The importer follows your sheet format and maps it into the same active lead fields configured in Settings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableLeadFields.map((field) => (
                    <span
                      key={field.key}
                      className="px-3 py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-xs font-bold border border-[#DBEAFE]"
                    >
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                  ))}
                  <span className="px-3 py-1.5 rounded-full bg-[#F8FAFC] text-[#475569] text-xs font-bold border border-[#E2E8F0]">
                    Stage / Notes / Representative / Follow-up
                  </span>
                </div>
              </div>
            </div>

            <div
              onDrop={(event) => void onDrop(event)}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-3xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-[#1D4ED8] bg-[#EFF6FF]' : 'border-[#CBD5E1] bg-white hover:border-[#93C5FD]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(event) => void onFileInputChange(event)}
                className="hidden"
              />
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EFF6FF] flex items-center justify-center">
                {isPreviewing ? (
                  <Loader2 size={28} className="text-[#1D4ED8] animate-spin" />
                ) : (
                  <Upload size={28} className="text-[#1D4ED8]" />
                )}
              </div>
              <p className="text-lg font-bold text-[#0F172A] mt-5">
                {isPreviewing ? 'Reading your file...' : isDragging ? 'Drop the file here' : 'Drag and drop your lead file here'}
              </p>
              <p className="text-sm text-[#64748B] mt-2">CSV and XLSX are supported up to 10 MB.</p>
              <div className="inline-flex items-center gap-2 mt-4 text-xs font-semibold text-[#64748B]">
                <FileSpreadsheet size={14} />
                Fields are auto-mapped where possible and you can correct anything in the next step.
              </div>
            </div>
          </div>
        ) : null}
        {step === 2 && previewData ? (
          <div className="space-y-6">
            <div className={`rounded-2xl border px-4 py-3 ${requiredFieldsMapped ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FDE68A] bg-[#FFFBEB]'}`}>
              <div className="flex items-start gap-3">
                {requiredFieldsMapped ? (
                  <CheckCircle2 size={18} className="text-[#16A34A] mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-[#D97706] mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-semibold ${requiredFieldsMapped ? 'text-[#166534]' : 'text-[#B45309]'}`}>
                    {requiredFieldsMapped
                      ? 'All required lead fields are mapped.'
                      : 'Map every required lead field before continuing.'}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Required: {previewData.requiredFields.map((field) => getImportFieldLabel(field, previewData.leadFields)).join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">{previewData.fileName}</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">{previewData.rowCount} data rows detected</p>
                </div>
                <button
                  type="button"
                  onClick={resetImporter}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                >
                  <X size={15} />
                  Choose Another File
                </button>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">CSV Column</th>
                      <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Import Into</th>
                      <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedFields.map((field) => (
                      <tr key={field.csvColumn} className="border-b border-[#F1F5F9] align-top">
                        <td className="px-3 py-2">
                          <p className="text-xs font-semibold text-[#0F172A]">{field.csvColumn}</p>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={field.targetField}
                            onChange={(event) =>
                              updateMapping(field.csvColumn, event.target.value as ImportTargetField)
                            }
                            className="w-full px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                          >
                            {importFieldOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-[#94A3B8] mt-2">
                            {importFieldOptions.find((option) => option.value === field.targetField)?.help}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            {field.preview.map((value, index) => (
                              <p key={`${field.csvColumn}-${index}`} className="text-xs text-[#64748B] truncate max-w-[280px]">
                                {value || '-'}
                              </p>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                type="button"
                onClick={() => void refreshRepresentativePreview()}
                disabled={!requiredFieldsMapped || isRefreshingRepresentativePreview}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshingRepresentativePreview ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Checking Assignment
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
        {step === 3 && previewData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 space-y-6">
                {isManager ? (
                  <>
                    <div>
                      <h2 className="text-base font-bold text-[#0F172A]">Assignment</h2>
                      <p className="text-sm text-[#64748B] mt-1">
                        Representative assignment now comes directly from the mapped CSV column.
                      </p>
                    </div>

                    <div className="rounded-2xl border-2 border-[#1D4ED8] bg-[#EFF6FF] p-4">
                      <div className="flex items-start gap-3">
                        <UserCheck size={18} className="text-[#1D4ED8]" />
                        <div>
                          <p className="text-sm font-bold text-[#0F172A]">Auto-detect representatives from CSV</p>
                          <p className="text-xs text-[#64748B] mt-1">
                            BuildFlow matches each imported lead against active representatives from the backend using the mapped representative column. Name, phone number, or email values in the CSV can all be used for detection.
                          </p>
                        </div>
                      </div>
                    </div>

                    {hasRepresentativeMapping ? (
                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Unmatched Representative Fallback</p>
                        <p className="text-sm text-[#475569] leading-6">
                          If a CSV representative is not found, the backend will stop the import and ask you to choose another representative from this dropdown.
                        </p>
                        <select
                          value={fallbackRepresentativeId}
                          onChange={(event) => setFallbackRepresentativeId(event.target.value)}
                          className="w-full px-3 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
                        >
                          <option value="">No fallback selected</option>
                          {representatives.map((rep) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.name}
                            </option>
                          ))}
                        </select>
                        {!representatives.length ? (
                          <p className="text-xs text-[#B91C1C]">
                            No active representatives were loaded from the backend, so unmatched imports cannot be reassigned right now.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                        <p className="text-sm font-bold text-[#0F172A]">Representative column not mapped</p>
                        <p className="text-xs text-[#64748B] mt-1">
                          Go back to Map Fields and map a CSV column to `Representative / Handled By` if you want imports to auto-assign to your team.
                        </p>
                      </div>
                    )}

                    {previewData.representativePreview ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Detected Representatives</p>
                          <p className="text-xs text-[#64748B]">
                            {previewData.representativePreview.matchedCount} matched / {previewData.representativePreview.unmatchedCount} unmatched
                          </p>
                        </div>

                        <div className="space-y-3">
                          {previewData.representativePreview.samples.length ? (
                            previewData.representativePreview.samples.map((item) => (
                              <div
                                key={item.rawValue}
                                className={`rounded-2xl border p-4 ${
                                  item.matched
                                    ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                                    : 'border-[#FDE68A] bg-[#FFFBEB]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-[#0F172A]">{item.rawValue}</p>
                                    <p className="text-xs text-[#64748B] mt-1">
                                      Found in rows {item.rowNumbers.join(', ')}
                                    </p>
                                  </div>
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                      item.matched
                                        ? 'bg-[#DCFCE7] text-[#166534]'
                                        : 'bg-[#FEF3C7] text-[#92400E]'
                                    }`}
                                  >
                                    {item.matched ? `Matched by ${item.matchedBy}` : 'Not found'}
                                  </span>
                                </div>

                                {item.representative ? (
                                  <div className="mt-3 rounded-xl border border-white/80 bg-white px-3 py-3 space-y-1">
                                    <p className="text-sm font-semibold text-[#0F172A]">{item.representative.name}</p>
                                    <p className="text-xs text-[#475569]">
                                      {item.representative.email || 'No email on file'}
                                    </p>
                                    <p className="text-xs text-[#475569]">
                                      {item.representative.phone || 'No phone on file'}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-[#92400E] mt-3">
                                    This CSV value does not match any active backend representative, so it will not be auto-assigned until you choose a fallback representative.
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                              <p className="text-sm font-bold text-[#0F172A]">No representative values found in the mapped CSV column</p>
                              <p className="text-xs text-[#64748B] mt-1">
                                BuildFlow did not find any non-empty representative values in the mapped rows.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border-2 border-[#1D4ED8] bg-[#EFF6FF] p-4">
                    <div className="flex items-start gap-3">
                      <UserCheck size={18} className="text-[#1D4ED8]" />
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">Auto-assigned to you</p>
                        <p className="text-xs text-[#64748B] mt-1">
                          Every lead in this import will be assigned to your account. The manager assignment flow stays unchanged.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] mb-3">Duplicate Handling</h3>
                  <div className="space-y-3">
                    {[
                      {
                        value: 'skip' as const,
                        label: 'Skip Existing Leads',
                        description: 'Leaves existing phone numbers untouched and skips those rows.',
                      },
                      {
                        value: 'overwrite' as const,
                        label: 'Update Existing Leads',
                        description: 'Updates matching leads when the phone number already exists.',
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDuplicateHandling(option.value)}
                        className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${
                          duplicateHandling === option.value
                            ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                            : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE]'
                        }`}
                      >
                        <p className="text-sm font-bold text-[#0F172A]">{option.label}</p>
                        <p className="text-xs text-[#64748B] mt-1">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Import Summary</h2>
                  <p className="text-sm text-[#64748B] mt-1">Quick review before you start the import.</p>
                </div>

                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">File</p>
                  <p className="text-sm font-semibold text-[#0F172A] mt-2">{previewData.fileName}</p>
                  <p className="text-xs text-[#64748B] mt-1">{previewData.rowCount} rows ready to import</p>
                </div>

                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Mapped Fields</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {mappedFields
                      .filter((field) => field.targetField !== 'skip')
                      .map((field) => (
                        <span
                          key={`${field.csvColumn}-${field.targetField}`}
                          className="px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] text-xs font-semibold text-[#475569]"
                        >
                          {field.csvColumn} {'->'} {getImportFieldLabel(field.targetField, availableLeadFields)}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Notes and Stage</p>
                  <p className="text-sm text-[#475569] mt-2 leading-6">
                    If you mapped a stage/disposition column and a notes column, each imported note will be linked to that stage in the lead history automatically.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#94A3B8]">Representative Matching</p>
                  <p className="text-sm text-[#475569] mt-2 leading-6">
                    {isManager
                      ? hasRepresentativeMapping
                        ? fallbackRepresentativeId
                          ? 'Mapped representative values are matched against active backend representatives by name, phone number, or email. If a CSV representative is not found, those leads will be assigned to the fallback representative you selected.'
                          : 'Mapped representative values are matched against active backend representatives by name, phone number, or email. If a CSV representative is not found, the backend will ask you to choose another representative from the dropdown before importing.'
                        : 'No representative column is mapped right now, so manager imports will stay unassigned until you map `Representative / Handled By`.'
                      : 'Representative uploads always assign imported leads to the logged-in representative. Any `Handled by` value in the sheet is ignored for your uploads.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={isImporting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1D4ED8] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Start Import
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
        {step === 4 && importResult ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#BBF7D0] bg-[#F0FDF4] p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={22} className="text-[#16A34A] mt-0.5" />
                <div>
                  <h2 className="text-lg font-bold text-[#166534]">Bulk import finished</h2>
                  <p className="text-sm text-[#166534] mt-1">
                    Created {importResult.createdCount} leads and updated {importResult.updatedCount} existing leads.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Rows Read', value: importResult.totalRows, color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF]' },
                { label: 'Created', value: importResult.createdCount, color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]' },
                { label: 'Updated', value: importResult.updatedCount, color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]' },
                { label: 'Skipped', value: importResult.skippedCount, color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]' },
              ].map((card) => (
                <div key={card.label} className={`${card.bg} rounded-2xl p-5 border border-white`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{card.label}</p>
                  <p className={`text-3xl font-black mt-3 ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {importResult.errors.length ? (
              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6">
                <h3 className="text-base font-bold text-[#0F172A]">Skipped Rows and Issues</h3>
                <div className="mt-4 space-y-3 max-h-[420px] overflow-auto pr-2">
                  {importResult.errors.map((item, index) => (
                    <div key={`${item.row}-${index}`} className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                      <p className="text-sm font-semibold text-[#991B1B]">Row {item.row}</p>
                      <p className="text-sm text-[#B91C1C] mt-1">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {importResult.warnings.length ? (
              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6">
                <h3 className="text-base font-bold text-[#0F172A]">Warnings</h3>
                <div className="mt-4 space-y-3 max-h-[320px] overflow-auto pr-2">
                  {importResult.warnings.map((item, index) => (
                    <div key={`${item.row}-${index}`} className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                      <p className="text-sm font-semibold text-[#92400E]">Row {item.row}</p>
                      <p className="text-sm text-[#B45309] mt-1">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={resetImporter}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]"
              >
                <RefreshCw size={15} />
                Import Another File
              </button>
              <button
                type="button"
                onClick={() => navigate('/leads')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] text-white rounded-xl text-sm font-bold hover:bg-blue-700"
              >
                Go to Leads
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}

        {loadingConfig ? (
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-10 flex items-center justify-center gap-3 text-sm font-semibold text-[#64748B]">
            <Loader2 size={18} className="animate-spin" />
            Loading importer configuration...
          </div>
        ) : null}
      </div>
    </div>
  )
}

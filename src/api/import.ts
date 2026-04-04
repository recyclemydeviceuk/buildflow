import { client } from './client'
import type { LeadFieldConfig, LeadFieldKey } from './settings'

export type ImportTargetField =
  | LeadFieldKey
  | 'source'
  | 'disposition'
  | 'notes'
  | 'ownerName'
  | 'nextFollowUp'
  | 'receivedDate'
  | 'meetingType'
  | 'meetingLocation'
  | 'failedReason'
  | 'skip'

export interface ImportPreviewData {
  fileName: string
  rowCount: number
  headers: string[]
  previewRows: Record<string, string>[]
  requiredFields: LeadFieldKey[]
  leadFields: LeadFieldConfig[]
  extraFields: Array<'source' | 'disposition' | 'notes' | 'ownerName' | 'nextFollowUp' | 'receivedDate' | 'meetingType' | 'meetingLocation' | 'failedReason'>
  suggestedMappings: Record<string, ImportTargetField>
  dispositions: string[]
  cities: string[]
  representativePreview?: {
    ownerHeaders: string[]
    rowsWithRepresentative: number
    uniqueRepresentativeValues: number
    matchedCount: number
    unmatchedCount: number
    samples: Array<{
      rawValue: string
      matched: boolean
      matchedBy: 'name' | 'email' | 'phone' | null
      representative: {
        id: string
        name: string
        email: string | null
        phone: string | null
      } | null
      rowNumbers: number[]
    }>
  } | null
}

export interface ImportSummary {
  totalRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  errors: Array<{ row: number; message: string }>
  warningCount: number
  warnings: Array<{ row: number; message: string }>
}

const buildImportFormData = (params: {
  file: File
  mappings?: Record<string, ImportTargetField>
  settings?: {
    fallbackRepresentativeId?: string
    duplicateHandling: 'skip' | 'overwrite'
  }
}) => {
  const formData = new FormData()
  formData.append('file', params.file)

  if (params.mappings) {
    formData.append('mappings', JSON.stringify(params.mappings))
  }

  if (params.settings) {
    formData.append('settings', JSON.stringify(params.settings))
  }

  return formData
}

export const importAPI = {
  previewImport: async (
    file: File,
    mappings?: Record<string, ImportTargetField>
  ): Promise<{ success: boolean; data: ImportPreviewData }> => {
    const response = await client.post(
      '/leads/import/preview',
      buildImportFormData({ file, mappings }),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )

    return response.data
  },

  startImport: async (params: {
    file: File
    mappings: Record<string, ImportTargetField>
    settings: {
      fallbackRepresentativeId?: string
      duplicateHandling: 'skip' | 'overwrite'
    }
  }): Promise<{ success: boolean; data: ImportSummary }> => {
    const response = await client.post(
      '/leads/import',
      buildImportFormData(params),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )

    return response.data
  },
}

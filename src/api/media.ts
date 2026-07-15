import { client } from './client'

export type MediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'spreadsheet'
  | 'document'
  | 'archive'
  | 'other'

export interface MediaFile {
  id: string
  fileName: string
  mimeType: string
  kind: MediaKind
  fileSize: number
  description: string | null
  uploadedBy: string
  uploadedByName: string
  /** Short-lived presigned URL for inline preview / streaming. */
  previewUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface MediaListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export const mediaAPI = {
  list: async (params?: {
    page?: number
    limit?: number
    search?: string
    kind?: MediaKind | ''
  }): Promise<{ success: boolean; data: MediaFile[]; meta: MediaListMeta }> => {
    const response = await client.get('/media', { params })
    return response.data
  },

  upload: async (
    file: File,
    options?: { description?: string; onProgress?: (percent: number) => void }
  ): Promise<{ success: boolean; data: MediaFile }> => {
    const formData = new FormData()
    formData.append('file', file)
    if (options?.description) {
      formData.append('description', options.description)
    }

    const response = await client.post('/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (options?.onProgress && event.total) {
          options.onProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    })
    return response.data
  },

  getById: async (id: string): Promise<{ success: boolean; data: MediaFile }> => {
    const response = await client.get(`/media/${id}`)
    return response.data
  },

  getDownloadUrl: async (id: string): Promise<{ success: boolean; data: { url: string } }> => {
    const response = await client.get(`/media/${id}/download`)
    return response.data
  },

  remove: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/media/${id}`)
    return response.data
  },
}

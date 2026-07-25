import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import {
  Upload,
  Loader2,
  Download,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  X,
} from 'lucide-react'
import { leadsAPI, type MediaFile } from '../../api/leads'
import type { MediaKind } from '../../api/media'
import { formatFileSize } from '../../utils/formatFileSize'
import MediaPreviewModal from '../media/MediaPreviewModal'

interface LeadFilesSectionProps {
  leadId: string
  /** True when the current user owns the lead (or is a manager) — gates upload. */
  canManage: boolean
  /** Current user id — an uploader can always delete their own file. */
  currentUserId?: string
  /** Current user role — managers can delete any file. */
  currentUserRole?: string
}

// Icon + colour per coarse file kind. Mirrors the media library so a PDF looks
// the same everywhere in the app.
const kindMeta: Record<MediaKind, { icon: typeof FileIcon; color: string; bg: string }> = {
  image: { icon: ImageIcon, color: '#7C3AED', bg: '#F5F3FF' },
  video: { icon: Film, color: '#DB2777', bg: '#FDF2F8' },
  audio: { icon: Music, color: '#0891B2', bg: '#ECFEFF' },
  pdf: { icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  spreadsheet: { icon: FileSpreadsheet, color: '#16A34A', bg: '#F0FDF4' },
  document: { icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
  archive: { icon: FileArchive, color: '#D97706', bg: '#FFFBEB' },
  other: { icon: FileIcon, color: '#64748B', bg: '#F1F5F9' },
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function LeadFilesSection({
  leadId,
  canManage,
  currentUserId,
  currentUserRole,
}: LeadFilesSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadName, setUploadName] = useState('')

  const [selected, setSelected] = useState<MediaFile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    setError('')
    try {
      const res = await leadsAPI.getLeadFiles(leadId)
      if (res.success) setFiles(res.data)
    } catch (err) {
      console.error('Failed to load lead files:', err)
      setError('Could not load files for this lead right now.')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !canManage) return
    setError('')
    // Upload sequentially so the progress bar reflects one file at a time.
    for (const file of Array.from(fileList)) {
      setUploading(true)
      setUploadName(file.name)
      setUploadProgress(0)
      try {
        const res = await leadsAPI.uploadLeadFile(leadId, file, {
          onProgress: (percent) => setUploadProgress(percent),
        })
        if (res.success) {
          // Prepend so the newest attachment shows first.
          setFiles((current) => [res.data, ...current])
        }
      } catch (err: any) {
        console.error('Lead file upload failed:', err)
        setError(err?.response?.data?.message || `Could not upload "${file.name}".`)
      }
    }
    setUploading(false)
    setUploadName('')
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files)
  }

  const handleDownload = async (file: MediaFile) => {
    try {
      const res = await leadsAPI.getLeadFileDownloadUrl(leadId, file.id)
      if (res.success && res.data.url) {
        const link = document.createElement('a')
        link.href = res.data.url
        link.download = file.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      console.error('Failed to get download link:', err)
      setError('Could not generate a download link. Please try again.')
    }
  }

  // Manager and the lead owner (canManage) can delete anything; anyone can
  // delete a file they uploaded themselves.
  const canDelete = (file: MediaFile) =>
    canManage || currentUserRole === 'manager' || file.uploadedBy === currentUserId

  const handleDelete = async (file: MediaFile) => {
    if (!window.confirm(`Delete "${file.fileName}"? This cannot be undone.`)) return
    setDeletingId(file.id)
    try {
      await leadsAPI.deleteLeadFile(leadId, file.id)
      setFiles((current) => current.filter((f) => f.id !== file.id))
      if (selected?.id === file.id) setSelected(null)
    } catch (err: any) {
      console.error('Failed to delete lead file:', err)
      setError(err?.response?.data?.message || 'Could not delete the file.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#EFF6FF] to-white border-b border-[#DBEAFE] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center shadow-sm">
            <Paperclip size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Files &amp; Documents</p>
            <p className="text-[10px] text-[#64748B]">
              {files.length === 0
                ? 'Attach documents, plans, agreements or photos'
                : `${files.length} file${files.length !== 1 ? 's' : ''} attached to this lead`}
            </p>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#1D4ED8] text-white text-[11px] font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload
          </button>
        )}
        <input ref={fileInputRef} type="file" multiple onChange={onFileInputChange} className="hidden" />
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[11px] font-medium text-[#B91C1C] flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError('')} className="shrink-0 text-[#B91C1C] hover:text-[#7F1D1D]">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Drop zone — only for users who can manage this lead */}
        {canManage && (
          <div
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-[#1D4ED8] bg-[#EFF6FF]' : 'border-[#CBD5E1] bg-[#FAFCFF] hover:border-[#93C5FD]'
            }`}
          >
            {uploading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#1D4ED8]">
                  <Loader2 size={14} className="animate-spin" />
                  Uploading {uploadName}…
                </div>
                <div className="max-w-xs mx-auto h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className="h-full bg-[#1D4ED8] transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#64748B]">{uploadProgress}%</p>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 mx-auto rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                  <Upload size={16} className="text-[#1D4ED8]" />
                </div>
                <p className="text-[11px] font-bold text-[#0F172A] mt-2">
                  {isDragging ? 'Drop the files here' : 'Drag & drop files here, or click to browse'}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">Any file type up to 100 MB. Multiple files supported.</p>
              </>
            )}
          </div>
        )}

        {/* File grid */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-semibold text-[#64748B]">
            <Loader2 size={15} className="animate-spin" />
            Loading files…
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-xl border border-dashed border-[#E2E8F0] bg-[#FAFCFF]">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto mb-2 shadow-sm border border-[#E2E8F0]">
              <Paperclip size={16} className="text-[#94A3B8]" />
            </div>
            <p className="text-[11px] text-[#64748B]">No files attached yet</p>
            {canManage && (
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Upload documents, plans or photos for this lead</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {files.map((file) => {
              const meta = kindMeta[file.kind]
              const Icon = meta.icon
              return (
                <div
                  key={file.id}
                  onClick={() => setSelected(file)}
                  className="group relative rounded-xl border border-[#E2E8F0] bg-white overflow-hidden hover:border-[#93C5FD] hover:shadow-sm transition-all cursor-pointer"
                >
                  {/* Thumbnail / icon */}
                  <div className="aspect-[4/3] bg-[#F8FAFC] flex items-center justify-center overflow-hidden">
                    {file.kind === 'image' && file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.fileName}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: meta.bg }}
                      >
                        <Icon size={20} style={{ color: meta.color }} />
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="p-2.5">
                    <p className="text-[11px] font-bold text-[#0F172A] truncate" title={file.fileName}>
                      {file.fileName}
                    </p>
                    <p className="text-[9px] text-[#94A3B8] mt-0.5">
                      {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                    </p>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDownload(file)
                      }}
                      title="Download"
                      className="w-6 h-6 rounded-md bg-white/90 border border-[#E2E8F0] flex items-center justify-center text-[#475569] hover:text-[#1D4ED8] hover:border-[#93C5FD] shadow-sm"
                    >
                      <Download size={12} />
                    </button>
                    {canDelete(file) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(file)
                        }}
                        disabled={deletingId === file.id}
                        title="Delete"
                        className="w-6 h-6 rounded-md bg-white/90 border border-[#E2E8F0] flex items-center justify-center text-[#475569] hover:text-[#DC2626] hover:border-[#FECACA] shadow-sm disabled:opacity-50"
                      >
                        {deletingId === file.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <MediaPreviewModal
          file={selected}
          canDelete={canDelete(selected)}
          deleting={deletingId === selected.id}
          onClose={() => setSelected(null)}
          onDownload={() => void handleDownload(selected)}
          onDelete={() => void handleDelete(selected)}
        />
      )}
    </div>
  )
}

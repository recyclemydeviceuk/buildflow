import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  Upload,
  Search,
  Loader2,
  Download,
  Trash2,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  FolderOpen,
  X,
} from 'lucide-react'
import { mediaAPI, type MediaFile, type MediaKind } from '../api/media'
import { useAuth } from '../context/AuthContext'
import { formatFileSize } from '../utils/formatFileSize'
import MediaPreviewModal from '../components/media/MediaPreviewModal'

const KIND_FILTERS: { value: MediaKind | ''; label: string }[] = [
  { value: '', label: 'All files' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'spreadsheet', label: 'Spreadsheets' },
  { value: 'document', label: 'Documents' },
  { value: 'archive', label: 'Archives' },
  { value: 'other', label: 'Other' },
]

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
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function MediaLibrary() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [kind, setKind] = useState<MediaKind | ''>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadName, setUploadName] = useState('')

  const [selected, setSelected] = useState<MediaFile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Debounce the search box so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(t)
  }, [search])

  // Reset to page 1 whenever the query changes.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, kind])

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await mediaAPI.list({ page, limit: 30, search: debouncedSearch, kind })
      if (res.success) {
        setFiles(res.data)
        setTotalPages(res.meta.totalPages || 1)
        setTotal(res.meta.total || 0)
      }
    } catch (err) {
      console.error('Failed to load media files:', err)
      setError('Could not load the media library right now.')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, kind])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setError('')
    // Upload sequentially so the progress bar reflects one file at a time.
    for (const file of Array.from(fileList)) {
      setUploading(true)
      setUploadName(file.name)
      setUploadProgress(0)
      try {
        await mediaAPI.upload(file, {
          onProgress: (percent) => setUploadProgress(percent),
        })
      } catch (err: any) {
        console.error('Upload failed:', err)
        setError(err?.response?.data?.message || `Could not upload "${file.name}".`)
      }
    }
    setUploading(false)
    setUploadName('')
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
    // Reload from the first page so freshly uploaded files show at the top.
    if (page !== 1) setPage(1)
    else void loadFiles()
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
      const res = await mediaAPI.getDownloadUrl(file.id)
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

  const canDelete = (file: MediaFile) => user?.role === 'manager' || file.uploadedBy === user?.id

  const handleDelete = async (file: MediaFile) => {
    if (!window.confirm(`Delete "${file.fileName}"? This cannot be undone.`)) return
    setDeletingId(file.id)
    try {
      await mediaAPI.remove(file.id)
      setFiles((current) => current.filter((f) => f.id !== file.id))
      setTotal((t) => Math.max(0, t - 1))
      if (selected?.id === file.id) setSelected(null)
    } catch (err: any) {
      console.error('Failed to delete file:', err)
      setError(err?.response?.data?.message || 'Could not delete the file.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen size={20} className="text-[#1D4ED8]" />
              <h1 className="text-xl font-bold text-[#0F172A]">Media Library</h1>
            </div>
            <p className="text-sm text-[#64748B] mt-1">
              Upload and store any file — images, videos, PDFs, spreadsheets, and more. Preview or download them anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-6">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-[#1D4ED8] bg-[#EFF6FF]' : 'border-[#CBD5E1] bg-white hover:border-[#93C5FD]'
          }`}
        >
          {uploading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#1D4ED8]">
                <Loader2 size={18} className="animate-spin" />
                Uploading {uploadName}…
              </div>
              <div className="max-w-md mx-auto h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div
                  className="h-full bg-[#1D4ED8] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-[#64748B]">{uploadProgress}%</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto rounded-xl bg-[#EFF6FF] flex items-center justify-center">
                <Upload size={22} className="text-[#1D4ED8]" />
              </div>
              <p className="text-sm font-bold text-[#0F172A] mt-3">
                {isDragging ? 'Drop the files here' : 'Drag & drop files here, or click to browse'}
              </p>
              <p className="text-xs text-[#64748B] mt-1">Any file type up to 100 MB. Multiple files supported.</p>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#B91C1C] flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError('')} className="shrink-0 text-[#B91C1C] hover:text-[#7F1D1D]">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files by name…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MediaKind | '')}
            className="px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]"
          >
            {KIND_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-16 flex items-center justify-center gap-3 text-sm font-semibold text-[#64748B]">
            <Loader2 size={18} className="animate-spin" />
            Loading files…
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
              <FolderOpen size={26} className="text-[#94A3B8]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A] mt-4">No files yet</p>
            <p className="text-xs text-[#64748B] mt-1">
              {debouncedSearch || kind ? 'No files match your filters.' : 'Upload your first file to get started.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-[#94A3B8]">{total} file{total !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => {
                const meta = kindMeta[file.kind]
                const Icon = meta.icon
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelected(file)}
                    className="group relative rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden hover:border-[#93C5FD] hover:shadow-sm transition-all cursor-pointer"
                  >
                    {/* Thumbnail / icon area */}
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
                          className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{ background: meta.bg }}
                        >
                          <Icon size={26} style={{ color: meta.color }} />
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="p-3">
                      <p className="text-xs font-bold text-[#0F172A] truncate" title={file.fileName}>
                        {file.fileName}
                      </p>
                      <p className="text-[10px] text-[#94A3B8] mt-1">
                        {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                      </p>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDownload(file)
                        }}
                        title="Download"
                        className="w-7 h-7 rounded-lg bg-white/90 border border-[#E2E8F0] flex items-center justify-center text-[#475569] hover:text-[#1D4ED8] hover:border-[#93C5FD] shadow-sm"
                      >
                        <Download size={14} />
                      </button>
                      {canDelete(file) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(file)
                          }}
                          disabled={deletingId === file.id}
                          title="Delete"
                          className="w-7 h-7 rounded-lg bg-white/90 border border-[#E2E8F0] flex items-center justify-center text-[#475569] hover:text-[#DC2626] hover:border-[#FECACA] shadow-sm disabled:opacity-50"
                        >
                          {deletingId === file.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-[#64748B] px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
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

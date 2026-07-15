import { useEffect, useState } from 'react'
import { X, Download, Trash2, Loader2, FileText, FileArchive, File as FileIcon } from 'lucide-react'
import type { MediaFile } from '../../api/media'
import { formatFileSize } from '../../utils/formatFileSize'

interface MediaPreviewModalProps {
  file: MediaFile
  canDelete: boolean
  onClose: () => void
  onDownload: () => void
  onDelete: () => void
  deleting?: boolean
}

// Renders the actual file preview based on `kind`. Images / video / audio /
// PDF stream straight from the presigned URL. CSV and plain-text are fetched
// and rendered inline. Anything a browser can't display (xlsx, docx, zip, ...)
// falls back to a download prompt.
function PreviewBody({ file }: { file: MediaFile }) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState('')

  const isCsv =
    file.mimeType === 'text/csv' || file.fileName.toLowerCase().endsWith('.csv')
  const isPlainText =
    file.mimeType.startsWith('text/') ||
    ['application/json', 'application/xml'].includes(file.mimeType)
  // We can render CSV and plain-text files inline by fetching their contents.
  // Binary spreadsheets (.xlsx / .xls) are NOT plain text — they fall through
  // to the download fallback.
  const shouldFetchText = isCsv || isPlainText

  useEffect(() => {
    if (!shouldFetchText || !file.previewUrl) return
    let cancelled = false
    setTextLoading(true)
    setTextError('')
    fetch(file.previewUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load file')
        return res.text()
      })
      .then((text) => {
        if (!cancelled) setTextContent(text.slice(0, 500_000))
      })
      .catch(() => {
        if (!cancelled) setTextError('Could not load a preview for this file.')
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [file.previewUrl, shouldFetchText])

  if (!file.previewUrl) {
    return <FallbackPreview file={file} message="Preview link is unavailable right now." />
  }

  if (file.kind === 'image') {
    return (
      <div className="flex items-center justify-center bg-[#0B1120] rounded-xl overflow-hidden">
        <img
          src={file.previewUrl}
          alt={file.fileName}
          className="max-h-[65vh] w-auto max-w-full object-contain"
        />
      </div>
    )
  }

  if (file.kind === 'video') {
    return (
      <video
        src={file.previewUrl}
        controls
        className="w-full max-h-[65vh] rounded-xl bg-black"
      />
    )
  }

  if (file.kind === 'audio') {
    return (
      <div className="p-8 bg-[#F8FAFC] rounded-xl">
        <audio src={file.previewUrl} controls className="w-full" />
      </div>
    )
  }

  if (file.kind === 'pdf') {
    return (
      <iframe
        title={file.fileName}
        src={file.previewUrl}
        className="w-full h-[65vh] rounded-xl border border-[#E2E8F0] bg-white"
      />
    )
  }

  // CSV → simple table. Plain text / JSON / XML → <pre>.
  if (isCsv || isPlainText) {
    if (textLoading) {
      return (
        <div className="flex items-center justify-center gap-2 h-40 text-sm text-[#64748B]">
          <Loader2 size={18} className="animate-spin" /> Loading preview…
        </div>
      )
    }
    if (textError || textContent == null) {
      return <FallbackPreview file={file} message={textError || 'No preview available.'} />
    }
    if (isCsv) {
      return <CsvTable text={textContent} />
    }
    return (
      <pre className="max-h-[65vh] overflow-auto rounded-xl border border-[#E2E8F0] bg-[#0B1120] text-[#E2E8F0] text-xs p-4 whitespace-pre-wrap break-words">
        {textContent}
      </pre>
    )
  }

  return <FallbackPreview file={file} />
}

// Parse a CSV string into a bounded table. Handles quoted fields with commas
// and escaped quotes. Caps rows/cols so a huge sheet doesn't lock up the tab.
function CsvTable({ text }: { text: string }) {
  const rows = parseCsv(text, 200)
  if (rows.length === 0) {
    return <p className="text-sm text-[#64748B] p-4">The file appears to be empty.</p>
  }
  const [header, ...body] = rows
  return (
    <div className="max-h-[65vh] overflow-auto rounded-xl border border-[#E2E8F0]">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-[#F8FAFC] sticky top-0">
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-bold text-[#0F172A] border-b border-[#E2E8F0] whitespace-nowrap"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="odd:bg-white even:bg-[#F8FAFC]/50">
              {header.map((_, c) => (
                <td key={c} className="px-3 py-1.5 text-[#475569] border-b border-[#F1F5F9] whitespace-nowrap">
                  {row[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function parseCsv(text: string, maxRows: number): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (rows.length >= maxRows) return rows
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function FallbackPreview({ file, message }: { file: MediaFile; message?: string }) {
  const Icon = file.kind === 'archive' ? FileArchive : file.kind === 'document' || file.kind === 'spreadsheet' ? FileText : FileIcon
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1]">
      <div className="w-16 h-16 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-center">
        <Icon size={28} className="text-[#1D4ED8]" />
      </div>
      <p className="text-sm font-semibold text-[#0F172A]">
        {message || "This file type can't be previewed in the browser."}
      </p>
      <p className="text-xs text-[#64748B] max-w-sm">
        Download the file to open it in a compatible application.
      </p>
    </div>
  )
}

export default function MediaPreviewModal({
  file,
  canDelete,
  onClose,
  onDownload,
  onDelete,
  deleting,
}: MediaPreviewModalProps) {
  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#0F172A] truncate">{file.fileName}</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {formatFileSize(file.fileSize)} · Uploaded by {file.uploadedByName}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={15} />
              Download
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FECACA] text-[#DC2626] text-sm font-semibold rounded-lg hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors"
            >
              <X size={18} className="text-[#64748B]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-auto">
          <PreviewBody file={file} />
          {file.description && (
            <p className="mt-4 text-sm text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3">
              {file.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

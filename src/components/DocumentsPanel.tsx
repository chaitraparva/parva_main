import { useEffect, useRef, useState } from 'react'
import type { EmployeeDocument, Employee } from '../types'
import { Upload, Download, FileText, Trash2, Loader } from 'lucide-react'
import { DOCUMENT_TYPES, listDocuments, uploadDocument, deleteDocument, downloadDocument, downloadAllDocuments } from '../lib/documentStore'

const navy = '#1C2B4A'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

interface Props {
  /** Whose documents this panel shows/manages. */
  employeeId: string
  employeeName: string
  /** The person currently using the app — used to label uploads made on someone else's behalf. Who actually uploaded a file is recorded server-side from the signed-in session, never trusted from these props. */
  viewerId: string
  viewerName: string
  /** Used only to resolve "uploaded by" names for display; optional since not every screen has the full roster handy. */
  employees?: Employee[]
  /** Can the current viewer add new documents here? Defaults to true. */
  canUpload?: boolean
  /** Can the current viewer remove documents here? Defaults to canUpload. */
  canDelete?: boolean
  title?: string
  description?: string
}

export default function DocumentsPanel({
  employeeId, employeeName, employees = [],
  canUpload = true, canDelete, title = 'Documents', description,
}: Props) {
  const allowDelete = canDelete ?? canUpload
  const [docs, setDocs] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const nameFor = (id: string | null) => (id && employees.find(e => e.id === id)?.name) || id || 'Unknown'

  async function refresh() {
    try {
      setDocs(await listDocuments(employeeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId])

  async function handleFile(file: File | null | undefined) {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      await uploadDocument({ employeeId, docType, file })
      await refresh()
      setFlash(`${docType} uploaded.`)
      setTimeout(() => setFlash(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this file.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: EmployeeDocument) {
    setError('')
    try {
      await deleteDocument(doc.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this document.')
    }
  }

  async function handleDownloadAll() {
    setError('')
    try {
      const ok = await downloadAllDocuments(employeeId, employeeName)
      if (!ok) setError('No documents on file yet to download.')
    } catch {
      setError('Could not download these documents. Please try again.')
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <FileText size={13} /> {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {docs.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download size={13} /> Download All (.zip)
          </button>
        )}
      </div>

      {canUpload && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: navy }}
          >
            {uploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      )}

      {error && <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{error}</p>}
      {flash && <p className="text-xs font-medium" style={{ color: '#059669' }}>✓ {flash}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader size={13} className="animate-spin" /> Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents on file yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText size={15} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.docType}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {doc.fileName} · {formatDate(doc.uploadedAt)}
                    {doc.uploadedById && doc.uploadedById !== employeeId && ` · uploaded by ${nameFor(doc.uploadedById)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => downloadDocument(doc).catch(() => setError('Could not download this file. Please try again.'))}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Download"
                  aria-label={`Download ${doc.docType}`}
                >
                  <Download size={14} />
                </button>
                {allowDelete && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                    aria-label={`Delete ${doc.docType}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

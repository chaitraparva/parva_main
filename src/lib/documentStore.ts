import type { EmployeeDocument } from '../types'
import { readFileAsDataUrl, downloadDataUrl, downloadZip } from './files'

// ─────────────────────── Document storage (temporary) ───────────────────────
// There's no live backend connected yet (it's built — server/src/routes/
// documents.js already uploads to Supabase Storage — but it's waiting on
// Supabase/Vercel Pro to be purchased and connected). Until then, uploaded
// files are kept as base64 data URLs in this browser's localStorage, the
// same stopgap already used for first-time login passwords in Login.tsx.
// Two real limitations this brings until the backend is live: documents
// only exist in the browser they were uploaded from (not shared across
// devices), and localStorage has a small quota (a few MB per browser), so
// there's a per-file size cap below. Both go away once Supabase Storage is
// connected — nothing here needs to change on this screen when that happens,
// only the storage functions underneath it.
const STORAGE_KEY = 'parva_documents'
const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2MB per file — generous for a scanned ID or offer letter PDF while keeping a handful of uploads well under a browser's localStorage quota

export const DOCUMENT_TYPES = [
  'Aadhar Card',
  'PAN Card',
  'Degree Certificate',
  'Offer Letter',
  'Bank Details',
  'NDA',
  'Resume',
  'Other',
]

function readAll(): EmployeeDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as EmployeeDocument[]) : []
  } catch {
    return []
  }
}

function writeAll(docs: EmployeeDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

/** All documents on file for one employee, most recently uploaded first. */
export function listDocuments(employeeId: string): EmployeeDocument[] {
  return readAll()
    .filter(d => d.employeeId === employeeId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function uploadDocument(opts: {
  employeeId: string
  docType: string
  file: File
  uploadedById: string
  uploadedByName: string
}): Promise<EmployeeDocument> {
  if (opts.file.size > MAX_FILE_BYTES) {
    throw new Error(`"${opts.file.name}" is ${(opts.file.size / (1024 * 1024)).toFixed(1)}MB — please upload a file under 2MB.`)
  }
  const dataUrl = await readFileAsDataUrl(opts.file)
  const doc: EmployeeDocument = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeId: opts.employeeId,
    docType: opts.docType,
    fileName: opts.file.name,
    dataUrl,
    uploadedAt: new Date().toISOString(),
    uploadedById: opts.uploadedById,
    uploadedByName: opts.uploadedByName,
  }
  const all = readAll()
  all.push(doc)
  try {
    writeAll(all)
  } catch {
    throw new Error('Could not save this file — your browser storage is full. Try removing an older document first.')
  }
  return doc
}

export function deleteDocument(id: string) {
  writeAll(readAll().filter(d => d.id !== id))
}

export function downloadDocument(doc: EmployeeDocument) {
  downloadDataUrl(doc.fileName, doc.dataUrl)
}

/** Bundles every document on file for one employee into a single .zip. Returns false if there was nothing to download. */
export async function downloadAllDocuments(employeeId: string, employeeName: string): Promise<boolean> {
  const docs = listDocuments(employeeId)
  if (docs.length === 0) return false
  await downloadZip(
    `${employeeName.replace(/\s+/g, '_')}_Documents.zip`,
    docs.map(d => ({ name: `${d.docType} - ${d.fileName}`, dataUrl: d.dataUrl }))
  )
  return true
}

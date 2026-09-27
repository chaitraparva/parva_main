import type { EmployeeDocument } from '../types'
import * as api from './api'
import { downloadZip } from './files'

// ─────────────────────── Document storage (real backend) ───────────────────────
// Backed by Postgres + Supabase Storage (server/src/routes/documents.js) —
// no localStorage involved. Every function here is now async since it talks
// to the network; see DocumentsPanel.tsx for how it's consumed.

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

function fromRaw(raw: api.RawEmployeeDocument): EmployeeDocument {
  return {
    id: raw.id,
    employeeId: raw.employeeId,
    docType: raw.docType,
    fileName: raw.fileName,
    uploadedAt: raw.uploadedAt,
    uploadedById: raw.uploadedBy,
  }
}

/** All documents on file for one employee, most recently uploaded first (the API already orders them this way). */
export async function listDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const raw = await api.fetchDocuments(employeeId)
  return raw.map(fromRaw)
}

export async function uploadDocument(opts: { employeeId: string; docType: string; file: File }): Promise<EmployeeDocument> {
  const raw = await api.uploadDocument(opts)
  return fromRaw(raw)
}

export async function deleteDocument(id: string): Promise<void> {
  await api.deleteDocument(id)
}

/** Downloads one document, forcing its original filename via a short-lived signed URL. */
export async function downloadDocument(doc: EmployeeDocument): Promise<void> {
  const url = await api.fetchDocumentDownloadUrl(doc.id, doc.fileName)
  window.open(url, '_blank')
}

/** Bundles every document on file for one employee into a single .zip. Returns false if there was nothing to download. */
export async function downloadAllDocuments(employeeId: string, employeeName: string): Promise<boolean> {
  const docs = await listDocuments(employeeId)
  if (docs.length === 0) return false
  const files: { name: string; blob: Blob }[] = []
  for (const d of docs) {
    const url = await api.fetchDocumentDownloadUrl(d.id)
    const res = await fetch(url)
    files.push({ name: `${d.docType} - ${d.fileName}`, blob: await res.blob() })
  }
  await downloadZip(`${employeeName.replace(/\s+/g, '_')}_Documents.zip`, files)
  return true
}

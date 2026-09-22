import { Router } from 'express'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

const router = Router()
router.use(requireAuth)

// The service-role key bypasses Supabase's row-level-security policies —
// that's correct here because THIS server is the only thing allowed to
// touch the bucket directly; every access check (who may upload/view which
// employee's documents) happens in this file, not in Supabase itself.
// Never expose this key to the frontend.
//
// Built lazily (not at module load) because createClient() throws
// immediately if the URL/key are missing — doing that eagerly would crash
// the entire server on startup (every route, not just documents) whenever
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aren't set yet, instead of just
// this one module failing the specific requests that need it.
let supabase
function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use document storage.')
    }
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  return supabase
}
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'employee-documents'

// Step 1 of an upload: the frontend asks for a pre-signed upload URL,
// uploads the file directly to Supabase Storage with it (never through this
// server), then calls POST /api/documents to record the metadata. Keeps
// large files off this server entirely.
router.post('/upload-url', requireRole('hr', 'management'), asyncHandler(async (req, res) => {
  const { employeeId, docType, filename, contentType } = req.body || {}
  if (!employeeId || !docType || !filename) {
    return res.status(400).json({ error: 'employeeId, docType and filename are required.' })
  }
  const storagePath = `employees/${employeeId}/${docType}/${crypto.randomUUID()}-${filename}`

  let client
  try {
    client = getSupabase()
  } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'Document storage is not configured yet.' })
  }

  const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(storagePath)
  if (error) {
    console.error('Supabase createSignedUploadUrl failed:', error)
    return res.status(502).json({ error: 'Could not prepare an upload link. Please try again.' })
  }
  res.json({ uploadUrl: data.signedUrl, token: data.token, storagePath, contentType: contentType || 'application/octet-stream' })
}))

// Record the document after a successful upload.
router.post('/', requireRole('hr', 'management'), asyncHandler(async (req, res) => {
  const { employeeId, docType, label, storagePath } = req.body || {}
  if (!employeeId || !docType || !label || !storagePath) {
    return res.status(400).json({ error: 'employeeId, docType, label and storagePath are required.' })
  }
  const { rows } = await pool.query(
    `INSERT INTO employee_documents (employee_id, doc_type, label, storage_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [employeeId, docType, label, storagePath, req.auth.employeeId],
  )
  res.status(201).json({ document: toCamel(rows[0]) })
}))

// List documents for one employee — HR/management can see anyone's; an
// employee can see only their own.
router.get('/', asyncHandler(async (req, res) => {
  const { employeeId } = req.query
  if (!employeeId) return res.status(400).json({ error: 'employeeId query param is required.' })
  if (employeeId !== req.auth.employeeId && !['hr', 'management'].includes(req.auth.loginRole)) {
    return res.status(403).json({ error: 'You can only view your own documents.' })
  }
  const { rows } = await pool.query(
    'SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC',
    [employeeId],
  )
  res.json({ documents: rows.map(toCamel) })
}))

// A short-lived download link for one document — never a permanent public
// URL. Same ownership check as the list endpoint above.
router.get('/:id/download-url', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM employee_documents WHERE id = $1', [req.params.id])
  const doc = rows[0]
  if (!doc) return res.status(404).json({ error: 'Not found.' })
  if (doc.employee_id !== req.auth.employeeId && !['hr', 'management'].includes(req.auth.loginRole)) {
    return res.status(403).json({ error: 'You can only download your own documents.' })
  }
  let client
  try {
    client = getSupabase()
  } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'Document storage is not configured yet.' })
  }

  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(doc.storage_path, 120) // 2 minutes
  if (error) {
    console.error('Supabase createSignedUrl failed:', error)
    return res.status(502).json({ error: 'Could not prepare a download link. Please try again.' })
  }
  res.json({ downloadUrl: data.signedUrl })
}))

export default router

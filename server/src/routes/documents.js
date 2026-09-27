import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { getSupabaseAdmin } from '../lib/supabase-admin.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

// Real backend storage for employee documents (Supabase Storage), replacing
// the old client-only localStorage/base64-dataUrl approach. Uses the same
// base64-through-server upload pattern as expense-receipts.js (not the
// direct-to-storage signed-upload-URL flow this file used to have — that
// needs a Supabase anon key + CORS on the frontend, which was never set up,
// so no upload here ever actually worked end-to-end).
const router = Router()
router.use(requireAuth)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'employee-documents'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

// An employee can always manage their own documents (My Portal, Profile);
// HR/management can manage anyone's, including uploading on an employee's
// behalf from the Directory screen.
function canAccess(auth, employeeId) {
  return employeeId === auth.employeeId || ['hr', 'management'].includes(auth.loginRole)
}

// Upload one document.
router.post('/', asyncHandler(async (req, res) => {
  const { employeeId, docType, filename, contentType, dataBase64 } = req.body || {}
  if (!employeeId || !docType || !filename || !dataBase64) {
    return res.status(400).json({ error: 'employeeId, docType, filename and dataBase64 are required.' })
  }
  if (!canAccess(req.auth, employeeId)) {
    return res.status(403).json({ error: 'You can only upload your own documents.' })
  }

  const buffer = Buffer.from(dataBase64, 'base64')
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'File must be 5MB or smaller.' })
  }

  let client
  try {
    client = getSupabaseAdmin()
  } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'Document storage is not configured yet.' })
  }

  const storagePath = `employees/${employeeId}/${crypto.randomUUID()}-${filename}`
  const upload = () => client.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: false,
  })

  let { error: uploadError } = await upload()
  if (uploadError && /bucket.*not.*found/i.test(uploadError.message || '')) {
    // Auto-create the bucket on the one-time "bucket doesn't exist" case,
    // then retry once, so this never needs a manual Supabase dashboard step.
    const { error: createError } = await client.storage.createBucket(BUCKET, { public: false })
    if (createError) {
      console.error('Supabase createBucket failed:', createError)
      return res.status(502).json({ error: 'Could not upload this file. Please try again.' })
    }
    ; ({ error: uploadError } = await upload())
  }
  if (uploadError) {
    console.error('Supabase document upload failed:', uploadError)
    return res.status(502).json({ error: 'Could not upload this file. Please try again.' })
  }

  const { rows } = await pool.query(
    `INSERT INTO employee_documents (employee_id, doc_type, label, file_name, storage_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [employeeId, docType, docType, filename, storagePath, req.auth.employeeId],
  )
  res.status(201).json({ document: toCamel(rows[0]) })
}))

// List documents for one employee — HR/management can see anyone's; an
// employee can see only their own.
router.get('/', asyncHandler(async (req, res) => {
  const { employeeId } = req.query
  if (!employeeId) return res.status(400).json({ error: 'employeeId query param is required.' })
  if (!canAccess(req.auth, String(employeeId))) {
    return res.status(403).json({ error: 'You can only view your own documents.' })
  }
  const { rows } = await pool.query(
    'SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC',
    [employeeId],
  )
  res.json({ documents: rows.map(toCamel) })
}))

// A short-lived download link for one document — never a permanent public
// URL. ?download=<filename> forces a real browser download (same pattern as
// expense-receipts.js) instead of a link meant just for inline viewing.
router.get('/:id/download-url', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM employee_documents WHERE id = $1', [req.params.id])
  const doc = rows[0]
  if (!doc) return res.status(404).json({ error: 'Not found.' })
  if (!canAccess(req.auth, doc.employee_id)) {
    return res.status(403).json({ error: 'You can only download your own documents.' })
  }

  let client
  try {
    client = getSupabaseAdmin()
  } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'Document storage is not configured yet.' })
  }

  const downloadName = typeof req.query.download === 'string' ? req.query.download : undefined
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 120, downloadName ? { download: downloadName } : undefined) // 2 minutes
  if (error) {
    console.error('Supabase createSignedUrl failed:', error)
    return res.status(502).json({ error: 'Could not prepare a download link. Please try again.' })
  }
  res.json({ downloadUrl: data.signedUrl })
}))

// Delete a document — same ownership rule as everything else above.
router.delete('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM employee_documents WHERE id = $1', [req.params.id])
  const doc = rows[0]
  if (!doc) return res.status(404).json({ error: 'Not found.' })
  if (!canAccess(req.auth, doc.employee_id)) {
    return res.status(403).json({ error: 'You can only delete your own documents.' })
  }

  await pool.query('DELETE FROM employee_documents WHERE id = $1', [req.params.id])

  // Best-effort cleanup of the storage object — the DB row is already gone
  // either way, and an orphaned object isn't visible or harmful to anyone.
  try {
    const client = getSupabaseAdmin()
    await client.storage.from(BUCKET).remove([doc.storage_path])
  } catch {
    // Storage not configured, or the remove failed — nothing more to do.
  }

  res.status(204).end()
}))

export default router

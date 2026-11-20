import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { getSupabaseAdmin } from '../lib/supabase-admin.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

// The optional PDF / image of a branch's Annual Holiday List. HR and
// management upload and delete; every signed-in employee can view the files of
// THEIR OWN branch (HR and management can view every branch).
// Same base64-through-server storage pattern as documents.js.
const router = Router()
router.use(requireAuth)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'employee-documents'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const EDIT_ROLES = ['hr', 'management']

// Must match branchOf() in src/lib/holidays.ts.
export function branchOf(location) {
  const l = String(location || '').trim()
  if (/bangalore|bengaluru/i.test(l)) return 'Bangalore'
  if (/dubai|uae|abu dhabi|sharjah/i.test(l)) return 'Dubai'
  if (/dehradun/i.test(l)) return 'Dehradun'
  if (/tumkur/i.test(l)) return 'Tumkur'
  return l || 'Other'
}

async function myBranch(auth) {
  const { rows } = await pool.query('SELECT location FROM employees WHERE id = $1', [auth.employeeId])
  return branchOf(rows[0]?.location)
}

const canSee = async (auth, branch) =>
  EDIT_ROLES.includes(auth.loginRole) || branch === (await myBranch(auth))

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM holiday_list_files ORDER BY year DESC, uploaded_at DESC')
  if (EDIT_ROLES.includes(req.auth.loginRole)) return res.json({ files: rows.map(toCamel) })
  const mine = await myBranch(req.auth)
  res.json({ files: rows.filter(r => r.branch === mine).map(toCamel) })
}))

router.post('/', asyncHandler(async (req, res) => {
  if (!EDIT_ROLES.includes(req.auth.loginRole)) {
    return res.status(403).json({ error: 'Only HR can upload a holiday list.' })
  }
  const { branch, year, filename, contentType, dataBase64 } = req.body || {}
  if (!branch || !year || !filename || !dataBase64) {
    return res.status(400).json({ error: 'branch, year, filename and dataBase64 are required.' })
  }
  if (!/^(application\/pdf|image\/)/.test(String(contentType || ''))) {
    return res.status(400).json({ error: 'Please upload a PDF or an image.' })
  }
  const buffer = Buffer.from(dataBase64, 'base64')
  if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'File must be 5MB or smaller.' })

  let client
  try { client = getSupabaseAdmin() } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'File storage is not configured yet.' })
  }

  const safeName = String(filename).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(-120) || 'file'
  const safeBranch = String(branch).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40) || 'branch'
  const storagePath = `holiday-lists/${safeBranch}/${crypto.randomUUID()}-${safeName}`
  const upload = () => client.storage.from(BUCKET).upload(storagePath, buffer, { contentType, upsert: false })
  let { error: uploadError } = await upload()
  if (uploadError && /bucket.*not.*found/i.test(uploadError.message || '')) {
    const { error: createError } = await client.storage.createBucket(BUCKET, { public: false })
    if (createError) {
      console.error('Supabase createBucket failed:', createError)
      return res.status(502).json({ error: 'Could not upload this file. Please try again.' })
    }
    ; ({ error: uploadError } = await upload())
  }
  if (uploadError) {
    console.error('Supabase holiday list upload failed:', uploadError)
    return res.status(502).json({ error: 'Could not upload this file. Please try again.' })
  }

  const { rows } = await pool.query(
    `INSERT INTO holiday_list_files (branch, year, file_name, storage_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [String(branch), Number(year), String(filename), storagePath, req.auth.employeeId],
  )
  res.status(201).json({ file: toCamel(rows[0]) })
}))

router.get('/:id/download-url', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM holiday_list_files WHERE id = $1', [req.params.id])
  const f = rows[0]
  if (!f) return res.status(404).json({ error: 'Not found.' })
  if (!(await canSee(req.auth, f.branch))) return res.status(403).json({ error: 'This holiday list is for another branch.' })

  let client
  try { client = getSupabaseAdmin() } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'File storage is not configured yet.' })
  }
  const downloadName = typeof req.query.download === 'string' ? req.query.download : undefined
  const { data, error } = await client.storage.from(BUCKET)
    .createSignedUrl(f.storage_path, 120, downloadName ? { download: downloadName } : undefined)
  if (error) {
    console.error('Supabase createSignedUrl failed:', error)
    return res.status(502).json({ error: 'Could not prepare a download link. Please try again.' })
  }
  res.json({ downloadUrl: data.signedUrl })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!EDIT_ROLES.includes(req.auth.loginRole)) return res.status(403).json({ error: 'Only HR can delete a holiday list.' })
  const { rows } = await pool.query('SELECT * FROM holiday_list_files WHERE id = $1', [req.params.id])
  const f = rows[0]
  if (!f) return res.status(404).json({ error: 'Not found.' })
  await pool.query('DELETE FROM holiday_list_files WHERE id = $1', [req.params.id])
  try { await getSupabaseAdmin().storage.from(BUCKET).remove([f.storage_path]) } catch { /* orphaned object is harmless */ }
  res.status(204).end()
}))

export default router

import { Router } from 'express'
import crypto from 'node:crypto'
import { requireAuth } from '../auth.js'
import { getSupabaseAdmin } from '../lib/supabase-admin.js'
import { asyncHandler } from '../lib/async-handler.js'

// Real backend storage for employee profile photos (Supabase Storage),
// replacing the old client-only approach in Profile.tsx where a picked
// photo only ever lived as a data: URL in that one browser tab — it was
// never sent to the server, so it vanished on refresh and no one else
// (Org Chart, Directory, anywhere else employees.photoUrl is shown) ever
// saw it. Same base64-over-JSON pattern as expense-receipts.js (not the
// signed-upload-URL pattern documents.js uses, which needs a Supabase
// anon key on the frontend) — this server does the Storage write itself
// with the service-role admin client.
//
// Unlike receipts/documents, this bucket is PUBLIC and employees.photo_url
// stores a plain public URL. Org Chart, Directory, tickets etc. all render
// a colleague's photo as a plain <img src={photoUrl}> for many employees
// at once — a private bucket's short-lived signed URLs (see
// expense-receipts.js) would mean constantly refetching a new URL per
// avatar, which doesn't fit that "render a whole tree/list" use case. A
// profile photo isn't sensitive the way a receipt or HR document is, so a
// public URL is the right tradeoff here.
const router = Router()
router.use(requireAuth)

const BUCKET = process.env.SUPABASE_PROFILE_PHOTOS_BUCKET || 'profile-photos'
const MAX_BYTES = 3 * 1024 * 1024 // 3MB — an avatar, not a document

// Always uploads for the SIGNED-IN employee (req.auth.employeeId) — there's
// no :id in the URL, so there's no "upload a photo for someone else" path
// to lock down in the first place, same shape as PATCH /employees/me.
router.post('/', asyncHandler(async (req, res) => {
  const { filename, contentType, dataBase64 } = req.body || {}
  if (!filename || !dataBase64) {
    return res.status(400).json({ error: 'filename and dataBase64 are required.' })
  }
  if (!/^image\//.test(contentType || '')) {
    return res.status(400).json({ error: 'Profile photo must be an image file.' })
  }

  const buffer = Buffer.from(dataBase64, 'base64')
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'Profile photo must be 3MB or smaller.' })
  }

  let client
  try {
    client = getSupabaseAdmin()
  } catch (err) {
    console.error(err.message)
    return res.status(503).json({ error: 'Photo storage is not configured yet.' })
  }

  const storagePath = `${req.auth.employeeId}/${crypto.randomUUID()}-${filename}`
  const doUpload = () => client.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: false,
  })

  let { error: uploadError } = await doUpload()
  if (uploadError && /bucket.*not.*found/i.test(uploadError.message || '')) {
    // Auto-create the bucket on the one-time "doesn't exist yet" case, same
    // as expense-receipts.js — public: true (unlike that one) is what makes
    // getPublicUrl() below actually resolve to a viewable image.
    const { error: createError } = await client.storage.createBucket(BUCKET, { public: true })
    if (!createError) {
      ;({ error: uploadError } = await doUpload())
    } else {
      console.error('Supabase createBucket failed:', createError)
      return res.status(502).json({ error: 'Could not upload your photo. Please try again.' })
    }
  }
  if (uploadError) {
    console.error('Supabase profile photo upload failed:', uploadError)
    return res.status(502).json({ error: 'Could not upload your photo. Please try again.' })
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(storagePath)
  res.status(201).json({ photoUrl: data.publicUrl })
}))

export default router

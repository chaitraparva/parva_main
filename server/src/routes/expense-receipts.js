import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { getSupabaseAdmin } from '../lib/supabase-admin.js'
import { asyncHandler } from '../lib/async-handler.js'

// Real backend storage for expense-claim receipt photos (Supabase Storage),
// replacing the old client-only receiptDataUrl/placeholder-SVG approach.
// Deliberately NOT the direct-to-storage signed-upload-URL pattern
// documents.js uses (that needs a Supabase anon key on the frontend) —
// instead the frontend sends the file as base64 and this server does the
// storage write itself, using the same service-role admin client the
// password-reset feature already built (getSupabaseAdmin()).
const router = Router()
router.use(requireAuth)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'employee-documents'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

function canAccessClaim(auth, claim) {
    return claim.employee_id === auth.employeeId || ['hr', 'management', 'finance', 'manager'].includes(auth.loginRole)
}

// Upload (or replace) the receipt photo for one expense claim. Records the
// resulting storage key on the claim row directly — the generic
// expense-claims CRUD router already lists receiptS3Key/receiptFilename in
// its allowedColumns, so no separate schema/columns work was needed here.
router.post('/:claimId', asyncHandler(async (req, res) => {
    const { filename, contentType, dataBase64 } = req.body || {}
    if (!filename || !dataBase64) {
        return res.status(400).json({ error: 'filename and dataBase64 are required.' })
    }

    const { rows } = await pool.query(
        'SELECT id, employee_id, receipt_s3_key FROM expense_claims WHERE id = $1',
        [req.params.claimId],
    )
    const claim = rows[0]
    if (!claim) return res.status(404).json({ error: 'Expense claim not found.' })
    if (!canAccessClaim(req.auth, claim)) {
        return res.status(403).json({ error: 'You can only upload a receipt for your own claim.' })
    }

    const buffer = Buffer.from(dataBase64, 'base64')
    if (buffer.length > MAX_BYTES) {
        return res.status(413).json({ error: 'Receipt photo must be 5MB or smaller.' })
    }

    let client
    try {
        client = getSupabaseAdmin()
    } catch (err) {
        console.error(err.message)
        return res.status(503).json({ error: 'Receipt storage is not configured yet.' })
    }

    const storagePath = `expense-receipts/${claim.employee_id}/${claim.id}/${crypto.randomUUID()}-${filename}`
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: false,
    })
    if (uploadError) {
        // Auto-create the bucket on the one-time "bucket doesn't exist" case,
        // then retry once, so this never needs a manual Supabase dashboard step.
        if (/bucket.*not.*found/i.test(uploadError.message || '')) {
            const { error: createError } = await client.storage.createBucket(BUCKET, { public: false })
            if (!createError) {
                const retry = await client.storage.from(BUCKET).upload(storagePath, buffer, {
                    contentType: contentType || 'application/octet-stream',
                    upsert: false,
                })
                if (retry.error) {
                    console.error('Supabase receipt upload retry failed:', retry.error)
                    return res.status(502).json({ error: 'Could not upload the receipt. Please try again.' })
                }
            } else {
                console.error('Supabase createBucket failed:', createError)
                return res.status(502).json({ error: 'Could not upload the receipt. Please try again.' })
            }
        } else {
            console.error('Supabase receipt upload failed:', uploadError)
            return res.status(502).json({ error: 'Could not upload the receipt. Please try again.' })
        }
    }

    // Best-effort cleanup of the previous file so replacing a receipt doesn't
    // pile up orphaned objects in the bucket. Never blocks the response.
    if (claim.receipt_s3_key) {
        client.storage.from(BUCKET).remove([claim.receipt_s3_key]).catch(() => { })
    }

    const { rows: updated } = await pool.query(
        'UPDATE expense_claims SET receipt_s3_key = $1, receipt_filename = $2 WHERE id = $3 RETURNING receipt_s3_key, receipt_filename',
        [storagePath, filename, claim.id],
    )

    res.status(201).json({
        receiptS3Key: updated[0].receipt_s3_key,
        receiptFilename: updated[0].receipt_filename,
    })
}))

// A short-lived signed URL to view/download one claim's receipt — never a
// permanent public URL, same pattern as documents.js.
router.get('/:claimId/download-url', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id, employee_id, receipt_s3_key FROM expense_claims WHERE id = $1',
        [req.params.claimId],
    )
    const claim = rows[0]
    if (!claim) return res.status(404).json({ error: 'Expense claim not found.' })
    if (!canAccessClaim(req.auth, claim)) {
        return res.status(403).json({ error: 'You can only view your own receipt.' })
    }
    if (!claim.receipt_s3_key) {
        return res.status(404).json({ error: 'No receipt on file for this claim.' })
    }

    let client
    try {
        client = getSupabaseAdmin()
    } catch (err) {
        console.error(err.message)
        return res.status(503).json({ error: 'Receipt storage is not configured yet.' })
    }

    // ?download=<filename> forces a real browser download (Content-Disposition)
    // instead of a link meant for inline viewing — used by the "Download"
    // buttons, as opposed to the "view receipt" preview.
    const downloadName = typeof req.query.download === 'string' ? req.query.download : undefined
    const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(claim.receipt_s3_key, 120, downloadName ? { download: downloadName } : undefined) // 2 minutes
    if (error) {
        console.error('Supabase createSignedUrl failed:', error)
        return res.status(502).json({ error: 'Could not prepare a download link. Please try again.' })
    }
    res.json({ downloadUrl: data.signedUrl })
}))

export default router

// One-off maintenance endpoints — not part of the app's normal flow, and
// deliberately NOT protected by the regular employee login (there's a
// chicken-and-egg problem: this route exists to set up the accounts that
// login depends on). Guarded instead by a separate shared secret
// (ADMIN_SYNC_SECRET) that only you know, passed as a header.
import { Router } from 'express'
import { pool } from '../db.js'
import { getSupabaseAdmin } from '../lib/supabase-admin.js'
import { asyncHandler } from '../lib/async-handler.js'

const router = Router()

function requireAdminSecret(req, res, next) {
    const expected = process.env.ADMIN_SYNC_SECRET
    if (!expected) {
        return res.status(500).json({ error: 'ADMIN_SYNC_SECRET is not set on the server.' })
    }
    if (req.get('X-Admin-Secret') !== expected) {
        return res.status(401).json({ error: 'Missing or wrong X-Admin-Secret header.' })
    }
    next()
}

// Creates a Supabase Auth user for every employee who has a registered
// email and doesn't already have one — this is what lets
// supabase.auth.resetPasswordForEmail(...) actually find an account to
// email (Supabase only sends the email when one exists; it can't create
// one on the fly). No password is set on these accounts — they exist
// purely so Supabase recognizes the email and will send a recovery link
// for it. Safe to call more than once: existing accounts are left alone.
router.post('/sync-auth-users', requireAdminSecret, asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
        `SELECT id, name, email FROM employees WHERE status = 'active' AND email != ''`,
    )
    const supabase = getSupabaseAdmin()
    const results = []

    for (const employee of rows) {
        const email = employee.email.trim().toLowerCase()
        const { error } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { employeeId: employee.id, name: employee.name },
        })
        if (error) {
            // "already been registered" is the expected, harmless case on a
            // second run — anything else is worth surfacing.
            const already = /already.*registered/i.test(error.message || '')
            results.push({ id: employee.id, email, ok: already, note: already ? 'already existed' : error.message })
        } else {
            results.push({ id: employee.id, email, ok: true, note: 'created' })
        }
    }

    const failed = results.filter(r => !r.ok)
    res.json({ total: results.length, created: results.filter(r => r.note === 'created').length, failed })
}))

export default router
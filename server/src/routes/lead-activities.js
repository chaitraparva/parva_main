import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

// A lead's activity log (calls, emails, notes, site visits, WhatsApp
// messages) lives in its own table (lead_activities, one row per entry) —
// the same relational-list pattern used for ticket_comments, rather than a
// JSON array column on leads. Who logged an activity is always taken from
// the signed-in session (never trusted from the request body), so nobody
// can log an activity under someone else's name.
const router = Router()
router.use(requireAuth)

function canAccessLead(auth, lead) {
    return lead.assigned_to === auth.employeeId || ['manager', 'hr', 'management'].includes(auth.loginRole)
}

// Every activity the signed-in user is allowed to see: manager/HR/
// management see every activity on every lead; a CRM agent sees only
// activities on leads assigned to them. Fetched once per session on the
// frontend, same as every other resource, then grouped client-side by
// leadId.
router.get('/', asyncHandler(async (req, res) => {
    const isStaff = ['manager', 'hr', 'management'].includes(req.auth.loginRole)
    const { rows } = isStaff
        ? await pool.query('SELECT * FROM lead_activities ORDER BY created_at ASC')
        : await pool.query(
            `SELECT la.* FROM lead_activities la
         JOIN leads l ON l.id = la.lead_id
         WHERE l.assigned_to = $1
         ORDER BY la.created_at ASC`,
            [req.auth.employeeId],
        )
    res.json({ lead_activities: rows.map(toCamel) })
}))

router.post('/', asyncHandler(async (req, res) => {
    const { leadId, type, description } = req.body || {}
    const validTypes = ['call', 'email', 'note', 'site-visit', 'whatsapp']
    if (!leadId || !validTypes.includes(type) || !description || !String(description).trim()) {
        return res.status(400).json({ error: 'leadId, a valid type, and a description are required.' })
    }
    const { rows: leadRows } = await pool.query('SELECT id, assigned_to FROM leads WHERE id = $1', [leadId])
    const lead = leadRows[0]
    if (!lead) return res.status(404).json({ error: 'Lead not found.' })
    if (!canAccessLead(req.auth, lead)) {
        return res.status(403).json({ error: 'You can only log activity on leads assigned to you.' })
    }

    const { rows: empRows } = await pool.query('SELECT name FROM employees WHERE id = $1', [req.auth.employeeId])
    const byName = empRows[0]?.name || 'Unknown'

    const { rows } = await pool.query(
        `INSERT INTO lead_activities (lead_id, type, description, by_name) VALUES ($1, $2, $3, $4) RETURNING *`,
        [leadId, type, String(description).trim(), byName],
    )
    // Keep the lead's last_activity in step with its own activity log,
    // rather than relying on the frontend to remember to PATCH it separately.
    await pool.query('UPDATE leads SET last_activity = now() WHERE id = $1', [leadId])
    res.status(201).json({ lead_activity: toCamel(rows[0]) })
}))

export default router

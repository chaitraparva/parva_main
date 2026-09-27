import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

// Replies on an employee ticket live in their own table (ticket_comments,
// one row per reply) rather than a JSON array column on tickets — a real
// relational list, unlike the "PATCH the whole array" pattern the frontend
// used to fake this with in memory. Who posted a comment, and whether they
// posted it as the employee or as HR, is always taken from the signed-in
// session (never from the request body), so nobody can post a reply under
// someone else's name or pretend to be HR.
const router = Router()
router.use(requireAuth)

function canAccessTicket(auth, ticket) {
    return ticket.employee_id === auth.employeeId || ['hr', 'management'].includes(auth.loginRole)
}

// Every comment the signed-in user is allowed to see: HR/management see
// every comment on every ticket; an employee sees only comments on tickets
// they raised. Fetched once per session on the frontend, same as every
// other resource, then grouped client-side by ticketId.
router.get('/', asyncHandler(async (req, res) => {
    const isStaff = ['hr', 'management'].includes(req.auth.loginRole)
    const { rows } = isStaff
        ? await pool.query('SELECT * FROM ticket_comments ORDER BY created_at ASC')
        : await pool.query(
            `SELECT tc.* FROM ticket_comments tc
         JOIN tickets t ON t.id = tc.ticket_id
         WHERE t.employee_id = $1
         ORDER BY tc.created_at ASC`,
            [req.auth.employeeId],
        )
    res.json({ ticket_comments: rows.map(toCamel) })
}))

router.post('/', asyncHandler(async (req, res) => {
    const { ticketId, body } = req.body || {}
    if (!ticketId || !body || !String(body).trim()) {
        return res.status(400).json({ error: 'ticketId and body are required.' })
    }
    const { rows: ticketRows } = await pool.query('SELECT id, employee_id FROM tickets WHERE id = $1', [ticketId])
    const ticket = ticketRows[0]
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' })
    if (!canAccessTicket(req.auth, ticket)) {
        return res.status(403).json({ error: 'You can only comment on your own tickets.' })
    }

    const { rows: empRows } = await pool.query('SELECT name FROM employees WHERE id = $1', [req.auth.employeeId])
    const byName = empRows[0]?.name || 'Unknown'
    const byRole = ['hr', 'management'].includes(req.auth.loginRole) ? 'hr' : 'employee'

    const { rows } = await pool.query(
        `INSERT INTO ticket_comments (ticket_id, by_name, by_role, body) VALUES ($1, $2, $3, $4) RETURNING *`,
        [ticketId, byName, byRole, String(body).trim()],
    )
    res.status(201).json({ ticket_comment: toCamel(rows[0]) })
}))

export default router

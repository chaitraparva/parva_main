import { Router } from 'express'
import { pool } from '../db.js'
import { asyncHandler } from '../lib/async-handler.js'

const router = Router()

// A handful of aggregate counts shown on the sign-in screen (before anyone
// is authenticated) — just numbers, never any individual employee's name,
// email, or other details, so it's safe to expose without requireAuth.
router.get('/stats', asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM employees WHERE status = 'active') AS employees,
      (SELECT count(DISTINCT company) FROM employees WHERE status = 'active' AND company != '') AS companies,
      (SELECT count(*) FROM tickets WHERE status IN ('Open', 'In Progress', 'Pending Info')) AS open_tickets,
      (SELECT count(*) FROM exit_records WHERE status != 'Completed') AS active_exits
  `)
    const row = rows[0]
    res.json({
        employees: Number(row.employees),
        companies: Number(row.companies),
        openTickets: Number(row.open_tickets),
        activeExits: Number(row.active_exits),
    })
}))

export default router
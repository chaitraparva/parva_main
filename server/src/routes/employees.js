import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

const router = Router()

// Columns safe to return to any signed-in user — password_hash and
// login_role are deliberately excluded from list/detail responses.
const PUBLIC_COLUMNS = `
  id, name, job_title, title, email, phone, team, manager_id, join_date,
  status, department, leads_assigned, conversions, base_salary,
  response_time, location, photo_url, company
`

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM employees ORDER BY name`)
  res.json({ employees: rows.map(toCamel) })
}))

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM employees WHERE id = $1`, [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
  res.json({ employee: toCamel(rows[0]) })
}))

// Self-service profile editing — an employee may update their own personal/
// contact details. Deliberately a short allow-list, not "everything except
// email": HR-controlled fields (job_title, login_roles, manager_id,
// base_salary, status, department, team, company, join_date) stay off this
// list even though the employee technically owns the row, because letting
// someone edit their own salary, manager, or portal access would be a real
// security/data-integrity hole, not just a UX one. email is excluded on
// purpose — it's the registered login identifier, changeable only by HR.
const SELF_EDITABLE_FIELDS = {
  name: 'name',
  phone: 'phone',
  location: 'location',
  photoUrl: 'photo_url',
}

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const updates = req.body || {}
  const setClauses = []
  const values = []

  for (const [field, column] of Object.entries(SELF_EDITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) continue
    values.push(updates[field])
    setClauses.push(`${column} = $${values.length}`)
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No editable fields were provided.' })
  }

  values.push(req.auth.employeeId)
  const { rows } = await pool.query(
    `UPDATE employees SET ${setClauses.join(', ')}, updated_at = now()
     WHERE id = $${values.length}
     RETURNING ${PUBLIC_COLUMNS}`,
    values,
  )
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' })
  res.json({ employee: toCamel(rows[0]) })
}))

export default router

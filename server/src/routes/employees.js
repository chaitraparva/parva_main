import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'

const router = Router()

// Columns safe to return to any signed-in user — password_hash and
// login_role are deliberately excluded from list/detail responses.
const PUBLIC_COLUMNS = `
  id, name, job_title, title, email, phone, team, manager_id, join_date,
  status, department, leads_assigned, conversions, base_salary,
  response_time, location, photo_url, company,
  hra, conveyance_allowance, medical_allowance, other_allowance,
  dob, gender, aadhar_number, pan_number
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

// HR/management-only editing of salary structure & payslip personal-identity
// fields (see server/sql/09_employee_salary_personal_fields_migration.sql
// and src/components/SalaryStructureEditor.tsx). A tight allow-list, not
// "everything" -- job_title, login_roles, status, manager_id etc. have no
// UI for editing them yet and stay off this list on purpose, so this route
// can't quietly become a way to change those later by accident.
const HR_EDITABLE_FIELDS = {
  baseSalary: 'base_salary',
  hra: 'hra',
  conveyanceAllowance: 'conveyance_allowance',
  medicalAllowance: 'medical_allowance',
  otherAllowance: 'other_allowance',
  dob: 'dob',
  gender: 'gender',
  aadharNumber: 'aadhar_number',
  panNumber: 'pan_number',
}

router.patch('/:id', requireAuth, requireRole('hr', 'management'), asyncHandler(async (req, res) => {
  const updates = req.body || {}
  const setClauses = []
  const values = []

  for (const [field, column] of Object.entries(HR_EDITABLE_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) continue
    values.push(updates[field])
    setClauses.push(`${column} = $${values.length}`)
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No editable fields were provided.' })
  }

  values.push(req.params.id)
  const { rows } = await pool.query(
    `UPDATE employees SET ${setClauses.join(', ')}, updated_at = now()
     WHERE id = $${values.length}
     RETURNING ${PUBLIC_COLUMNS}`,
    values,
  )
  if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' })
  res.json({ employee: toCamel(rows[0]) })
}))

export default router

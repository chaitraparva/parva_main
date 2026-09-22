import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { toCamel, toSnake } from './case.js'
import { asyncHandler } from './async-handler.js'

/**
 * Builds a small, JWT-protected REST router for one table:
 *   GET    /            - list, optionally filtered by ?employeeId=... if
 *                          the table has an employee_id column
 *   GET    /:id         - one row
 *   POST   /            - create (allowedColumns only; id/created_at etc.
 *                          are left to the database's defaults)
 *   PATCH  /:id         - partial update (allowedColumns only)
 *
 * This intentionally does NOT encode the approval-workflow business rules
 * (who can move a leave request from "pending-manager" to "approved", who
 * can disburse payroll, etc.) — those still need to be layered in per
 * resource as real endpoints once the frontend is wired up to call them,
 * the same way auth.js's login route encodes the real login rules instead
 * of leaving them generic. Treat this as the data-access layer underneath
 * that business logic, not a replacement for it.
 */
export function crudRouter({ table, idColumn = 'id', allowedColumns, writeRoles }) {
  // Read stays open to any signed-in user; only writes are role-gated
  // (see writeGuard below).
  const router = Router()
  router.use(requireAuth)

  router.get('/', asyncHandler(async (req, res) => {
    const hasEmployeeFilter = allowedColumns.includes('employeeId') && req.query.employeeId
    const sql = hasEmployeeFilter
      ? `SELECT * FROM ${table} WHERE employee_id = $1 ORDER BY ${idColumn} DESC`
      : `SELECT * FROM ${table} ORDER BY ${idColumn} DESC LIMIT 500`
    const params = hasEmployeeFilter ? [req.query.employeeId] : []
    const { rows } = await pool.query(sql, params)
    res.json({ [table]: rows.map(toCamel) })
  }))

  router.get('/:id', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found.' })
    res.json({ [singular(table)]: toCamel(rows[0]) })
  }))

  const writeGuard = writeRoles ? [requireRole(...writeRoles)] : []

  router.post('/', ...writeGuard, asyncHandler(async (req, res) => {
    const body = pick(req.body, allowedColumns)
    if (Object.keys(body).length === 0) return res.status(400).json({ error: 'No valid fields supplied.' })
    const snake = toSnake(body)
    const columns = Object.keys(snake)
    const values = Object.values(snake)
    const placeholders = columns.map((_, i) => `$${i + 1}`)
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
    const { rows } = await pool.query(sql, values)
    res.status(201).json({ [singular(table)]: toCamel(rows[0]) })
  }))

  router.patch('/:id', ...writeGuard, asyncHandler(async (req, res) => {
    const body = pick(req.body, allowedColumns)
    if (Object.keys(body).length === 0) return res.status(400).json({ error: 'No valid fields supplied.' })
    const snake = toSnake(body)
    const columns = Object.keys(snake)
    const values = Object.values(snake)
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ')
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${columns.length + 1} RETURNING *`
    const { rows } = await pool.query(sql, [...values, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not found.' })
    res.json({ [singular(table)]: toCamel(rows[0]) })
  }))

  return router
}

function pick(obj, keys) {
  const out = {}
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key]
  }
  return out
}

function singular(table) {
  return table.endsWith('s') ? table.slice(0, -1) : table
}

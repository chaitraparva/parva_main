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
 *
 * writeRoles gates POST only (or both POST and PATCH, if updateRoles is
 * left unset — this is the historical/default behaviour, kept for tables
 * that don't need the two to differ). Pass updateRoles separately whenever
 * "who may create a row" and "who may change it afterward" are genuinely
 * different — e.g. any employee can submit their own expense claim (POST),
 * but only HR/management/finance may approve, reject or reimburse one
 * (PATCH). Without this split, leaving writeRoles unset to keep creation
 * open also leaves PATCH open to everyone — meaning any signed-in employee
 * could approve their own (or anyone else's) pending request by calling the
 * API directly, even if the UI never shows them that option.
 *
 * DELETE /:id is opt-in per table via selfDelete/deleteRoles (unlike
 * GET/POST/PATCH above, there's no DELETE at all unless one of these is
 * set) — pass selfDelete: true to let an employee delete their OWN row
 * (matched by employeeId, checked against the signed-in session, never
 * trusted from the request body), optionally narrowed with
 * selfDeleteStatuses (e.g. an expense claim can only be self-deleted while
 * still 'Pending' — once HR/finance has acted on it, deleting it would
 * corrupt their records). Pass deleteRoles separately for roles allowed to
 * delete ANY row regardless of ownership/status.
 */
export function crudRouter({ table, idColumn = 'id', allowedColumns, writeRoles, updateRoles, deleteRoles, selfDelete, selfDeleteStatuses }) {
  // Read stays open to any signed-in user; only writes are role-gated
  // (see writeGuard/updateGuard below).
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
  // Falls back to writeGuard when updateRoles isn't given, so every table
  // that didn't opt into the split keeps its existing behaviour exactly.
  const updateGuard = updateRoles ? [requireRole(...updateRoles)] : writeGuard

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

  router.patch('/:id', ...updateGuard, asyncHandler(async (req, res) => {
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

  if (selfDelete || deleteRoles) {
    router.delete('/:id', asyncHandler(async (req, res) => {
      const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [req.params.id])
      const existing = rows[0]
      if (!existing) return res.status(404).json({ error: 'Not found.' })

      const hasDeleteRole = deleteRoles?.includes(req.auth.loginRole)
      const isOwner = selfDelete && existing.employee_id === req.auth.employeeId
      if (!hasDeleteRole && !isOwner) {
        return res.status(403).json({ error: 'You do not have permission to delete this.' })
      }
      if (isOwner && !hasDeleteRole && selfDeleteStatuses && !selfDeleteStatuses.includes(existing.status)) {
        return res.status(400).json({ error: `This can't be deleted once it's ${String(existing.status).toLowerCase()}.` })
      }

      await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [req.params.id])
      res.status(204).end()
    }))
  }

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
  // Naive de-pluralization used only to name the single-row response key on
  // POST/PATCH (e.g. 'expense_claims' -> 'expense_claim'). Needs the 'ies'
  // -> 'y' case specifically for 'timesheet_entries' -> 'timesheet_entry'
  // (plain trailing-'s' stripping gave the wrong 'timesheet_entrie' — found
  // while testing the new DELETE route below; harmless in practice since
  // nothing read that key, but worth having correct).
  if (table.endsWith('ies')) return table.slice(0, -3) + 'y'
  return table.endsWith('s') ? table.slice(0, -1) : table
}

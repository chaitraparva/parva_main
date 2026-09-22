// The trusted source of "who is allowed to sign in as what, and what's
// their real registered email" for the password-reset flow — reads live
// from Postgres (via the same pool everything else uses) rather than
// trusting anything the client sends, so a reset link can only ever be
// emailed to the address actually on file for that person right now.
//
// This used to read a static employees.seed.json snapshot instead, which
// meant a roster change made directly in Supabase (a new hire, a changed
// email, a revoked role) wouldn't take effect here until that file was
// manually updated and redeployed — a real footgun. Querying Postgres
// directly removes that gap entirely; employees.seed.json is now only used
// by seed.js to populate the database once, not read at request time.

import { pool } from '../db.js'

export async function findEmployeeById(employeeId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, login_roles, status FROM employees WHERE id = $1`,
    [employeeId],
  )
  return rows[0] || null
}

// Looks a person up by the email+role combination the way /login does —
// used by forgot-password so the frontend never has to know someone's
// employeeId before they've proven who they are.
export async function findEmployeeByEmailAndRole(email, role) {
  if (!email || !role) return null
  const { rows } = await pool.query(
    `SELECT id, name, email, login_roles FROM employees
     WHERE lower(email) = $1 AND $2 = ANY(login_roles) AND status = 'active'`,
    [String(email).trim().toLowerCase(), role],
  )
  return rows[0] || null
}

// True if `employee` (a row from either lookup above) is allowed to sign in
// as `role` — checks their live login_roles array and that they're active.
export function isEligibleForRole(employee, role) {
  if (!employee || !role) return false
  if (employee.status && employee.status !== 'active') return false
  return Array.isArray(employee.login_roles) && employee.login_roles.includes(role)
}

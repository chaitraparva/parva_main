// The trusted source of "who is allowed to sign in as what, and what's
// their real registered email" for the password-reset flow — read
// server-side from employees.seed.json rather than trusting anything the
// client sends, so a reset link can only ever be emailed to the address
// actually on file for that person.
//
// Each person's `loginRoles` array in employees.seed.json is the one direct
// source of truth for which portal(s) they may sign in to — set explicitly
// per person rather than derived from job_title, so one person can hold
// more than one role (e.g. someone who is both HR and a Line Manager).
// Mirrors the same `login_roles` column in Postgres (see schema.sql) — keep
// this file and the live database in sync if a person's roles change.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const employees = JSON.parse(readFileSync(join(__dirname, '../../employees.seed.json'), 'utf8'))

export function findEmployeeById(employeeId) {
  return employees.find((e) => e.id === employeeId) || null
}

// True if `employee` is allowed to sign in as `role` — just checks whether
// `role` is in their explicit loginRoles array.
export function isEligibleForRole(employee, role) {
  if (!employee || !role) return false
  return Array.isArray(employee.loginRoles) && employee.loginRoles.includes(role)
}

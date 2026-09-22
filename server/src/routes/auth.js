import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import { verifyPassword, hashPassword, signToken, requireAuth } from '../auth.js'
import { toCamel } from '../lib/case.js'
import { asyncHandler } from '../lib/async-handler.js'
import { signResetToken, verifyResetToken } from '../lib/reset-token.js'
import { findEmployeeById, findEmployeeByEmailAndRole, isEligibleForRole } from '../lib/roster.js'
import { sendPasswordResetEmail } from '../lib/mailer.js'

const router = Router()

// Brute-force protection: 10 attempts per IP per 15 minutes on the login
// route specifically (separate from any general API rate limit).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
})

const VALID_ROLES = ['crm', 'manager', 'hr', 'management', 'finance']

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { role, email, password } = req.body || {}

  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Select which portal you are signing in to.' })
  }
  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your registered email and password.' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()

  // login_roles is the explicit source of truth for who may sign in as
  // what — set directly per person (not derived from job_title), and can
  // hold more than one role (e.g. someone who is both HR and a Line
  // Manager). `$2 = ANY(login_roles)` matches if the requested role is
  // anywhere in that person's array.
  const { rows } = await pool.query(
    `SELECT id, name, title, job_title, login_roles, password_hash
     FROM employees
     WHERE lower(email) = $1 AND $2 = ANY(login_roles) AND status = 'active'`,
    [normalizedEmail, role],
  )
  const employee = rows[0]

  // Compare against a dummy hash when no employee matches, so the response
  // time doesn't leak whether the email exists (a cheap but real timing-
  // attack mitigation).
  const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8x1z3j9wZ0aY5f5c2fJb7q8yG3nq7u'
  const ok = await verifyPassword(password, employee?.password_hash || DUMMY_HASH)

  if (!employee || !ok) {
    return res.status(401).json({ error: "Email or password doesn't match a registered account for this role." })
  }

  const token = signToken(employee, role)
  res.json({
    token,
    employee: {
      id: employee.id,
      name: employee.name,
      title: employee.title,
      jobTitle: employee.job_title,
      loginRole: role,
      loginRoles: employee.login_roles,
    },
  })
}))

// Returns the signed-in employee's own full profile — used on app load to
// restore a session from a stored token without re-sending credentials.
// Also echoes back loginRole (the one role this particular session is
// scoped to, from the JWT) since a person can hold several login_roles —
// the frontend needs to know which one they're currently acting as to
// restore the right portal after a page reload, not just their full set of
// eligible roles.
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM employees WHERE id = $1', [req.auth.employeeId])
  const employee = rows[0]
  if (!employee) return res.status(404).json({ error: 'Account not found.' })
  delete employee.password_hash
  res.json({ employee: toCamel(employee), loginRole: req.auth.loginRole })
}))

// ─────────────────────── Forgot password ───────────────────────
// Deliberately independent of Postgres/JWT (see server/src/lib/reset-token.js)
// so it works today even before the rest of this backend is connected. All
// this proves is "the requester controls the email address on file" — the
// frontend still applies the resulting new password the same way it
// already does. Rate-limited harder than general login attempts, since
// each request also costs a real email send.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please wait a few minutes and try again.' },
})

// Where the reset link should point — the deployed frontend's own origin.
const RESET_LINK_BASE_URL = process.env.RESET_LINK_BASE_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

router.post('/forgot-password', forgotPasswordLimiter, asyncHandler(async (req, res) => {
  const { email, role } = req.body || {}
  const GENERIC_RESPONSE = { message: "If that account has a registered email on file, we've sent a password reset link to it." }

  if (!email || !role) {
    return res.status(400).json({ error: 'Missing email or role.' })
  }

  // Looked up by email+role, the same way /login is — the frontend never
  // needs to know (or send) an employeeId before the person has proven
  // they control the registered email.
  const employee = await findEmployeeByEmailAndRole(email, role)

  // Same generic response whether or not the account/role/email actually
  // checks out, so this endpoint can't be used to probe which emails or
  // roles are valid.
  if (!employee || !isEligibleForRole(employee, role) || !employee.email) {
    return res.json(GENERIC_RESPONSE)
  }

  const token = signResetToken(employee.id, role)
  const resetUrl = `${RESET_LINK_BASE_URL}/?resetToken=${encodeURIComponent(token)}`

  try {
    await sendPasswordResetEmail({ to: employee.email, name: employee.name, resetUrl })
  } catch (err) {
    console.error('forgot-password: failed to send email for', employee.id, err)
    // Still return the generic response — don't leak send failures to the
    // client, and don't let a broken mail provider reveal account existence.
  }

  res.json(GENERIC_RESPONSE)
}))

// Called when the app loads with ?resetToken=... in the URL, before showing
// the "set a new password" form — confirms the token is genuine and not
// expired, and hands back just enough identity to render the form.
router.post('/verify-reset-token', asyncHandler(async (req, res) => {
  const { token } = req.body || {}
  const result = token ? verifyResetToken(token) : null
  if (!result) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one from the sign-in page.' })
  }

  const employee = await findEmployeeById(result.employeeId)
  if (!employee || !isEligibleForRole(employee, result.role)) {
    return res.status(400).json({ error: 'This reset link is no longer valid.' })
  }

  res.json({ employeeId: employee.id, name: employee.name, role: result.role })
}))

// ─────────────────────── Set password (the missing piece) ───────────────────────
// verify-reset-token above only checks the link is genuine — it never
// actually saved a new password anywhere. This is that piece. It's shared
// by both "first time, choose your password" and "forgot password" —
// both are really just "prove you control the registered email, then set
// a password," so one endpoint covers both instead of two near-duplicates.
const setPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
})

router.post('/set-password', setPasswordLimiter, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body || {}

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }

  const result = token ? verifyResetToken(token) : null
  if (!result) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one from the sign-in page.' })
  }

  // Re-check eligibility against the trusted roster, same as verify-reset-
  // token — a token can only ever have been issued for this employeeId/role
  // pair in the first place (forgot-password checks this before signing
  // it), but re-checking here costs nothing and means a roster change
  // (someone's role revoked) takes effect immediately, not just at the
  // next login.
  const rosterEmployee = await findEmployeeById(result.employeeId)
  if (!rosterEmployee || !isEligibleForRole(rosterEmployee, result.role)) {
    return res.status(400).json({ error: 'This reset link is no longer valid.' })
  }

  const passwordHash = await hashPassword(String(newPassword))
  // Add this role to their login_roles array if it isn't already there,
  // rather than overwriting it — a person can be setting/resetting the
  // password for one of several portals they're eligible for (e.g. someone
  // eligible for both 'hr' and 'manager'), and this must never clobber the
  // others.
  const { rows } = await pool.query(
    `UPDATE employees
     SET password_hash = $1,
         login_roles = CASE WHEN $2 = ANY(login_roles) THEN login_roles ELSE array_append(login_roles, $2) END,
         updated_at = now()
     WHERE id = $3 AND status = 'active'
     RETURNING id, name, title, job_title, login_roles`,
    [passwordHash, result.role, result.employeeId],
  )
  const employee = rows[0]
  if (!employee) {
    return res.status(404).json({ error: 'Account not found.' })
  }

  // Sign them straight in — they just proved their identity and chose a
  // password, no reason to make them turn around and log in again.
  const authToken = signToken(employee, result.role)
  res.json({
    token: authToken,
    employee: {
      id: employee.id,
      name: employee.name,
      title: employee.title,
      jobTitle: employee.job_title,
      loginRole: result.role,
      loginRoles: employee.login_roles,
    },
  })
}))

export default router

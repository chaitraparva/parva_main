// Signed, self-contained password-reset tokens.
//
// This intentionally does NOT touch Postgres — the rest of the backend
// (bcrypt/JWT/Postgres auth) is built but not yet connected (see
// server/README.md), while the frontend's actual password storage is
// still the temporary per-browser localStorage system in Login.tsx. A
// reset token here only proves "this request came from whoever controls
// the registered email address" — the frontend still applies the new
// password the same way it always has. That keeps this feature working
// today, independent of when the real database gets connected.
//
// Token shape: base64url(`${employeeId}.${role}.${expiresAt}`) + '.' + hex(HMAC-SHA256)
// — verifiable with just RESET_TOKEN_SECRET, no server-side storage needed.

import { createHmac, timingSafeEqual } from 'node:crypto'

const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET
const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

if (!RESET_TOKEN_SECRET) {
  console.error('RESET_TOKEN_SECRET is not set. Generate one and add it to your environment variables before deploying — the forgot-password flow will refuse to issue tokens without it.')
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url')
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8')
}

function sign(payload) {
  return createHmac('sha256', RESET_TOKEN_SECRET).update(payload).digest('hex')
}

export function signResetToken(employeeId, role) {
  if (!RESET_TOKEN_SECRET) throw new Error('RESET_TOKEN_SECRET is not configured.')
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const payload = `${employeeId}.${role}.${expiresAt}`
  const encoded = base64UrlEncode(payload)
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

// Returns { employeeId, role } on success, or null if the token is
// malformed, tampered with, or expired.
export function verifyResetToken(token) {
  if (!RESET_TOKEN_SECRET || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encoded, signature] = parts

  // Compare the two signatures as plain ASCII strings, not as decoded hex
  // bytes: Buffer.from(str, 'hex') silently drops a trailing character it
  // can't parse (e.g. an appended 'x') instead of throwing, which let a
  // tampered signature with garbage appended slip past a byte-length
  // check here in testing. Comparing the raw hex strings sidesteps that
  // parser leniency entirely.
  const expectedSignature = sign(encoded)
  const sigBuf = Buffer.from(signature, 'utf8')
  const expectedBuf = Buffer.from(expectedSignature, 'utf8')
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null

  let payload
  try {
    payload = base64UrlDecode(encoded)
  } catch {
    return null
  }
  const [employeeId, role, expiresAtStr] = payload.split('.')
  const expiresAt = Number(expiresAtStr)
  if (!employeeId || !role || !Number.isFinite(expiresAt)) return null
  if (Date.now() > expiresAt) return null

  return { employeeId, role }
}

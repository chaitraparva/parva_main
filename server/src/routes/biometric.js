import { Router } from 'express'
import crypto from 'node:crypto'
import { pool } from '../db.js'
import { asyncHandler } from '../lib/async-handler.js'

// Receives face / fingerprint punches from the office biometric device. The
// device (eSSL X2008) stores its punches in the office PC's eTimeTrackLite
// database; a small script on that PC (office-bridge/Send-Punches.ps1) reads
// them and sends them here every couple of minutes. Not a browser endpoint:
// it is protected by a shared secret (BIOMETRIC_SYNC_KEY), not a user login.
//
// Rules applied per person per day, from ALL of that day's punches:
//   first punch  -> Login time
//   last punch   -> Logout time (only if at least MIN_SPAN_MINUTES after the
//                   first -- a double-tap at the door isn't a logout)
//   status       -> Half Day if the logout is before 3:00 PM, else Present
//                   (one punch only = still Present, same as forgetting to
//                   log out in the portal)
// If the person ALSO used the portal's Log In button that day, the earlier
// login and the later logout win.

const HALF_DAY_BEFORE_HOUR = 15
const MIN_SPAN_MINUTES = 10
export const MAX_PUNCHES_PER_REQUEST = 2000
const PUNCH_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
const CODE_RE = /^[A-Za-z0-9_.-]{1,32}$/

function secretMatches(provided) {
  const expected = process.env.BIOMETRIC_SYNC_KEY
  if (!expected || !provided) return false
  const a = crypto.createHash('sha256').update(String(provided)).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export function parsePunch(p) {
  if (!p) return null
  const code = String(p.code ?? '').trim()
  const m = PUNCH_RE.exec(String(p.at ?? '').trim())
  if (!CODE_RE.test(code) || !m) return null
  const [, y, mo, d, h, mi, s = '00'] = m
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null
  return { code, date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, stamp: `${y}-${mo}-${d} ${h}:${mi}:${s}` }
}

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export async function applyPunches(rawPunches) {
  const parsed = []
  let invalid = 0
  for (const p of rawPunches) {
    const q = parsePunch(p)
    if (q) parsed.push(q); else invalid++
  }
  if (parsed.length === 0) return { received: 0, invalid, unmapped: [], recordsUpdated: 0 }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const codes = [...new Set(parsed.map(p => p.code))]
    const emps = (await client.query(
      'SELECT id, biometric_id FROM employees WHERE biometric_id = ANY($1::text[])', [codes],
    )).rows
    const byCode = new Map(emps.map(e => [e.biometric_id, e.id]))
    const unmapped = codes.filter(c => !byCode.has(c))

    await client.query(
      `INSERT INTO biometric_punches (biometric_id, employee_id, punched_at)
       SELECT * FROM unnest($1::text[], $2::text[], $3::timestamp[])
       ON CONFLICT (biometric_id, punched_at) DO UPDATE SET employee_id = EXCLUDED.employee_id`,
      [parsed.map(p => p.code), parsed.map(p => byCode.get(p.code) ?? null), parsed.map(p => p.stamp)],
    )

    const pairs = new Set()
    for (const p of parsed) {
      const id = byCode.get(p.code)
      if (id) pairs.add(`${id}|${p.date}`)
    }

    let recordsUpdated = 0
    for (const pair of pairs) {
      const [employeeId, date] = pair.split('|')
      const span = (await client.query(
        `SELECT to_char(min(punched_at), 'HH24:MI') AS first_t,
                to_char(max(punched_at), 'HH24:MI') AS last_t,
                extract(epoch FROM (max(punched_at) - min(punched_at))) / 60 AS span_min
         FROM biometric_punches
         WHERE employee_id = $1 AND punched_at >= $2::date AND punched_at < ($2::date + 1)`,
        [employeeId, date],
      )).rows[0]
      if (!span.first_t) continue

      const newIn = span.first_t
      const newOut = Number(span.span_min) >= MIN_SPAN_MINUTES ? span.last_t : ''

      const existing = (await client.query(
        'SELECT check_in, check_out, status, work_mode FROM attendance_records WHERE employee_id = $1 AND date = $2',
        [employeeId, date],
      )).rows[0]
      const live = existing && existing.status !== 'absent'
      const checkIn = live && existing.check_in && existing.check_in < newIn ? existing.check_in : newIn
      const checkOut = live && existing.check_out && existing.check_out > newOut ? existing.check_out : newOut
      const status = checkOut && minutesOf(checkOut) < HALF_DAY_BEFORE_HOUR * 60 ? 'half-day' : 'present'
      const workMode = live && existing.work_mode ? existing.work_mode : 'office'

      await client.query(
        `INSERT INTO attendance_records (employee_id, date, check_in, check_out, status, work_mode)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (employee_id, date)
         DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out,
                       status = EXCLUDED.status, work_mode = EXCLUDED.work_mode`,
        [employeeId, date, checkIn, checkOut, status, workMode],
      )
      recordsUpdated++
    }

    await client.query('COMMIT')
    return { received: parsed.length, invalid, unmapped, recordsUpdated }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

const router = Router()

router.use((req, res, next) => {
  if (!process.env.BIOMETRIC_SYNC_KEY) {
    return res.status(503).json({ error: 'Biometric sync is not set up on the server yet.' })
  }
  if (!secretMatches(req.headers['x-sync-key'])) {
    return res.status(401).json({ error: 'Invalid sync key.' })
  }
  next()
})

router.get('/ping', (_req, res) => res.json({ ok: true }))

router.post('/punches', asyncHandler(async (req, res) => {
  const punches = req.body?.punches
  if (!Array.isArray(punches)) return res.status(400).json({ error: 'Expected { punches: [...] }.' })
  if (punches.length > MAX_PUNCHES_PER_REQUEST) {
    return res.status(413).json({ error: `Send at most ${MAX_PUNCHES_PER_REQUEST} punches at a time.` })
  }
  res.json(await applyPunches(punches))
}))

export default router

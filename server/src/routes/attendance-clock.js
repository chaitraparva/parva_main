import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth.js'
import { asyncHandler } from '../lib/async-handler.js'
import { toCamel } from '../lib/case.js'

// Login / Logout / Work From Home for the signed-in employee.
//
// The SERVER stamps the time — never the browser — so a wrong laptop clock or
// wrong laptop time zone can't produce a wrong attendance record. The time is
// recorded in the employee's OWN office time zone (Dubai staff in Dubai time,
// everyone else in India time), so "09:05" always means 09:05 on the wall
// clock where that person works.
//
// Logging out before HALF_DAY_BEFORE_HOUR:00 local time turns the day into a
// Half Day; logging out at or after it keeps it Present.
const HALF_DAY_BEFORE_HOUR = 15
// Night shift: anyone can log in at any time and their real login / logout time
// is recorded. A login at or after 2:00 PM local time is a night-shift login:
// the logout after midnight is saved on the day they logged in (not the next
// day), and a night shift is never turned into a Half Day -- HR sees the real
// times and can edit them.
export const NIGHT_SHIFT_FROM_HOUR = 14
const NIGHT_SHIFT_MAX_HOURS = 18 // a logout later than this after the login is not the same shift

export function timeZoneForLocation(location) {
  return /dubai|uae|abu dhabi|sharjah/i.test(location || '') ? 'Asia/Dubai' : 'Asia/Kolkata'
}

export function localNow(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)
  const get = (t) => parts.find(p => p.type === t).value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    hour: Number(get('hour')),
  }
}

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

async function loadEmployeeTimeZone(employeeId) {
  const { rows } = await pool.query('SELECT location FROM employees WHERE id = $1', [employeeId])
  if (!rows[0]) return null
  return timeZoneForLocation(rows[0].location)
}

export const attendanceClockRouter = Router()

attendanceClockRouter.post('/check-in', requireAuth, asyncHandler(async (req, res) => {
  const mode = req.body?.mode === 'wfh' ? 'wfh' : 'office'
  const employeeId = req.auth.employeeId
  const tz = await loadEmployeeTimeZone(employeeId)
  if (!tz) return res.status(404).json({ error: 'Account not found.' })
  const { date, time, hour } = localNow(tz)

  const existing = (await pool.query(
    'SELECT * FROM attendance_records WHERE employee_id = $1 AND date = $2', [employeeId, date],
  )).rows[0]
  if (existing && existing.check_in && existing.status !== 'absent') {
    return res.status(409).json({ error: `You already logged in today at ${existing.check_in}.` })
  }

  const { rows } = await pool.query(
    `INSERT INTO attendance_records (employee_id, date, check_in, check_out, status, work_mode)
     VALUES ($1, $2, $3, '', 'present', $4)
     ON CONFLICT (employee_id, date)
     DO UPDATE SET check_in = EXCLUDED.check_in, check_out = '', status = 'present', work_mode = EXCLUDED.work_mode
     RETURNING *`,
    [employeeId, date, time, mode],
  )
  res.json({ attendance_record: toCamel(rows[0]), timeZone: tz })
}))

attendanceClockRouter.post('/check-out', requireAuth, asyncHandler(async (req, res) => {
  const employeeId = req.auth.employeeId
  const tz = await loadEmployeeTimeZone(employeeId)
  if (!tz) return res.status(404).json({ error: 'Account not found.' })
  const { date, time, hour } = localNow(tz)

  let existing = (await pool.query(
    'SELECT * FROM attendance_records WHERE employee_id = $1 AND date = $2', [employeeId, date],
  )).rows[0]

  // No login today yet: this may be the end of last night's shift (logged in
  // yesterday evening, logging out after midnight).
  if (!existing || !existing.check_in || existing.status === 'absent') {
    const y = new Date(`${date}T00:00:00Z`)
    y.setUTCDate(y.getUTCDate() - 1)
    const yesterday = y.toISOString().slice(0, 10)
    const prev = (await pool.query(
      'SELECT * FROM attendance_records WHERE employee_id = $1 AND date = $2', [employeeId, yesterday],
    )).rows[0]
    if (prev && prev.check_in && !prev.check_out && prev.status !== 'absent' && minutesOf(prev.check_in) >= NIGHT_SHIFT_FROM_HOUR * 60) {
      const worked = 24 * 60 + minutesOf(time) - minutesOf(prev.check_in)
      if (worked <= NIGHT_SHIFT_MAX_HOURS * 60) existing = prev
    }
  }
  if (!existing || !existing.check_in || existing.status === 'absent') {
    return res.status(400).json({ error: 'Please log in first before logging out.' })
  }
  if (existing.check_out) {
    return res.status(409).json({ error: `You already logged out today at ${existing.check_out}.` })
  }

  // Day shift: logging out before 3:00 PM is a Half Day. A night-shift login
  // (2:00 PM or later) is recorded as Present with the real times.
  const nightShift = minutesOf(existing.check_in) >= NIGHT_SHIFT_FROM_HOUR * 60
  const status = !nightShift && hour < HALF_DAY_BEFORE_HOUR ? 'half-day' : 'present'
  const { rows } = await pool.query(
    `UPDATE attendance_records SET check_out = $1, status = $2
     WHERE id = $3 RETURNING *`,
    [time, status, existing.id],
  )
  res.json({ attendance_record: toCamel(rows[0]), timeZone: tz })
}))

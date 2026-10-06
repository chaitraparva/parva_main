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
  const { date, time } = localNow(tz)

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

  const existing = (await pool.query(
    'SELECT * FROM attendance_records WHERE employee_id = $1 AND date = $2', [employeeId, date],
  )).rows[0]
  if (!existing || !existing.check_in || existing.status === 'absent') {
    return res.status(400).json({ error: 'Please log in first before logging out.' })
  }
  if (existing.check_out) {
    return res.status(409).json({ error: `You already logged out today at ${existing.check_out}.` })
  }

  const status = hour < HALF_DAY_BEFORE_HOUR ? 'half-day' : 'present'
  const { rows } = await pool.query(
    `UPDATE attendance_records SET check_out = $1, status = $2
     WHERE employee_id = $3 AND date = $4 RETURNING *`,
    [time, status, employeeId, date],
  )
  res.json({ attendance_record: toCamel(rows[0]), timeZone: tz })
}))

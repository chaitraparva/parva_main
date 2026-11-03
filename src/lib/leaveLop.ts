import type { AttendanceRecord, Employee, LeaveRequest } from '../types'
import { ATTENDANCE_EXCLUDED_IDS } from './attendanceStatus'

// ─────────────────────────── Leave & LOP calculation ───────────────────────────
// For every working day that has already finished, work out what happened:
//   • logged in           → worked (1 day; a Half Day login = 0.5)
//   • no login, but an APPROVED Sick / Casual / Earned leave covers the day
//                         → counted as Leave
//   • no login and no approved leave (or the leave is Unpaid)
//                         → LOP (Loss of Pay)
// A half-day leave covers 0.5 day; a Half Day login covers the other 0.5.
//
// Rules:
//   • Sundays are the weekly off — never counted.
//   • Today is not counted (the day isn't over; they may still log in).
//   • Nothing before the employee's join date, or before the first attendance
//     record the system ever stored, is counted — otherwise everyone would
//     show LOP for months that were never tracked.
//   • Company holidays aren't stored in the system yet, so a holiday with no
//     logins would show as LOP unless HR marks those people present for it.

export interface LopDetail {
  date: string
  units: number // 1 or 0.5
  reason: 'no-leave' | 'unpaid-leave' | 'half-day'
}

export interface MonthLeaveLop {
  employee: Employee
  countedDays: number // working days that were counted for this person
  workedDays: number
  leaveDays: number
  lopDays: number
  lop: LopDetail[]
  leave: { date: string; units: number; type: LeaveRequest['type'] }[]
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z')
const DAY = 86_400_000

const isIsoDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)

/** Units of work done on a day (1, 0.5 or 0) — mirrors buildDayRows. */
function workedUnits(rec: AttendanceRecord | undefined): number {
  if (!rec) return 0
  if (rec.status === 'half-day') return 0.5
  if (rec.status === 'absent') return 0
  if (rec.checkIn || rec.status === 'present' || rec.status === 'late') return 1
  return 0
}

export function computeMonthLeaveLop(
  employees: Employee[],
  monthStart: string, // first day of the month, YYYY-MM-DD
  monthEnd: string, // last day of the month
  todayIso: string,
  records: AttendanceRecord[],
  leaves: LeaveRequest[],
): MonthLeaveLop[] {
  // First day the system has any attendance data at all.
  let trackingStart = ''
  const byEmpDate = new Map<string, AttendanceRecord>()
  for (const r of records) {
    if (!isIsoDate(r.date)) continue
    if (!trackingStart || r.date < trackingStart) trackingStart = r.date
    byEmpDate.set(`${r.employeeId}|${r.date}`, r)
  }

  const approved = leaves.filter(l => l.status === 'approved')
  // Last day to count = the earlier of month end and yesterday.
  const yesterday = iso(toMs(todayIso) - DAY)
  const lastDay = monthEnd < yesterday ? monthEnd : yesterday

  return employees
    .filter(e => !ATTENDANCE_EXCLUDED_IDS.includes(e.id))
    .map(employee => {
      const out: MonthLeaveLop = { employee, countedDays: 0, workedDays: 0, leaveDays: 0, lopDays: 0, lop: [], leave: [] }
      if (!trackingStart) return out
      let first = monthStart > trackingStart ? monthStart : trackingStart
      if (isIsoDate(employee.joinDate) && employee.joinDate.slice(0, 10) > first) first = employee.joinDate.slice(0, 10)
      const mine = approved.filter(l => l.employeeId === employee.id)

      for (let t = toMs(first); iso(t) <= lastDay; t += DAY) {
        const date = iso(t)
        if (new Date(t).getUTCDay() === 0) continue // Sunday off
        out.countedDays += 1

        const worked = workedUnits(byEmpDate.get(`${employee.id}|${date}`))
        out.workedDays += worked
        let missing = 1 - worked
        if (missing <= 0) continue

        // Best approved leave covering this day (full day beats half day; paid beats unpaid).
        const covering = mine
          .filter(l => l.startDate <= date && l.endDate >= date)
          .sort((a, b) => (b.halfDay ? 0.5 : 1) - (a.halfDay ? 0.5 : 1) || Number(a.type === 'Unpaid') - Number(b.type === 'Unpaid'))[0]

        if (covering) {
          const units = Math.min(missing, covering.halfDay ? 0.5 : 1)
          if (covering.type === 'Unpaid') {
            out.lop.push({ date, units, reason: 'unpaid-leave' })
            out.lopDays += units
          } else {
            out.leave.push({ date, units, type: covering.type })
            out.leaveDays += units
          }
          missing -= units
        }
        if (missing > 0) {
          out.lop.push({ date, units: missing, reason: worked === 0.5 ? 'half-day' : 'no-leave' })
          out.lopDays += missing
        }
      }
      return out
    })
}

/** First and last day (YYYY-MM-DD) of the month `offset` months from `todayIso`'s month. */
export function monthBounds(todayIso: string, offset: number): { start: string; end: string; label: string } {
  const [y, m] = todayIso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + offset, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
    label: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }
}

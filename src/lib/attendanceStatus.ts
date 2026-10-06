import type { AttendanceRecord, Employee, LeaveRequest } from '../types'

// Group leadership (CEO, Directors) aren't tracked in day-to-day attendance.
export const ATTENDANCE_EXCLUDED_IDS = ['DF230001', 'DF230002', 'PA230045'] // Neelesh H P, Akshita Raturi, Chaitra

export type DayStatus = 'present' | 'wfh' | 'half-day' | 'absent' | 'leave'

export interface DayRow {
  employee: Employee
  status: DayStatus
  checkIn: string
  checkOut: string
  note: string // e.g. "Half-day leave", "On leave", "Never logged in"
}

// One row per tracked employee for a given date. There is NO "not marked"
// state: anyone with no login for the day is Absent (unless they're on
// approved leave, which is shown as "On Leave" and counts with the absent
// group — or, for an approved HALF-day leave, as a Half Day).
export function buildDayRows(
  employees: Employee[],
  date: string,
  records: AttendanceRecord[],
  leaves: LeaveRequest[],
): DayRow[] {
  const tracked = employees.filter(e => !ATTENDANCE_EXCLUDED_IDS.includes(e.id))
  return tracked.map(employee => {
    const rec = records.find(r => r.employeeId === employee.id && r.date === date)
    const leave = leaves.find(l =>
      l.employeeId === employee.id && l.status === 'approved' && l.startDate <= date && l.endDate >= date)
    const loggedIn = !!rec && !!rec.checkIn && rec.status !== 'absent'

    if (loggedIn && rec) {
      const status: DayStatus = rec.status === 'half-day' ? 'half-day' : rec.workMode === 'wfh' ? 'wfh' : 'present'
      return { employee, status, checkIn: rec.checkIn, checkOut: rec.checkOut, note: rec.workMode === 'wfh' ? 'Work from home' : '' }
    }
    if (rec && rec.status === 'half-day') {
      // Manually marked by HR without a login time.
      return { employee, status: 'half-day', checkIn: rec.checkIn, checkOut: rec.checkOut, note: '' }
    }
    if (rec && (rec.status === 'present' || rec.status === 'late')) {
      return { employee, status: rec.workMode === 'wfh' ? 'wfh' : 'present', checkIn: rec.checkIn, checkOut: rec.checkOut, note: 'Marked by HR' }
    }
    if (leave) {
      if (leave.halfDay) return { employee, status: 'half-day', checkIn: '', checkOut: '', note: 'Half-day leave' }
      return { employee, status: 'leave', checkIn: '', checkOut: '', note: `On ${leave.type} leave` }
    }
    return { employee, status: 'absent', checkIn: '', checkOut: '', note: rec ? 'Marked absent' : 'Did not log in' }
  })
}

export const isAttended = (s: DayStatus) => s === 'present' || s === 'wfh' || s === 'half-day'
export const isAbsentGroup = (s: DayStatus) => s === 'absent' || s === 'leave'

import type { Employee, LeaveRequest } from '../types'

// Annual allocation per leave type — the same policy shown on the HR
// Leave → Policy tab. Unpaid leave has no fixed allocation; it's granted at
// manager/HR discretion, so it's tracked (days taken) but never shown as a
// "remaining balance". Earned Leave is credited at 1 day per month in
// practice, but — like Sick and Casual — is tracked here as a flat annual
// quota rather than prorated by month, matching how the rest of this
// balance calculation works.
export const LEAVE_POLICY: Record<'Sick' | 'Casual' | 'Earned', number> = {
  Sick: 8,
  Casual: 8,
  Earned: 12,
}

// Company-wide paid holidays (Republic Day, Diwali, etc.) — not something
// an individual applies for like the leave types above, so it isn't part
// of LEAVE_POLICY or LeaveBalance. Referenced by the Leave Policy tab and
// (later) by payslip generation's Attendance Summary.
export const NATIONAL_HOLIDAYS_PER_ANNUM = 12

export interface LeaveBalance {
  employeeId: string
  employeeName: string
  department: string
  Sick: number
  Casual: number
  Earned: number
  unpaidTaken: number
  totalAvailable: number
  totalTaken: number
}

function daysTaken(leaves: LeaveRequest[], employeeId: string, type: LeaveRequest['type']) {
  return leaves
    .filter(l => l.employeeId === employeeId && l.type === type && l.status === 'approved')
    .reduce((sum, l) => sum + l.days, 0)
}

/** Every leave type's remaining balance for one employee, computed live from
 * their approved leave history — not a hardcoded per-person table, so it
 * covers every employee automatically as the roster changes. */
export function computeLeaveBalance(employee: Employee, leaves: LeaveRequest[]): LeaveBalance {
  const sickTaken = daysTaken(leaves, employee.id, 'Sick')
  const casualTaken = daysTaken(leaves, employee.id, 'Casual')
  const earnedTaken = daysTaken(leaves, employee.id, 'Earned')
  const unpaidTaken = daysTaken(leaves, employee.id, 'Unpaid')

  const Sick = Math.max(0, LEAVE_POLICY.Sick - sickTaken)
  const Casual = Math.max(0, LEAVE_POLICY.Casual - casualTaken)
  const Earned = Math.max(0, LEAVE_POLICY.Earned - earnedTaken)

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    department: employee.department,
    Sick,
    Casual,
    Earned,
    unpaidTaken,
    totalAvailable: Sick + Casual + Earned,
    totalTaken: sickTaken + casualTaken + earnedTaken + unpaidTaken,
  }
}

export function computeAllLeaveBalances(employees: Employee[], leaves: LeaveRequest[]): LeaveBalance[] {
  return employees.map(e => computeLeaveBalance(e, leaves))
}

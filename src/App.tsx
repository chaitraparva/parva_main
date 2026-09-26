import { useEffect, useState } from 'react'
import type {
  Role, LeaveRequest, Employee, ExpenseClaim, PayrollRecord, AttendanceRecord,
  EmployeeTicket, ExitRecord, JobRequisition, Candidate, PerformanceGoal,
  PerformanceReview, Notification,
} from './types'
import * as mockData from './data/mockData'
import * as api from './lib/api'
import type { Session } from './lib/api'
import Login from './screens/Login'
import Layout from './components/layout/Layout'

import HRDashboard from './screens/hr/HRDashboard'
import Directory from './screens/hr/Directory'
import PayrollHR from './screens/hr/PayrollHR'
import AttendanceHR from './screens/hr/AttendanceHR'
import Leave from './screens/hr/Leave'
import OnboardingHR from './screens/hr/OnboardingHR'
import ExitManagement from './screens/hr/ExitManagement'
import ExpenseHR from './screens/hr/ExpenseHR'
import TicketsHR from './screens/hr/TicketsHR'
import Recruitment from './screens/hr/Recruitment'
import Performance from './screens/hr/Performance'
import Notifications from './screens/Notifications'
import Settings from './screens/Settings'
import Profile from './screens/Profile'
import OrgChart from './screens/OrgChart'
import MyPortal from './screens/crm/MyPortal'
import MyTimesheet from './screens/crm/MyTimesheet'
import TeamTimesheet from './screens/hr/TeamTimesheet'
import ManagerPortal from './screens/manager/ManagerPortal'
import MgmtPortal from './screens/management/MgmtPortal'
import FinancePortal from './screens/finance/FinancePortal'

const DEFAULT_SCREEN: Record<Role, string> = {
  crm: 'my-portal',
  manager: 'manager-portal',
  hr: 'hr-dashboard',
  management: 'mgmt-portal',
  finance: 'finance-portal',
}

// Postgres DATE/TIMESTAMPTZ columns serialize through JSON as full ISO
// strings (e.g. "2026-01-15T00:00:00.000Z") — trimmed to the plain
// YYYY-MM-DD the frontend displays and stores everywhere else.
function toDateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : ''
}

// The subset of a PayrollRecord that's actually a database column (not
// derived like employeeName/role, and not the id) — used to both send the
// right shape to the API and to detect whether a record actually changed.
const PAYROLL_FIELDS = [
  'employeeId', 'month', 'baseSalary', 'incentives', 'deductions', 'netPay',
  'status', 'managerApproved', 'hrProcessed', 'adminApproved',
  'periodStart', 'periodEnd', 'reimbursements', 'bonus', 'otherDeductions',
] as const

function payrollFieldsOf(r: PayrollRecord): Omit<api.RawPayrollRecord, 'id'> {
  const out: Record<string, unknown> = {}
  for (const f of PAYROLL_FIELDS) out[f] = (r as unknown as Record<string, unknown>)[f] ?? null
  return out as Omit<api.RawPayrollRecord, 'id'>
}

const ATTENDANCE_FIELDS = ['employeeId', 'date', 'checkIn', 'checkOut', 'status'] as const

function attendanceFieldsOf(a: AttendanceRecord): Omit<api.RawAttendanceRecord, 'id'> {
  const out: Record<string, unknown> = {}
  for (const f of ATTENDANCE_FIELDS) out[f] = (a as unknown as Record<string, unknown>)[f] ?? null
  return out as Omit<api.RawAttendanceRecord, 'id'>
}

// claimedOn is deliberately excluded — it's server-set (DB default now())
// and not writable. Field names don't all match 1:1 (receiptFileName here
// vs. the database's receiptFilename — see api.ts), so this is spelled out
// explicitly rather than looped generically like the other modules.
function expenseFieldsOf(e: ExpenseClaim): Omit<api.RawExpenseClaim, 'id' | 'claimedOn'> {
  return {
    employeeId: e.employeeId,
    date: e.date,
    description: e.description,
    category: e.category,
    amount: e.amount,
    receiptFilename: e.receiptFileName ?? null,
    status: e.status,
    approvedBy: e.approvedBy,
    reimbursedOn: e.reimbursedOn,
    note: e.note,
  }
}

// Onboarding candidate as used across the (loosely-typed) Onboarding screens.
interface OnboardingCandidate {
  id: string
  name: string
  role: string
  team: string
  joiningDate: string
  docStatus: string
  onboardingProgress: number
}

export default function App() {
  const [role, setRole] = useState<Role | null>(null)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [screen, setScreen] = useState('hr-dashboard')
  const [params, setParams] = useState<Record<string, string>>({})
  // While we're checking for a stored session on first load, show nothing
  // rather than flashing the sign-in screen for a moment before a valid
  // session is restored.
  const [checkingSession, setCheckingSession] = useState(true)

  // The employee directory is real now — fetched from the live backend
  // (Supabase via server/), not the demo dataset. Every other module below
  // (leave, payroll, attendance, etc.) still runs on in-memory demo data for
  // now; those each have a real generic CRUD API already built server-side
  // (see server/src/routes/resources.js) but aren't wired up to the
  // frontend yet — that's the next piece of work, not this one.
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoaded, setEmployeesLoaded] = useState(false)
  // Leave requests are real now too — see rawLeaves/leaves below. Every
  // other module still runs on in-memory demo data (currently empty
  // arrays; nothing invented to fill it back in) for now.
  const [rawLeaves, setRawLeaves] = useState<api.RawLeaveRequest[]>([])
  const [leavesLoaded, setLeavesLoaded] = useState(false)
  // Expense claims are real now too — see rawExpenses/expenses below.
  const [rawExpenses, setRawExpenses] = useState<api.RawExpenseClaim[]>([])
  const [expensesLoaded, setExpensesLoaded] = useState(false)
  // Payroll records are real now too — see rawPayroll/payroll below.
  const [rawPayroll, setRawPayroll] = useState<api.RawPayrollRecord[]>([])
  const [payrollLoaded, setPayrollLoaded] = useState(false)
  // Attendance records are real now too — see rawAttendance/attendance below.
  const [rawAttendance, setRawAttendance] = useState<api.RawAttendanceRecord[]>([])
  const [attendanceLoaded, setAttendanceLoaded] = useState(false)
  const [tickets, setTickets] = useState<EmployeeTicket[]>(mockData.employeeTickets)
  const [exits, setExits] = useState<ExitRecord[]>(mockData.exitRecords)
  const [requisitions, setRequisitions] = useState<JobRequisition[]>(mockData.jobRequisitions)
  const [candidates, setCandidates] = useState<Candidate[]>(mockData.candidates)
  const [goals, setGoals] = useState<PerformanceGoal[]>(mockData.performanceGoals)
  const [reviews, setReviews] = useState<PerformanceReview[]>(mockData.performanceReviews)
  const [onboarding, setOnboarding] = useState<OnboardingCandidate[]>(mockData.onboardingCandidates)
  const [notifications, setNotifications] = useState<Notification[]>(mockData.notifications)

  const onEmployeesUpdate = (next: Employee[]) => { setEmployees(next) }

  // `leaves` (below, derived from rawLeaves) is what every screen actually
  // reads and writes via this same onLeaveUpdate prop they already had — no
  // screen needed to change. It diffs the new array against the current
  // one: rows with an id that didn't exist before are new applications
  // (POST), rows whose status/pendingWith changed are approve/reject
  // decisions (PATCH); everything else is left alone. The optimistic
  // setRawLeaves below makes the change visible immediately, then a re-fetch
  // once the server calls settle replaces temp ids/timestamps with the real
  // stored values (or reverts if a call failed).
  const onLeaveUpdate = (next: LeaveRequest[]) => {
    const prevById = new Map(leaves.map(l => [l.id, l]))
    const created = next.filter(l => !prevById.has(l.id))
    const updated = next.filter(l => {
      const prev = prevById.get(l.id)
      return prev && (prev.status !== l.status || prev.pendingWith !== l.pendingWith)
    })

    setRawLeaves(next.map(l => ({
      id: l.id,
      employeeId: l.employeeId,
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      days: l.days,
      reason: l.reason,
      status: l.status,
      submittedByRole: l.submittedByRole,
      pendingWith: l.pendingWith,
      appliedOn: l.appliedOn,
    })))

      ; (async () => {
        try {
          for (const l of created) {
            await api.createLeaveRequest({
              employeeId: l.employeeId,
              type: l.type,
              startDate: l.startDate,
              endDate: l.endDate,
              days: l.days,
              reason: l.reason,
              submittedByRole: l.submittedByRole,
              pendingWith: l.pendingWith,
            })
          }
          for (const l of updated) {
            await api.updateLeaveRequest(l.id, {
              status: l.status,
              pendingWith: l.pendingWith,
              decidedBy: currentEmployeeId || undefined,
              decidedAt: new Date().toISOString(),
            })
          }
        } catch (err) {
          console.error('Failed to save a leave request change to the server', err)
        } finally {
          try {
            setRawLeaves(await api.fetchLeaveRequests())
          } catch {
            // Offline/unreachable — stay on the optimistic state rather than
            // blanking the screen.
          }
        }
      })()
  }
  // Same generic diff-and-sync approach as onPayrollUpdate/onAttendanceUpdate.
  const onExpensesUpdate = (next: ExpenseClaim[]) => {
    const prevById = new Map(expenses.map(e => [e.id, e]))
    const created = next.filter(e => !prevById.has(e.id))
    const updated = next.filter(e => {
      const prev = prevById.get(e.id)
      return prev && JSON.stringify(expenseFieldsOf(prev)) !== JSON.stringify(expenseFieldsOf(e))
    })

    setRawExpenses(next.map(e => ({ id: e.id, claimedOn: e.claimedOn, ...expenseFieldsOf(e) } as api.RawExpenseClaim)))

      ; (async () => {
        try {
          for (const e of created) {
            await api.createExpenseClaim(expenseFieldsOf(e))
          }
          for (const e of updated) {
            await api.updateExpenseClaim(e.id, expenseFieldsOf(e))
          }
        } catch (err) {
          console.error('Failed to save an expense claim change to the server', err)
        } finally {
          try {
            setRawExpenses(await api.fetchExpenseClaims())
          } catch {
            // Offline/unreachable — stay on the optimistic state.
          }
        }
      })()
  }
  // Same idea as onLeaveUpdate above, but generic over every persistable
  // field instead of hardcoding which ones count as "changed" — payroll
  // records get touched by more distinct actions (generate, manager
  // approve, HR process, finance sign-off) than leave requests do, so this
  // diffs the actual stored columns rather than special-casing each one.
  const onPayrollUpdate = (next: PayrollRecord[]) => {
    const prevById = new Map(payroll.map(p => [p.id, p]))
    const created = next.filter(p => !prevById.has(p.id))
    const updated = next.filter(p => {
      const prev = prevById.get(p.id)
      return prev && JSON.stringify(payrollFieldsOf(prev)) !== JSON.stringify(payrollFieldsOf(p))
    })

    setRawPayroll(next.map(p => ({ id: p.id, ...payrollFieldsOf(p) } as api.RawPayrollRecord)))

      ; (async () => {
        try {
          for (const p of created) {
            await api.createPayrollRecord(payrollFieldsOf(p))
          }
          for (const p of updated) {
            await api.updatePayrollRecord(p.id, payrollFieldsOf(p))
          }
        } catch (err) {
          console.error('Failed to save a payroll record change to the server', err)
        } finally {
          try {
            setRawPayroll(await api.fetchPayrollRecords())
          } catch {
            // Offline/unreachable — stay on the optimistic state.
          }
        }
      })()
  }
  // Same generic diff-and-sync approach as onPayrollUpdate.
  const onAttendanceUpdate = (next: AttendanceRecord[]) => {
    const prevById = new Map(attendance.map(a => [a.id, a]))
    const created = next.filter(a => !prevById.has(a.id))
    const updated = next.filter(a => {
      const prev = prevById.get(a.id)
      return prev && JSON.stringify(attendanceFieldsOf(prev)) !== JSON.stringify(attendanceFieldsOf(a))
    })

    setRawAttendance(next.map(a => ({ id: a.id, ...attendanceFieldsOf(a) } as api.RawAttendanceRecord)))

      ; (async () => {
        try {
          for (const a of created) {
            await api.createAttendanceRecord(attendanceFieldsOf(a))
          }
          for (const a of updated) {
            await api.updateAttendanceRecord(a.id, attendanceFieldsOf(a))
          }
        } catch (err) {
          console.error('Failed to save an attendance record change to the server', err)
        } finally {
          try {
            setRawAttendance(await api.fetchAttendanceRecords())
          } catch {
            // Offline/unreachable — stay on the optimistic state.
          }
        }
      })()
  }
  const onTicketsUpdate = (next: EmployeeTicket[]) => { setTickets(next) }
  const onExitsUpdate = (next: ExitRecord[]) => { setExits(next) }
  const onRequisitionsUpdate = (next: JobRequisition[]) => { setRequisitions(next) }
  const onOnboardingUpdate = (next: OnboardingCandidate[]) => { setOnboarding(next) }
  const onNotificationsUpdate = (next: Notification[]) => { setNotifications(next) }

  const navigate = (s: string, p?: Record<string, string>) => { setScreen(s); setParams(p || {}) }

  // Applies a freshly-signed-in (or session-restored) employee into local
  // state — merging into `employees` rather than replacing it wholesale,
  // since the full directory fetch below might not have completed yet.
  const applySession = (session: Session) => {
    setRole(session.role)
    setCurrentEmployeeId(session.employee.id)
    setEmployees(prev => {
      const exists = prev.some(e => e.id === session.employee.id)
      return exists ? prev.map(e => e.id === session.employee.id ? session.employee : e) : [...prev, session.employee]
    })
  }

  const handleLogin = (session: Session) => {
    applySession(session)
    setScreen(DEFAULT_SCREEN[session.role])
  }

  const handleLogout = () => {
    api.clearToken()
    setRole(null)
    setCurrentEmployeeId(null)
    setEmployees([])
    setEmployeesLoaded(false)
    setRawLeaves([])
    setLeavesLoaded(false)
    setRawPayroll([])
    setPayrollLoaded(false)
    setRawAttendance([])
    setAttendanceLoaded(false)
    setRawExpenses([])
    setExpensesLoaded(false)
    setScreen('hr-dashboard')
  }

  // On first load, try to restore a session from a previously-stored token
  // (see src/lib/api.ts) so a page reload doesn't drop the user back to the
  // sign-in screen.
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        const session = await api.restoreSession()
        if (cancelled) return
        if (session) applySession(session)
        setCheckingSession(false)
      })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once signed in, load the real employee directory from the backend —
  // runs once per session (not on every render), and re-runs if the user
  // logs out and a different person logs back in.
  useEffect(() => {
    if (!role || employeesLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const list = await api.fetchEmployees()
          if (!cancelled) setEmployees(list)
        } catch {
          // Leave whatever's already in state (at minimum, the signed-in
          // person from applySession) rather than blanking the screen.
        } finally {
          if (!cancelled) setEmployeesLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, employeesLoaded])

  // Same pattern, for leave requests (server/src/routes/resources.js's
  // generic CRUD router over leave_requests).
  useEffect(() => {
    if (!role || leavesLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchLeaveRequests()
          if (!cancelled) setRawLeaves(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setLeavesLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, leavesLoaded])

  // Same pattern, for payroll records.
  useEffect(() => {
    if (!role || payrollLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchPayrollRecords()
          if (!cancelled) setRawPayroll(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setPayrollLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, payrollLoaded])

  // Same pattern, for attendance records.
  useEffect(() => {
    if (!role || attendanceLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchAttendanceRecords()
          if (!cancelled) setRawAttendance(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setAttendanceLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, attendanceLoaded])

  // Same pattern, for expense claims.
  useEffect(() => {
    if (!role || expensesLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchExpenseClaims()
          if (!cancelled) setRawExpenses(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setExpensesLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, expensesLoaded])

  if (checkingSession) return null

  if (!role) return <Login onLogin={handleLogin} />

  // The employee directory has each row's name/department, which the raw
  // leave_requests rows from the backend don't store (see api.ts) — filled
  // in here since this is the one place both are already loaded.
  const leaves: LeaveRequest[] = rawLeaves.map(r => {
    const emp = employees.find(e => e.id === r.employeeId)
    return {
      ...r,
      id: String(r.id),
      employeeName: emp?.name || 'Unknown',
      department: emp?.department || '',
      startDate: toDateOnly(r.startDate),
      endDate: toDateOnly(r.endDate),
      appliedOn: toDateOnly(r.appliedOn),
      days: Number(r.days),
    }
  })

  // Same idea — payroll_records doesn't store the employee's name or
  // current job title either.
  const payroll: PayrollRecord[] = rawPayroll.map(r => {
    const emp = employees.find(e => e.id === r.employeeId)
    return {
      ...r,
      id: String(r.id),
      employeeName: emp?.name || 'Unknown',
      role: emp?.role || 'agent',
      baseSalary: Number(r.baseSalary),
      incentives: Number(r.incentives),
      deductions: Number(r.deductions),
      netPay: Number(r.netPay),
      periodStart: r.periodStart ? toDateOnly(r.periodStart) : undefined,
      periodEnd: r.periodEnd ? toDateOnly(r.periodEnd) : undefined,
      reimbursements: r.reimbursements != null ? Number(r.reimbursements) : undefined,
      bonus: r.bonus != null ? Number(r.bonus) : undefined,
      otherDeductions: r.otherDeductions != null ? Number(r.otherDeductions) : undefined,
    }
  })

  // Same idea — attendance_records doesn't store the employee's name either.
  const attendance: AttendanceRecord[] = rawAttendance.map(r => {
    const emp = employees.find(e => e.id === r.employeeId)
    return {
      ...r,
      id: String(r.id),
      employeeName: emp?.name || 'Unknown',
      date: toDateOnly(r.date),
    }
  })

  // Same idea — expense_claims doesn't store the employee's name/department,
  // and has no column yet for the actual receipt image (see api.ts).
  const expenses: ExpenseClaim[] = rawExpenses.map(r => {
    const emp = employees.find(e => e.id === r.employeeId)
    return {
      ...r,
      id: String(r.id),
      employeeName: emp?.name || 'Unknown',
      department: emp?.department || '',
      date: toDateOnly(r.date),
      claimedOn: toDateOnly(r.claimedOn),
      reimbursedOn: r.reimbursedOn ? toDateOnly(r.reimbursedOn) : undefined,
      amount: Number(r.amount),
      receipt: !!r.receiptFilename,
      receiptFileName: r.receiptFilename || undefined,
    }
  })

  const unreadCount = notifications.filter(n => !n.read).length
  const sharedLeaveProps = { leaves, onLeaveUpdate }
  const sharedExpenseProps = { expenses, onExpensesUpdate }
  // role is set — handleLogin always sets an employeeId alongside it.
  const employeeId = currentEmployeeId || ''
  const currentEmployee = employees.find(e => e.id === employeeId)

  const renderScreen = () => {
    switch (screen) {
      case 'my-portal':
        return (
          <MyPortal
            {...sharedLeaveProps} {...sharedExpenseProps}
            employeeId={employeeId}
            employees={employees}
            attendance={attendance}
            tickets={tickets} onTicketsUpdate={onTicketsUpdate}
          />
        )
      case 'manager-portal':
        return (
          <ManagerPortal
            {...sharedLeaveProps} {...sharedExpenseProps}
            employeeId={employeeId}
            employees={employees}
            attendance={attendance}
            payroll={payroll} onPayrollUpdate={onPayrollUpdate}
          />
        )
      case 'mgmt-portal':
        return (
          <MgmtPortal
            {...sharedLeaveProps}
            employees={employees}
            payroll={payroll}
            tickets={tickets}
            exits={exits}
            currentEmployee={currentEmployee}
          />
        )
      case 'finance-portal':
        return (
          <FinancePortal
            payroll={payroll} onPayrollUpdate={onPayrollUpdate}
            {...sharedExpenseProps}
            currentEmployee={currentEmployee}
          />
        )
      case 'hr-dashboard':
        return (
          <HRDashboard
            navigate={navigate}
            employees={employees} leaves={leaves} payroll={payroll} attendance={attendance}
            tickets={tickets} expenses={expenses} exits={exits} onboarding={onboarding}
            currentEmployee={currentEmployee}
          />
        )
      case 'recruitment':
        return <Recruitment requisitions={requisitions} onRequisitionsUpdate={onRequisitionsUpdate} candidates={candidates} currentEmployee={currentEmployee} />
      case 'performance':
        return <Performance goals={goals} reviews={reviews} />
      case 'directory':
        return <Directory employees={employees} currentEmployeeId={employeeId} onEmployeesUpdate={onEmployeesUpdate} />
      case 'org-chart':
        return <OrgChart employees={employees} />
      case 'attendance-hr':
        return <AttendanceHR employees={employees} attendance={attendance} onAttendanceUpdate={onAttendanceUpdate} />
      case 'my-timesheet':
        return <MyTimesheet employeeId={employeeId} employees={employees} />
      case 'team-timesheet':
        return <TeamTimesheet employees={employees} />
      case 'leave':
        return <Leave role={role} employees={employees} {...sharedLeaveProps} />
      case 'payroll-hr':
        return <PayrollHR role={role} payroll={payroll} onPayrollUpdate={onPayrollUpdate} employees={employees} attendance={attendance} leaves={leaves} />
      case 'expense-hr':
        return <ExpenseHR {...sharedExpenseProps} employees={employees} currentEmployee={currentEmployee} />
      case 'onboarding-hr':
        return <OnboardingHR onboarding={onboarding} onOnboardingUpdate={onOnboardingUpdate} />
      case 'exit-management':
        return <ExitManagement exits={exits} onExitsUpdate={onExitsUpdate} />
      case 'tickets-hr':
        return <TicketsHR tickets={tickets} onTicketsUpdate={onTicketsUpdate} currentEmployee={currentEmployee} />
      case 'notifications':
        return <Notifications notifications={notifications} onNotificationsUpdate={onNotificationsUpdate} />
      case 'settings':
        return <Settings />
      case 'profile':
        return <Profile employeeId={employeeId} employees={employees} onEmployeesUpdate={onEmployeesUpdate} payroll={payroll} attendance={attendance} leaves={leaves} />
      default:
        return <HRDashboard navigate={navigate} employees={employees} leaves={leaves} payroll={payroll} attendance={attendance} tickets={tickets} expenses={expenses} exits={exits} onboarding={onboarding} currentEmployee={currentEmployee} />
    }
  }

  return (
    <Layout role={role} screen={screen} onNavigate={navigate} onLogout={handleLogout} unreadCount={unreadCount} currentEmployee={currentEmployee}>
      {renderScreen()}
    </Layout>
  )
}

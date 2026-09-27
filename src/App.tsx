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
import { NAV_BY_ROLE } from './components/layout/Sidebar'

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

// Every screen a role is actually allowed to open — the same ids that
// role's sidebar can navigate to, plus the few screens every role shares
// (notifications/settings/profile aren't in the sidebar's per-role nav list
// but every role can reach them). This is a defense-in-depth guard: even if
// `screen` state ever ends up holding a screen id the current role has no
// button for (a stale value, a bug elsewhere), renderScreen() below falls
// back to that role's own default rather than rendering it — so a
// review/approval screen meant for HR/management can never be shown to a
// CRM/employee login just because `screen` happened to hold its id.
const SHARED_SCREENS = ['notifications', 'settings', 'profile']
const ALLOWED_SCREENS: Record<Role, Set<string>> = Object.fromEntries(
  (Object.keys(NAV_BY_ROLE) as Role[]).map(r => [r, new Set([...NAV_BY_ROLE[r].map(i => i.id), ...SHARED_SCREENS])])
) as Record<Role, Set<string>>

// Postgres DATE/TIMESTAMPTZ columns serialize through JSON as full ISO
// strings (e.g. "2026-01-15T00:00:00.000Z") — trimmed to the plain
// YYYY-MM-DD the frontend displays and stores everywhere else.
function toDateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : ''
}

// A ticket comment's timestamp (a real TIMESTAMPTZ from the database) shown
// the same friendly way both HR's and the employee's own "raise a ticket"
// screens used to format it locally before comments were a real table.
function formatCommentAt(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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

// updatedAt is deliberately excluded from this list — see onTicketsUpdate
// below, which always sets it fresh on every actual change rather than
// trusting whatever the child screen happened to leave on the object (the
// same reason leave requests' decidedAt is set centrally, not per-screen).
const TICKET_FIELDS = ['employeeId', 'title', 'type', 'priority', 'status', 'description', 'assignedTo', 'resolution'] as const

function ticketFieldsOf(t: EmployeeTicket): Omit<api.RawEmployeeTicket, 'id' | 'raisedOn' | 'updatedAt'> {
  const out: Record<string, unknown> = {}
  for (const f of TICKET_FIELDS) out[f] = (t as unknown as Record<string, unknown>)[f] ?? null
  return out as Omit<api.RawEmployeeTicket, 'id' | 'raisedOn' | 'updatedAt'>
}

const EXIT_FIELDS = [
  'employeeId', 'exitType', 'resignationDate', 'lastWorkingDay', 'noticePeriodDays',
  'status', 'exitInterviewDone', 'fnfAmount', 'fnfStatus', 'reason', 'rehireEligible',
  'clearanceChecklist',
] as const

function exitFieldsOf(r: ExitRecord): Omit<api.RawExitRecord, 'id'> {
  const out: Record<string, unknown> = {}
  for (const f of EXIT_FIELDS) out[f] = (r as unknown as Record<string, unknown>)[f] ?? null
  return out as Omit<api.RawExitRecord, 'id'>
}

// `applicants` is deliberately excluded — it's not a database column at all,
// just a live count of candidates derived below, so it's never sent to the
// server (see api.ts's RawJobRequisition).
const REQUISITION_FIELDS = [
  'title', 'department', 'team', 'openings', 'location', 'employmentType',
  'status', 'requestedBy', 'approvedBy', 'postedOn', 'channels', 'startDate',
  'targetCloseDate', 'ctcRange',
] as const

function requisitionFieldsOf(r: JobRequisition): Omit<api.RawJobRequisition, 'id'> {
  const out: Record<string, unknown> = {}
  for (const f of REQUISITION_FIELDS) out[f] = (r as unknown as Record<string, unknown>)[f] ?? null
  return out as Omit<api.RawJobRequisition, 'id'>
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
  // Employee tickets are real now too — see rawTickets/tickets below.
  // Comments are fetched separately (they live in their own table, not a
  // column on tickets — see api.ts) and grouped in by ticketId when tickets
  // is derived.
  const [rawTickets, setRawTickets] = useState<api.RawEmployeeTicket[]>([])
  const [ticketsLoaded, setTicketsLoaded] = useState(false)
  const [rawTicketComments, setRawTicketComments] = useState<api.RawTicketComment[]>([])
  const [ticketCommentsLoaded, setTicketCommentsLoaded] = useState(false)
  // Exit records are real now too — see rawExits/exits below.
  const [rawExits, setRawExits] = useState<api.RawExitRecord[]>([])
  const [exitsLoaded, setExitsLoaded] = useState(false)
  // Job requisitions and candidates are real now too — see
  // rawRequisitions/requisitions and rawCandidates/candidates below.
  // Candidates have no create/update UI anywhere in the app, so they're
  // only ever fetched, never diffed/synced like the other modules.
  const [rawRequisitions, setRawRequisitions] = useState<api.RawJobRequisition[]>([])
  const [requisitionsLoaded, setRequisitionsLoaded] = useState(false)
  const [rawCandidates, setRawCandidates] = useState<Candidate[]>([])
  const [candidatesLoaded, setCandidatesLoaded] = useState(false)
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
  // Used only by MyPortal's expense-sheet submission, which creates claims
  // (and uploads their receipt photos) directly against the API rather than
  // going through the onExpensesUpdate diff above — that diff can't upload a
  // receipt itself, since a receipt needs the real database id the server
  // assigns on create, not the temporary client-side id a new claim starts
  // with. MyPortal calls this afterward to pull the freshly created rows
  // (with their receiptFilename now set) into state.
  const refetchExpenses = async () => {
    try {
      setRawExpenses(await api.fetchExpenseClaims())
    } catch (err) {
      console.error('Failed to refresh expense claims from the server', err)
    }
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
  // Same generic diff-and-sync approach as onPayrollUpdate/onAttendanceUpdate
  // — comments are excluded from TICKET_FIELDS entirely (they're not a
  // column here, see api.ts/ticketFieldsOf), so adding a reply never runs
  // through this path; see addTicketComment below instead. updatedAt isn't
  // part of the equality check (it always differs) but IS sent on every
  // real update, mirroring how onLeaveUpdate always sets decidedAt itself.
  const onTicketsUpdate = (next: EmployeeTicket[]) => {
    const prevById = new Map(tickets.map(t => [t.id, t]))
    const created = next.filter(t => !prevById.has(t.id))
    const updated = next.filter(t => {
      const prev = prevById.get(t.id)
      return prev && JSON.stringify(ticketFieldsOf(prev)) !== JSON.stringify(ticketFieldsOf(t))
    })

    setRawTickets(next.map(t => ({ id: t.id, raisedOn: t.raisedOn, updatedAt: t.updatedAt, ...ticketFieldsOf(t) } as api.RawEmployeeTicket)))

      ; (async () => {
        try {
          for (const t of created) {
            await api.createTicket(ticketFieldsOf(t))
          }
          for (const t of updated) {
            await api.updateTicket(t.id, { ...ticketFieldsOf(t), updatedAt: new Date().toISOString() })
          }
        } catch (err) {
          console.error('Failed to save a ticket change to the server', err)
        } finally {
          try {
            setRawTickets(await api.fetchTickets())
          } catch {
            // Offline/unreachable — stay on the optimistic state.
          }
        }
      })()
  }
  // Adding a reply never goes through onTicketsUpdate above — comments live
  // in their own table, not a column on the ticket — so this posts directly
  // and refetches just the comments.
  const addTicketComment = async (ticketId: string, text: string) => {
    try {
      await api.createTicketComment(ticketId, text)
    } catch (err) {
      console.error('Failed to save a ticket comment to the server', err)
    } finally {
      try {
        setRawTicketComments(await api.fetchTicketComments())
      } catch {
        // Offline/unreachable — stay on whatever comments are already shown.
      }
    }
  }
  // Same generic diff-and-sync approach as onPayrollUpdate/onAttendanceUpdate
  // — clearanceChecklist is a real JSONB column (see exitFieldsOf/EXIT_FIELDS
  // above), so toggling one of its items is just another field change here,
  // not a separate table like ticket comments needed.
  const onExitsUpdate = (next: ExitRecord[]) => {
    const prevById = new Map(exits.map(r => [r.id, r]))
    const created = next.filter(r => !prevById.has(r.id))
    const updated = next.filter(r => {
      const prev = prevById.get(r.id)
      return prev && JSON.stringify(exitFieldsOf(prev)) !== JSON.stringify(exitFieldsOf(r))
    })

    setRawExits(next.map(r => ({ id: r.id, ...exitFieldsOf(r) } as api.RawExitRecord)))

      ; (async () => {
        try {
          for (const r of created) {
            await api.createExitRecord(exitFieldsOf(r))
          }
          for (const r of updated) {
            await api.updateExitRecord(r.id, exitFieldsOf(r))
          }
        } catch (err) {
          console.error('Failed to save an exit record change to the server', err)
        } finally {
          try {
            setRawExits(await api.fetchExitRecords())
          } catch {
            // Offline/unreachable — stay on the optimistic state.
          }
        }
      })()
  }
  // Same generic diff-and-sync approach as onExitsUpdate above.
  // job_requisitions.id is a client-supplied TEXT primary key (Recruitment.tsx
  // generates it as `req-${Date.now()}`), so unlike every other create()
  // call, this one has to send the id explicitly.
  const onRequisitionsUpdate = (next: JobRequisition[]) => {
    const prevById = new Map(requisitions.map(r => [r.id, r]))
    const created = next.filter(r => !prevById.has(r.id))
    const updated = next.filter(r => {
      const prev = prevById.get(r.id)
      return prev && JSON.stringify(requisitionFieldsOf(prev)) !== JSON.stringify(requisitionFieldsOf(r))
    })

    setRawRequisitions(next.map(r => ({ id: r.id, ...requisitionFieldsOf(r) } as api.RawJobRequisition)))

      ; (async () => {
        try {
          for (const r of created) {
            await api.createJobRequisition({ id: r.id, ...requisitionFieldsOf(r) })
          }
          for (const r of updated) {
            await api.updateJobRequisition(r.id, requisitionFieldsOf(r))
          }
        } catch (err) {
          console.error('Failed to save a job requisition change to the server', err)
        } finally {
          try {
            setRawRequisitions(await api.fetchJobRequisitions())
          } catch {
            // Offline/unreachable — stay on the optimistic state.
          }
        }
      })()
  }
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
    setRawTickets([])
    setTicketsLoaded(false)
    setRawTicketComments([])
    setTicketCommentsLoaded(false)
    setRawExits([])
    setExitsLoaded(false)
    setRawRequisitions([])
    setRequisitionsLoaded(false)
    setRawCandidates([])
    setCandidatesLoaded(false)
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

  // Same pattern, for tickets.
  useEffect(() => {
    if (!role || ticketsLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchTickets()
          if (!cancelled) setRawTickets(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setTicketsLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, ticketsLoaded])

  // Same pattern, for ticket comments (a separate table — see api.ts).
  useEffect(() => {
    if (!role || ticketCommentsLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchTicketComments()
          if (!cancelled) setRawTicketComments(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setTicketCommentsLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, ticketCommentsLoaded])

  // Same pattern, for exit records.
  useEffect(() => {
    if (!role || exitsLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchExitRecords()
          if (!cancelled) setRawExits(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setExitsLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, exitsLoaded])

  // Same pattern, for job requisitions.
  useEffect(() => {
    if (!role || requisitionsLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchJobRequisitions()
          if (!cancelled) setRawRequisitions(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setRequisitionsLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, requisitionsLoaded])

  // Same pattern, for candidates (read-only — see rawCandidates above).
  useEffect(() => {
    if (!role || candidatesLoaded) return
    let cancelled = false
      ; (async () => {
        try {
          const rows = await api.fetchCandidates()
          if (!cancelled) setRawCandidates(rows)
        } catch {
          // Leave whatever's already in state rather than blanking the screen.
        } finally {
          if (!cancelled) setCandidatesLoaded(true)
        }
      })()
    return () => { cancelled = true }
  }, [role, candidatesLoaded])

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

  // Same idea — tickets doesn't store employee_id's name/department, and its
  // comments come from a completely separate fetch (see rawTicketComments
  // above), grouped in here by ticketId rather than living in this array.
  const tickets: EmployeeTicket[] = rawTickets.map(r => {
    const emp = employees.find(e => e.id === r.employeeId)
    return {
      ...r,
      id: String(r.id),
      employeeName: emp?.name || 'Unknown',
      department: emp?.department || '',
      raisedOn: toDateOnly(r.raisedOn),
      updatedAt: toDateOnly(r.updatedAt),
      comments: rawTicketComments
        .filter(c => String(c.ticketId) === String(r.id))
        .map(c => ({ by: c.byName, role: c.byRole, text: c.body, at: formatCommentAt(c.createdAt) })),
    }
  })

  // Same idea — exit_records doesn't store the employee's name/department/
  // role, so those are joined in from the employee directory here.
  const exits: ExitRecord[] = rawExits.map(r => {
    const emp = employees.find(e => e.id === r.employeeId)
    return {
      ...r,
      id: String(r.id),
      employeeName: emp?.name || 'Unknown',
      role: emp?.role || 'agent',
      department: emp?.department || '',
      resignationDate: toDateOnly(r.resignationDate),
      lastWorkingDay: toDateOnly(r.lastWorkingDay),
      fnfAmount: r.fnfAmount != null ? Number(r.fnfAmount) : undefined,
      clearanceChecklist: r.clearanceChecklist || [],
    }
  })

  // candidates.id/resume_score come back as BIGINT/INTEGER — id needs the
  // usual String() coercion; resume_score is already a number. Dates are
  // trimmed the same way as every other TIMESTAMPTZ column above.
  const candidates: Candidate[] = rawCandidates.map(c => ({
    ...c,
    id: String(c.id),
    appliedOn: toDateOnly(c.appliedOn),
    interviewDate: c.interviewDate ? toDateOnly(c.interviewDate) : undefined,
  }))

  // job_requisitions doesn't store `applicants` at all — it's computed live
  // here from how many candidates point at each requisition, rather than
  // being a stored (and therefore staleness-prone) column. start_date/
  // target_close_date are DATE columns and posted_on is TIMESTAMPTZ — like
  // every other date column in this app, Postgres serializes those as full
  // ISO timestamps, so they're trimmed to YYYY-MM-DD the same way (the
  // screen displays these raw, so without this they'd show a full
  // timestamp instead of a clean date).
  const requisitions: JobRequisition[] = rawRequisitions.map(r => ({
    ...r,
    startDate: toDateOnly(r.startDate),
    targetCloseDate: toDateOnly(r.targetCloseDate),
    postedOn: r.postedOn ? toDateOnly(r.postedOn) : undefined,
    applicants: candidates.filter(c => c.requisitionId === r.id).length,
  }))

  const unreadCount = notifications.filter(n => !n.read).length
  const sharedLeaveProps = { leaves, onLeaveUpdate }
  const sharedExpenseProps = { expenses, onExpensesUpdate }
  const sharedTicketProps = { tickets, onTicketsUpdate, onAddTicketComment: addTicketComment }
  // role is set — handleLogin always sets an employeeId alongside it.
  const employeeId = currentEmployeeId || ''
  const currentEmployee = employees.find(e => e.id === employeeId)

  // See ALLOWED_SCREENS above — never render (or highlight/title) a screen
  // this role has no sidebar entry for, no matter how `screen` state got
  // set to it. Used both for the switch below and for what's handed to
  // Layout, so the sidebar highlight and page title never disagree with
  // what's actually on screen.
  const effectiveScreen = ALLOWED_SCREENS[role].has(screen) ? screen : DEFAULT_SCREEN[role]

  const renderScreen = () => {
    switch (effectiveScreen) {
      case 'my-portal':
        return (
          <MyPortal
            {...sharedLeaveProps} {...sharedExpenseProps} {...sharedTicketProps}
            onExpensesRefetch={refetchExpenses}
            employeeId={employeeId}
            employees={employees}
            attendance={attendance}
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
            employees={employees}
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
        return <Recruitment requisitions={requisitions} onRequisitionsUpdate={onRequisitionsUpdate} candidates={candidates} currentEmployee={currentEmployee} employees={employees} />
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
        return <ExpenseHR {...sharedExpenseProps} onExpensesRefetch={refetchExpenses} employees={employees} currentEmployee={currentEmployee} />
      case 'onboarding-hr':
        return <OnboardingHR onboarding={onboarding} onOnboardingUpdate={onOnboardingUpdate} />
      case 'exit-management':
        return <ExitManagement exits={exits} onExitsUpdate={onExitsUpdate} employees={employees} />
      case 'tickets-hr':
        return <TicketsHR {...sharedTicketProps} currentEmployee={currentEmployee} />
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
    <Layout role={role} screen={effectiveScreen} onNavigate={navigate} onLogout={handleLogout} unreadCount={unreadCount} currentEmployee={currentEmployee}>
      {renderScreen()}
    </Layout>
  )
}

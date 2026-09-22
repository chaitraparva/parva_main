import { useState } from 'react'
import type {
  Role, LeaveRequest, Employee, ExpenseClaim, PayrollRecord, AttendanceRecord,
  EmployeeTicket, ExitRecord, JobRequisition, Candidate, PerformanceGoal,
  PerformanceReview, Notification,
} from './types'
import * as mockData from './data/mockData'
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
  crm:        'my-portal',
  manager:    'manager-portal',
  hr:         'hr-dashboard',
  management: 'mgmt-portal',
  finance:    'finance-portal',
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

  // Every entity the frontend renders is lifted here — this is the app's
  // single source of truth, seeded straight from the demo dataset. This is
  // a demo build: everything lives in memory for the session and nothing
  // is persisted to a server, matching how the app worked before the
  // backend experiment.
  const [employees, setEmployees] = useState<Employee[]>(mockData.employees)
  const [leaves, setLeaves] = useState<LeaveRequest[]>(mockData.leaveRequests)
  const [expenses, setExpenses] = useState<ExpenseClaim[]>(mockData.expenseClaims)
  const [payroll, setPayroll] = useState<PayrollRecord[]>(mockData.payrollRecords)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(mockData.attendanceRecords)
  const [tickets, setTickets] = useState<EmployeeTicket[]>(mockData.employeeTickets)
  const [exits, setExits] = useState<ExitRecord[]>(mockData.exitRecords)
  const [requisitions, setRequisitions] = useState<JobRequisition[]>(mockData.jobRequisitions)
  const [candidates, setCandidates] = useState<Candidate[]>(mockData.candidates)
  const [goals, setGoals] = useState<PerformanceGoal[]>(mockData.performanceGoals)
  const [reviews, setReviews] = useState<PerformanceReview[]>(mockData.performanceReviews)
  const [onboarding, setOnboarding] = useState<OnboardingCandidate[]>(mockData.onboardingCandidates)
  const [notifications, setNotifications] = useState<Notification[]>(mockData.notifications)

  const onEmployeesUpdate = (next: Employee[]) => { setEmployees(next) }
  const onLeaveUpdate = (next: LeaveRequest[]) => { setLeaves(next) }
  const onExpensesUpdate = (next: ExpenseClaim[]) => { setExpenses(next) }
  const onPayrollUpdate = (next: PayrollRecord[]) => { setPayroll(next) }
  const onAttendanceUpdate = (next: AttendanceRecord[]) => { setAttendance(next) }
  const onTicketsUpdate = (next: EmployeeTicket[]) => { setTickets(next) }
  const onExitsUpdate = (next: ExitRecord[]) => { setExits(next) }
  const onRequisitionsUpdate = (next: JobRequisition[]) => { setRequisitions(next) }
  const onOnboardingUpdate = (next: OnboardingCandidate[]) => { setOnboarding(next) }
  const onNotificationsUpdate = (next: Notification[]) => { setNotifications(next) }

  const navigate = (s: string, p?: Record<string, string>) => { setScreen(s); setParams(p || {}) }

  const handleLogin = (r: Role, employeeId: string) => {
    setRole(r)
    setCurrentEmployeeId(employeeId)
    setScreen(DEFAULT_SCREEN[r])
  }

  const handleLogout = () => { setRole(null); setCurrentEmployeeId(null); setScreen('hr-dashboard') }

  if (!role) return <Login onLogin={(r, employeeId) => handleLogin(r, employeeId)} employees={employees} />

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

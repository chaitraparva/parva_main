import type { Employee, Lead, PayrollRecord, AttendanceRecord, LeaveRequest, Flag, Notification, EmployeeTicket, ExpenseClaim, ExitRecord, JobTitle, JobRequisition, Candidate, PerformanceGoal, PerformanceReview } from '../types'

// ───────────────────────── Employees ─────────────────────────
// Wiped clean at Deeksha's request (2026-09-20) — the roster is being
// rebuilt directly in Supabase once that's connected, instead of being
// hand-maintained here. Nothing is invented to fill this back in.
export const employees: Employee[] = []

// ───────────────────────── Everything below is reset ─────────────────────────
// The demo/sample operational data (leads, payroll, attendance, leave,
// tickets, expenses, exits, recruitment, performance) that used to be seeded
// here belonged to the old placeholder roster and has been removed along
// with it, per the request to clear out dummy data. Every module below
// starts empty and fills up from real activity going forward.

export const leads: Lead[] = []

export const payrollRecords: PayrollRecord[] = []

export const attendanceRecords: AttendanceRecord[] = []

export const leaveRequests: LeaveRequest[] = []

export const flags: Flag[] = []

export const notifications: Notification[] = []

export const monthlyPerformance: { month: string; leads: number; conversions: number; revenue: number }[] = []

export const sourcePerformanceData: { source: string; leads: number; conversions: number; rate: number; color: string }[] = []

export const pipelineData: { stage: string; count: number; color: string }[] = []

export const companyRevenueData: { month: string; revenue: number; leads: number; conversions: number }[] = []

export const onboardingCandidates: { id: string; name: string; role: JobTitle; team: string; joiningDate: string; docStatus: string; onboardingProgress: number }[] = []

// ---- Employee Tickets ----
export const employeeTickets: EmployeeTicket[] = []

// ---- Expense Claims ----
export const expenseClaims: ExpenseClaim[] = []

// ---- Exit Records ----
export const exitRecords: ExitRecord[] = []

// ---- Recruitment Management ----
export const jobRequisitions: JobRequisition[] = []

export const candidates: Candidate[] = []

// ---- Performance Management ----
export const performanceGoals: PerformanceGoal[] = []

export const performanceReviews: PerformanceReview[] = []

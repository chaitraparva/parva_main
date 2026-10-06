export type Role = 'crm' | 'manager' | 'hr' | 'management' | 'finance'

export type JobTitle = 'agent' | 'manager' | 'admin' | 'hr' | 'finance'

export interface Employee {
  id: string
  name: string
  role: JobTitle
  email: string
  phone: string
  team: string
  managerId?: string
  joinDate: string
  status: 'active' | 'on-leave' | 'inactive'
  department: string
  leadsAssigned: number
  conversions: number
  baseSalary: number
  responseTime: string
  location: string
  photoUrl?: string
  /** Which Parva Group company this person belongs to — 'Parva Group' for the
   *  three shared group-level leads (Director, HR, Finance). */
  company: string
  /** Real-world job title/designation, shown instead of the generic
   *  role-bucket label when present (e.g. "Business Development Executive"
   *  instead of just "CRM Agent"). */
  title?: string

  // ---- Payslip fixed data (entered once by HR, not re-entered every cycle) ----
  // Personal identity fields shown on the payslip letterhead. Left blank for
  // everyone by default — never fabricated — HR fills these in for real once
  // the person is live on the system (see the Salary & Personal Details editor
  // on the Directory screen).
  dob?: string
  gender?: string
  aadharNumber?: string
  panNumber?: string
  // Salary structure — baseSalary above is the Basic Salary; these are the
  // other fixed components that make up "Net Basic Salary" on the payslip.
  hra?: number
  conveyanceAllowance?: number
  medicalAllowance?: number
  otherAllowance?: number
}

export interface PayrollRecord {
  id: string
  employeeId: string
  employeeName: string
  role: JobTitle
  month: string
  baseSalary: number
  incentives: number
  deductions: number
  netPay: number
  status: 'pending-manager' | 'pending-hr' | 'pending-management' | 'disbursed'
  managerApproved: boolean
  hrProcessed: boolean
  adminApproved: boolean

  // ---- Real payslip fields ----
  // The exact pay-cycle window this record covers (Diago Finance runs a
  // 21st-to-20th cycle, not a calendar month) — if absent, it's derived from
  // `month` (see src/lib/payslip.ts). Discretionary amounts HR can set per
  // cycle; all default to 0 when absent so older/seeded records still work.
  periodStart?: string
  periodEnd?: string
  reimbursements?: number
  bonus?: number
  otherDeductions?: number
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string
  checkOut: string
  status: 'present' | 'absent' | 'late' | 'half-day'
  // Which button was pressed at login: the normal Login (office) or the
  // separate Work From Home button. Older rows default to 'office'.
  workMode?: 'office' | 'wfh'
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  department: string
  type: 'Sick' | 'Casual' | 'Earned' | 'Unpaid'
  startDate: string
  endDate: string
  days: number
  halfDay?: boolean            // true = half a day (days is 0.5)
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  appliedOn: string
  submittedByRole: Role        // which role tier submitted this
  pendingWith: Role | 'done'  // which role tier needs to act ('done' = resolved)
  decidedBy?: string | null    // employeeId of whoever last approved/rejected this
  decidedAt?: string | null
}

export interface Flag {
  id: string
  employeeId: string
  employeeName: string
  type: 'Warning' | 'Performance' | 'Attendance' | 'Conduct'
  description: string
  severity: 'Low' | 'Medium' | 'High'
  issuedBy: string
  date: string
  status: 'Open' | 'Acknowledged' | 'Resolved'
}

export interface Notification {
  id: string
  employeeId: string
  type: 'missed-followup' | 'unassigned-lead' | 'pending-payroll' | 'leave-request' | 'flag'
  title: string
  message: string
  timestamp: string
  read: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface NavAction {
  screen: string
  params?: Record<string, string>
}

// ---- HR Extended Types ----

export type TicketType = 'IT Support' | 'Finance Query' | 'HR Request' | 'Access Request' | 'Document Request' | 'Grievance' | 'Other'
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
export type TicketStatus = 'Open' | 'In Progress' | 'Pending Info' | 'Resolved' | 'Closed'

export interface EmployeeTicket {
  id: string
  employeeId: string
  employeeName: string
  department: string
  title: string
  type: TicketType
  priority: TicketPriority
  status: TicketStatus
  description: string
  assignedTo?: string
  raisedOn: string
  updatedAt: string
  resolution?: string
  comments: TicketComment[]
}

export interface TicketComment {
  by: string
  role: 'hr' | 'employee'
  text: string
  at: string
}

export type ExpenseCategory = 'Travel' | 'Meals' | 'Training' | 'Equipment' | 'Accommodation' | 'Client Entertainment' | 'Office Supplies' | 'Other'

export interface ExpenseClaim {
  id: string
  employeeId: string
  employeeName: string
  department: string
  date: string
  description: string
  category: ExpenseCategory
  amount: number
  receipt: boolean
  receiptFileName?: string
  receiptDataUrl?: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Reimbursed'
  approvedBy?: string
  claimedOn: string
  reimbursedOn?: string
  note?: string
}

export type ExitType = 'Resignation' | 'Retirement' | 'Termination' | 'Contract End'
export type ExitStatus = 'Notice Period' | 'Clearance Pending' | 'Exit Interview Done' | 'Completed'

export interface ExitRecord {
  id: string
  employeeId: string
  employeeName: string
  role: JobTitle
  department: string
  exitType: ExitType
  resignationDate: string
  lastWorkingDay: string
  noticePeriodDays: number
  status: ExitStatus
  clearanceChecklist: ClearanceItem[]
  exitInterviewDone: boolean
  fnfAmount?: number
  fnfStatus?: 'Pending' | 'Processed'
  reason?: string
  rehireEligible?: boolean
}

export interface ClearanceItem {
  label: string
  done: boolean
  owner: string
}

// ---- Recruitment Management ----

export type RequisitionStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'On Hold' | 'Closed'

export interface JobRequisition {
  id: string
  title: string
  department: string
  team: string
  openings: number
  location: string
  employmentType: 'Full-time' | 'Contract' | 'Intern'
  status: RequisitionStatus
  requestedBy: string
  approvedBy?: string
  postedOn?: string
  channels: string[]
  applicants: number
  startDate: string
  targetCloseDate: string
  ctcRange: string
}

export type CandidateStage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'

export interface Candidate {
  id: string
  name: string
  requisitionId: string
  roleApplied: string
  source: string
  stage: CandidateStage
  email: string
  phone: string
  experience: string
  resumeScore: number
  appliedOn: string
  interviewDate?: string
  interviewer?: string
  bgvStatus: 'Not Started' | 'In Progress' | 'Cleared' | 'Flagged'
  offerStatus: 'Not Sent' | 'Sent' | 'Accepted' | 'Declined'
  ctcOffered?: string
}

// ---- Performance Management ----

export type GoalStatus = 'On Track' | 'At Risk' | 'Completed' | 'Not Started'

export interface PerformanceGoal {
  id: string
  employeeId: string
  employeeName: string
  title: string
  description: string
  quarter: string
  progress: number
  status: GoalStatus
  weight: number
}

export type ReviewStage = 'Not Started' | 'Self Review' | 'Manager Review' | '360 Feedback' | 'Calibration' | 'Completed'
export type ReviewRecommendation = 'Promotion' | 'Hike' | 'PIP' | 'No Change'

export interface PerformanceReview {
  id: string
  employeeId: string
  employeeName: string
  role: string
  department: string
  cycle: string
  stage: ReviewStage
  selfRating?: number
  managerRating?: number
  finalRating?: number
  recommendation?: ReviewRecommendation
  feedbackCount: number
  reviewer: string
}

// ---- Employee Documents ----
// Every uploaded document (ID proofs, certificates, offer letters, etc.) —
// backed by the real backend (Postgres + Supabase Storage), see
// src/lib/documentStore.ts. uploadedByName isn't stored here since it's
// resolved from the employees list at display time (DocumentsPanel.tsx).
export interface EmployeeDocument {
  id: string
  employeeId: string
  docType: string
  fileName: string
  uploadedAt: string
  uploadedById: string | null
}

// ---- Timesheets ----
// Daily activity log filled in by CRM Executives, downloadable by HR/managers
// as CSV. Stored client-side for now (see src/lib/timesheetStore.ts), same
// localStorage-until-real-backend pattern as documentStore.ts.
export interface TimesheetEntry {
  id: string
  employeeId: string
  date: string // YYYY-MM-DD
  shiftStart: string // HH:MM
  shiftEnd: string // HH:MM
  totalHours: number
  leadsAssigned: number
  callsMade: number
  connectedCalls: number
  followUpsScheduled: number
  clientAppointmentsSet: number
  salesClosed: number
  companyFundedLeads: boolean
  selfFundedLeads: boolean
  tasks: string
  loggedAt: string
}

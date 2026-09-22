import { crudRouter } from '../lib/crud.js'

// Every operational module besides auth/employees, built on the generic
// CRUD router. `writeRoles` restricts POST/PATCH to specific login roles —
// GET is always open to any signed-in employee. Tighten these further
// (e.g. "only the employee who owns this leave request, or their manager,
// can edit it") once that per-row ownership logic is needed.

export const leaveRequestsRouter = crudRouter({
  table: 'leave_requests',
  allowedColumns: [
    'employeeId', 'type', 'startDate', 'endDate', 'days', 'reason',
    'status', 'submittedByRole', 'pendingWith', 'decidedBy', 'decidedAt',
  ],
})

export const payrollRecordsRouter = crudRouter({
  table: 'payroll_records',
  allowedColumns: [
    'employeeId', 'month', 'baseSalary', 'incentives', 'deductions', 'netPay',
    'status', 'managerApproved', 'hrProcessed', 'adminApproved', 'disbursedAt',
  ],
  writeRoles: ['manager', 'hr', 'management', 'finance'],
})

export const attendanceRouter = crudRouter({
  table: 'attendance_records',
  allowedColumns: ['employeeId', 'date', 'checkIn', 'checkOut', 'status'],
})

export const expenseClaimsRouter = crudRouter({
  table: 'expense_claims',
  allowedColumns: [
    'employeeId', 'date', 'description', 'category', 'amount',
    'receiptS3Key', 'receiptFilename', 'status', 'approvedBy', 'reimbursedOn', 'note',
  ],
})

export const ticketsRouter = crudRouter({
  table: 'tickets',
  allowedColumns: [
    'employeeId', 'title', 'type', 'priority', 'status', 'description',
    'assignedTo', 'resolution',
  ],
})

export const exitRecordsRouter = crudRouter({
  table: 'exit_records',
  allowedColumns: [
    'employeeId', 'exitType', 'resignationDate', 'lastWorkingDay', 'noticePeriodDays',
    'status', 'exitInterviewDone', 'fnfAmount', 'fnfStatus', 'reason', 'rehireEligible',
  ],
  writeRoles: ['hr', 'management'],
})

export const jobRequisitionsRouter = crudRouter({
  table: 'job_requisitions',
  allowedColumns: [
    'title', 'department', 'team', 'openings', 'location', 'employmentType',
    'status', 'requestedBy', 'approvedBy', 'postedOn', 'channels', 'startDate',
    'targetCloseDate', 'ctcRange',
  ],
  writeRoles: ['hr', 'management'],
})

export const candidatesRouter = crudRouter({
  table: 'candidates',
  allowedColumns: [
    'name', 'requisitionId', 'roleApplied', 'source', 'stage', 'email', 'phone',
    'experience', 'resumeScore', 'interviewDate', 'interviewer', 'bgvStatus',
    'offerStatus', 'ctcOffered',
  ],
  writeRoles: ['hr'],
})

export const performanceGoalsRouter = crudRouter({
  table: 'performance_goals',
  allowedColumns: ['employeeId', 'title', 'description', 'quarter', 'progress', 'status', 'weight'],
})

export const performanceReviewsRouter = crudRouter({
  table: 'performance_reviews',
  allowedColumns: [
    'employeeId', 'cycle', 'stage', 'selfRating', 'managerRating', 'finalRating',
    'recommendation', 'feedbackCount', 'reviewer',
  ],
  writeRoles: ['manager', 'hr'],
})

export const flagsRouter = crudRouter({
  table: 'flags',
  allowedColumns: ['employeeId', 'type', 'description', 'severity', 'issuedBy', 'date', 'status'],
  writeRoles: ['manager', 'hr', 'management'],
})

export const notificationsRouter = crudRouter({
  table: 'notifications',
  allowedColumns: ['employeeId', 'type', 'title', 'message', 'read', 'priority'],
})

export const leadsRouter = crudRouter({
  table: 'leads',
  allowedColumns: [
    'name', 'phone', 'email', 'source', 'status', 'assignedTo', 'agentName',
    'budget', 'propertyType', 'location', 'followUpDate', 'notes', 'lastActivity',
  ],
})

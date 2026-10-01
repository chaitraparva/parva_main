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
  // Anyone can submit their own leave request (POST). PATCH (moving a
  // request forward/approved/rejected) is restricted to the three roles
  // that ever act on someone else's leave: a manager approves their CRM
  // team's request first (forwarding it to HR, see ManagerPortal.tsx), HR
  // gives the final word on that same CRM request (see Leave.tsx), and
  // management approves a manager's or HR's own leave (see MgmtPortal.tsx).
  // Without this restriction, any signed-in employee could approve their
  // own leave request by calling the API directly, since no screen ever
  // lets an employee PATCH their own row.
  updateRoles: ['manager', 'hr', 'management'],
})

export const payrollRecordsRouter = crudRouter({
  table: 'payroll_records',
  allowedColumns: [
    'employeeId', 'month', 'baseSalary', 'incentives', 'deductions', 'netPay',
    'status', 'managerApproved', 'hrProcessed', 'adminApproved', 'disbursedAt',
    'periodStart', 'periodEnd', 'reimbursements', 'bonus', 'otherDeductions',
  ],
  writeRoles: ['manager', 'hr', 'management', 'finance'],
})

export const attendanceRouter = crudRouter({
  table: 'attendance_records',
  allowedColumns: ['employeeId', 'date', 'checkIn', 'checkOut', 'status'],
  // Open to any signed-in employee — until biometric attendance is wired up,
  // everyone (CRM, manager, HR, management) marks their own attendance for
  // today from their own portal (see MyPortal.tsx/ManagerPortal.tsx), same
  // as HR/management can still mark it for anyone from AttendanceHR.tsx.
})

export const timesheetEntriesRouter = crudRouter({
  table: 'timesheet_entries',
  allowedColumns: [
    'employeeId', 'date', 'shiftStart', 'shiftEnd', 'totalHours', 'leadsAssigned',
    'callsMade', 'connectedCalls', 'followUpsScheduled', 'clientAppointmentsSet',
    'salesClosed', 'companyFundedLeads', 'selfFundedLeads', 'tasks', 'loggedAt',
  ],
  // Every CRM employee logs their own day (POST) and can go back and correct
  // an earlier entry (PATCH) — there's no approval workflow here, unlike
  // leave/expenses/tickets, so this stays open to any signed-in employee.
  // DELETE follows the same logic — no approval to protect — so anyone can
  // remove their own logged day (e.g. a duplicate/mistaken entry).
  selfDelete: true,
})

export const expenseClaimsRouter = crudRouter({
  table: 'expense_claims',
  allowedColumns: [
    'employeeId', 'date', 'description', 'category', 'amount',
    'receiptS3Key', 'receiptFilename', 'status', 'approvedBy', 'reimbursedOn', 'note',
  ],
  // Anyone can submit their own expense claim, any day (POST). Only HR can
  // approve/reject it (at month end, in ExpenseHR.tsx) and only finance can
  // then mark an approved claim reimbursed (in FinancePortal.tsx) — a
  // manager no longer approves or reimburses claims (Team Expenses in
  // ManagerPortal.tsx is read-only) and neither does management/CEO.
  // Without this restriction, any signed-in employee could approve their own
  // claim by calling the API directly, regardless of what the UI shows them.
  updateRoles: ['hr', 'finance'],
  // Anyone can delete their OWN claim, but only while it's still 'Pending' —
  // once HR has approved/rejected it or finance has reimbursed it, deleting
  // it would silently break their records, so selfDeleteStatuses blocks that.
  selfDelete: true,
  selfDeleteStatuses: ['Pending'],
})

export const ticketsRouter = crudRouter({
  table: 'tickets',
  allowedColumns: [
    'employeeId', 'title', 'type', 'priority', 'status', 'description',
    'assignedTo', 'resolution', 'updatedAt',
  ],
  // Any employee can raise their own ticket (POST); only HR/management can
  // change its status, assign it, or resolve it (PATCH) — same
  // create-open/update-restricted split used for leave requests and expense
  // claims above, so an employee can't close or reassign their own (or
  // someone else's) ticket by calling the API directly.
  updateRoles: ['hr', 'management'],
})

export const exitRecordsRouter = crudRouter({
  table: 'exit_records',
  allowedColumns: [
    'employeeId', 'exitType', 'resignationDate', 'lastWorkingDay', 'noticePeriodDays',
    'status', 'exitInterviewDone', 'fnfAmount', 'fnfStatus', 'reason', 'rehireEligible',
    'clearanceChecklist',
  ],
  writeRoles: ['hr', 'management'],
})

export const jobRequisitionsRouter = crudRouter({
  table: 'job_requisitions',
  // job_requisitions.id is a client-supplied TEXT primary key (not a
  // BIGSERIAL like every other table here), so 'id' must be an allowed
  // column or every create would fail a NOT NULL constraint on it.
  allowedColumns: [
    'id', 'title', 'department', 'team', 'openings', 'location', 'employmentType',
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

// onboarding_candidates.id is a client-supplied TEXT primary key
// (OnboardingHR.tsx generates it as `ob-${Date.now()}`, same as job
// requisitions above). checklistDone/docItems are small JSONB columns
// holding the fixed-shape onboarding checklist and required-document
// checkboxes (see CHECKLIST/REQUIRED_DOCS in OnboardingHR.tsx) — same
// pattern as exit_records.clearanceChecklist, not a separate table, since
// neither list is something users add arbitrary new rows to.
export const onboardingCandidatesRouter = crudRouter({
  table: 'onboarding_candidates',
  allowedColumns: [
    'id', 'name', 'role', 'team', 'joiningDate', 'email', 'phone',
    'docStatus', 'onboardingProgress', 'checklistDone', 'docItems',
  ],
  writeRoles: ['hr', 'management'],
})

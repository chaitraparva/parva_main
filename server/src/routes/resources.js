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
  // Anyone can submit their own leave request (POST); only a manager/HR/
  // management can move it to approved/rejected (PATCH) — without this, any
  // signed-in employee could approve their own leave request by calling the
  // API directly, since no screen ever lets an employee PATCH their own row.
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
  // Only HR/manager/management ever mark attendance (see AttendanceHR.tsx —
  // no employee-facing screen creates or edits their own attendance row).
  writeRoles: ['manager', 'hr', 'management'],
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
})

export const expenseClaimsRouter = crudRouter({
  table: 'expense_claims',
  allowedColumns: [
    'employeeId', 'date', 'description', 'category', 'amount',
    'receiptS3Key', 'receiptFilename', 'status', 'approvedBy', 'reimbursedOn', 'note',
  ],
  // Anyone can submit their own expense claim (POST); only a manager (for
  // their own team, in ManagerPortal), HR, management or finance can
  // approve, reject or reimburse one (PATCH) — without this, any signed-in
  // employee could approve their own claim by calling the API directly,
  // regardless of what the UI shows them.
  updateRoles: ['manager', 'hr', 'management', 'finance'],
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

export const leadsRouter = crudRouter({
  table: 'leads',
  // leads.id is a client-supplied TEXT primary key (like job_requisitions
  // above, not a BIGSERIAL) — 'id' has to be an allowed column or every
  // create would fail a NOT NULL constraint on it.
  allowedColumns: [
    'id', 'name', 'phone', 'email', 'source', 'status', 'assignedTo', 'agentName',
    'budget', 'propertyType', 'location', 'followUpDate', 'notes', 'lastActivity',
  ],
})

// onboarding_candidates.id is a client-supplied TEXT primary key
// (OnboardingHR.tsx generates it as `ob-${Date.now()}`, same as job
// requisitions/leads above). checklistDone/docItems are small JSONB columns
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

// Thin wrapper around the real backend (server/) — every call here is a
// relative /api/... path, which works both in dev (vite.config.ts proxies
// /api to the local Express server) and in production (vercel.json routes
// /api/* to the same serverless function), so nothing here needs a
// configured base URL.
//
// The session (JWT) is kept in localStorage so a page reload doesn't drop
// the user back to the sign-in screen — see restoreSession() below, called
// once from App.tsx on mount.

import type { Employee, Role, LeaveRequest, PayrollRecord, AttendanceRecord, ExpenseClaim, EmployeeTicket, ExitRecord, JobRequisition, Candidate, PerformanceGoal, PerformanceReview, TimesheetEntry, Notification, Lead } from '../types'

const TOKEN_KEY = 'parva_auth_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Private-browsing/storage-blocked — session just won't survive a
    // reload; not fatal, the rest of the app still works for this visit.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to do if storage isn't available.
  }
}

// A minimal identity of who's signed in and which single portal role this
// session is acting as (see server/src/routes/auth.js's /me for why this is
// separate from the employee's full loginRoles list).
export interface Session {
  role: Role
  employee: Employee
}

class ApiError extends Error { }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : null

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status}).`)
  }
  return data as T
}

// The backend's employees table uses job_title as the column name (camelCased
// to jobTitle by the API) but the frontend's Employee type has always called
// that same concept `role`. This is the one place that translation happens.
function mapApiEmployee(raw: any): Employee {
  const { jobTitle, ...rest } = raw
  return { ...rest, role: jobTitle } as Employee
}

export async function login(role: Role, email: string, password: string): Promise<Session> {
  const data = await request<{ token: string; employee: any }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ role, email, password }),
  })
  setToken(data.token)
  // /login only returns a handful of fields (id, name, title, jobTitle,
  // loginRole(s)) — enough to sign the JWT, but the app needs the full
  // profile (email, phone, department, etc.), so fetch that separately now
  // that we're authenticated.
  const employee = await fetchEmployeeById(data.employee.id)
  return { role, employee }
}

// Restores a session from a previously-stored token (e.g. after a page
// reload) — returns null if there's no token, or it's expired/invalid, in
// which case the caller should fall back to showing the sign-in screen.
export async function restoreSession(): Promise<Session | null> {
  const token = getToken()
  if (!token) return null
  try {
    const data = await request<{ employee: any; loginRole: Role }>('/api/auth/me', { method: 'GET' })
    return { role: data.loginRole, employee: mapApiEmployee(data.employee) }
  } catch {
    clearToken()
    return null
  }
}

export async function fetchEmployees(): Promise<Employee[]> {
  const data = await request<{ employees: any[] }>('/api/employees', { method: 'GET' })
  return data.employees.map(mapApiEmployee)
}

export async function fetchEmployeeById(id: string): Promise<Employee> {
  const data = await request<{ employee: any }>(`/api/employees/${encodeURIComponent(id)}`, { method: 'GET' })
  return mapApiEmployee(data.employee)
}

// Self-service profile edit — name, phone, location, photo only (see
// server/src/routes/employees.js's SELF_EDITABLE_FIELDS; email and every
// HR-controlled field are deliberately not accepted there).
export async function updateMyProfile(fields: { name?: string; phone?: string; location?: string; photoUrl?: string }): Promise<Employee> {
  const data = await request<{ employee: any }>('/api/employees/me', {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
  return mapApiEmployee(data.employee)
}

// Requests a password-setup/reset email for the given email+role — the same
// generic response whether or not the account actually exists, so this
// can't be used to probe which emails are registered.
export async function requestPasswordReset(email: string, role: Role): Promise<void> {
  await request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

// Finishes a Supabase-hosted password reset (see Login.tsx and
// server/src/routes/auth.js's /sync-password) — accessToken here is the one
// Supabase put in the URL after the person clicked the emailed link, proving
// they control that email. Saves the new password into our own employees
// table (what /login actually checks) and returns just their name — no
// session token, since we deliberately don't know which of their roles they
// meant to sign in as; they pick that on the ordinary sign-in screen next.
export async function syncPasswordFromSupabase(accessToken: string, newPassword: string): Promise<{ name: string }> {
  return request('/api/auth/sync-password', {
    method: 'POST',
    body: JSON.stringify({ accessToken, newPassword }),
  })
}

// A few aggregate counts shown on the sign-in screen, before anyone's
// authenticated — no auth token needed (see server/src/routes/public.js).
export interface PublicStats {
  employees: number
  companies: number
  openTickets: number
  activeExits: number
}

export async function fetchPublicStats(): Promise<PublicStats> {
  return request<PublicStats>('/api/public/stats', { method: 'GET' })
}

// ─────────────────────── Leave requests ───────────────────────
// The backend's leave_requests table (server/src/routes/resources.js, a
// generic CRUD router) only stores employee_id — not the employee's name or
// department, which the frontend's LeaveRequest type wants for display.
// App.tsx fills those in from the already-loaded employee directory, so the
// raw shape here is LeaveRequest minus those two fields, plus whatever's
// left after that substitution stays the same. startDate/endDate/appliedOn
// come back from Postgres as full timestamps (DATE/TIMESTAMPTZ columns
// serialize through JSON as ISO strings) — App.tsx trims those to
// YYYY-MM-DD before use.
export type RawLeaveRequest = Omit<LeaveRequest, 'employeeName' | 'department'> & {
  decidedBy?: string | null
  decidedAt?: string | null
}

export async function fetchLeaveRequests(): Promise<RawLeaveRequest[]> {
  const data = await request<{ leave_requests: RawLeaveRequest[] }>('/api/leave-requests', { method: 'GET' })
  return data.leave_requests
}

export interface NewLeaveRequestInput {
  employeeId: string
  type: LeaveRequest['type']
  startDate: string
  endDate: string
  days: number
  reason: string
  submittedByRole: Role
  pendingWith: Role | 'done'
}

export async function createLeaveRequest(input: NewLeaveRequestInput): Promise<RawLeaveRequest> {
  const data = await request<{ leave_request: RawLeaveRequest }>('/api/leave-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.leave_request
}

export async function updateLeaveRequest(
  id: string,
  patch: Partial<Pick<RawLeaveRequest, 'status' | 'pendingWith' | 'decidedBy' | 'decidedAt'>>,
): Promise<RawLeaveRequest> {
  const data = await request<{ leave_request: RawLeaveRequest }>(`/api/leave-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.leave_request
}

// ─────────────────────── Payroll records ───────────────────────
// Same pattern as leave requests above: payroll_records only stores
// employee_id — not the employee's name or current job title, which the
// frontend's PayrollRecord type wants for display. App.tsx fills those in
// from the employee directory. period_start/period_end come back as full
// timestamps like every other DATE column; App.tsx trims those too.
//
// NOTE: periodStart/periodEnd/reimbursements/bonus/otherDeductions need
// server/sql/03_payroll_payslip_fields_migration.sql run once against the
// database — the original payroll_records table predates those fields.
export type RawPayrollRecord = Omit<PayrollRecord, 'employeeName' | 'role'>

export async function fetchPayrollRecords(): Promise<RawPayrollRecord[]> {
  const data = await request<{ payroll_records: RawPayrollRecord[] }>('/api/payroll-records', { method: 'GET' })
  return data.payroll_records
}

export async function createPayrollRecord(input: Omit<RawPayrollRecord, 'id'>): Promise<RawPayrollRecord> {
  const data = await request<{ payroll_record: RawPayrollRecord }>('/api/payroll-records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.payroll_record
}

export async function updatePayrollRecord(id: string, patch: Partial<Omit<RawPayrollRecord, 'id'>>): Promise<RawPayrollRecord> {
  const data = await request<{ payroll_record: RawPayrollRecord }>(`/api/payroll-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.payroll_record
}

// ─────────────────────── Attendance records ───────────────────────
// Same pattern again — attendance_records only stores employee_id, not the
// employee's name; App.tsx fills that in from the employee directory. The
// `date` column comes back as a full timestamp like every other DATE column
// (App.tsx trims it to YYYY-MM-DD).
export type RawAttendanceRecord = Omit<AttendanceRecord, 'employeeName'>

export async function fetchAttendanceRecords(): Promise<RawAttendanceRecord[]> {
  const data = await request<{ attendance_records: RawAttendanceRecord[] }>('/api/attendance-records', { method: 'GET' })
  return data.attendance_records
}

// ─────────────────────── Timesheet entries ───────────────────────
// Real backend storage for the CRM Timesheet feature (My Timesheet / Team
// Timesheet) — previously this lived only in the browser's localStorage
// (src/lib/timesheetStore.ts), including a hardcoded seed of one employee's
// real entries so the screen wasn't empty. Both are removed now that this
// hits Postgres like every other module. One row per employee per day (a
// UNIQUE constraint enforces it server-side) — App.tsx's onSaveTimesheetEntry
// decides whether a given date is a create or an update.
export type RawTimesheetEntry = TimesheetEntry

export async function fetchTimesheetEntries(): Promise<RawTimesheetEntry[]> {
  const data = await request<{ timesheet_entries: RawTimesheetEntry[] }>('/api/timesheet-entries', { method: 'GET' })
  return data.timesheet_entries
}

export async function createTimesheetEntry(input: Omit<RawTimesheetEntry, 'id'>): Promise<RawTimesheetEntry> {
  const data = await request<{ timesheet_entry: RawTimesheetEntry }>('/api/timesheet-entries', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.timesheet_entry
}

export async function updateTimesheetEntry(id: string, patch: Partial<Omit<RawTimesheetEntry, 'id'>>): Promise<RawTimesheetEntry> {
  const data = await request<{ timesheet_entry: RawTimesheetEntry }>(`/api/timesheet-entries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.timesheet_entry
}

export async function createAttendanceRecord(input: Omit<RawAttendanceRecord, 'id'>): Promise<RawAttendanceRecord> {
  const data = await request<{ attendance_record: RawAttendanceRecord }>('/api/attendance-records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.attendance_record
}

export async function updateAttendanceRecord(id: string, patch: Partial<Omit<RawAttendanceRecord, 'id'>>): Promise<RawAttendanceRecord> {
  const data = await request<{ attendance_record: RawAttendanceRecord }>(`/api/attendance-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.attendance_record
}

// ─────────────────────── Expense claims ───────────────────────
// Same pattern again — expense_claims stores employee_id, not the
// employee's name/department. The receipt photo itself is NOT a plain
// column — it lives in Supabase Storage, uploaded/fetched through the
// separate expense-receipts endpoints below (uploadExpenseReceipt /
// fetchExpenseReceiptDownloadUrl); this type only carries the resulting
// receipt_s3_key/receipt_filename pointer, not the image data.
// claimed_on is server-set (DB default now()) and isn't in allowedColumns,
// so it's read-only here — never sent on create/update. Note the column is
// receipt_filename (camelCased receiptFilename) — the frontend's
// ExpenseClaim type spells the same concept receiptFileName (capital N);
// App.tsx's expenseFieldsOf() translates between the two explicitly.
export type RawExpenseClaim = Omit<ExpenseClaim, 'employeeName' | 'department' | 'receipt' | 'receiptDataUrl' | 'receiptFileName'> & {
  receiptFilename?: string | null
}

export async function fetchExpenseClaims(): Promise<RawExpenseClaim[]> {
  const data = await request<{ expense_claims: RawExpenseClaim[] }>('/api/expense-claims', { method: 'GET' })
  return data.expense_claims
}

export async function createExpenseClaim(input: Omit<RawExpenseClaim, 'id' | 'claimedOn'>): Promise<RawExpenseClaim> {
  const data = await request<{ expense_claim: RawExpenseClaim }>('/api/expense-claims', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.expense_claim
}

export async function updateExpenseClaim(id: string, patch: Partial<Omit<RawExpenseClaim, 'id' | 'claimedOn'>>): Promise<RawExpenseClaim> {
  const data = await request<{ expense_claim: RawExpenseClaim }>(`/api/expense-claims/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.expense_claim
}

// ---- Expense receipt photos (real backend storage — Supabase Storage) ----
// Reads a File as base64 (stripping the "data:...;base64," prefix) so it can
// travel as plain JSON to the backend, which does the actual Storage write —
// avoids needing a Supabase anon key on the frontend.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

export async function uploadExpenseReceipt(claimId: string, file: File): Promise<{ receiptS3Key: string; receiptFilename: string }> {
  const dataBase64 = await fileToBase64(file)
  return request<{ receiptS3Key: string; receiptFilename: string }>(`/api/expense-receipts/${encodeURIComponent(claimId)}`, {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
  })
}

// Pass downloadFilename to get a link that forces a browser download with
// that filename (via Supabase Storage's own `download` signed-URL option)
// instead of one meant just for inline viewing.
export async function fetchExpenseReceiptDownloadUrl(claimId: string, downloadFilename?: string): Promise<string> {
  const query = downloadFilename ? `?download=${encodeURIComponent(downloadFilename)}` : ''
  const data = await request<{ downloadUrl: string }>(`/api/expense-receipts/${encodeURIComponent(claimId)}/download-url${query}`, {
    method: 'GET',
  })
  return data.downloadUrl
}

// ─────────────────────── Employee tickets ───────────────────────
// Same pattern again — tickets stores employee_id, not the employee's
// name/department. Comments are NOT a column here at all — they live in
// their own table (ticket_comments), fetched/created through the separate
// functions below, not through this type. raisedOn/updatedAt are server-set
// (DB defaults) on create; updatedAt is refreshed explicitly on every PATCH
// (see App.tsx's onTicketsUpdate) since there's no database trigger for it.
export type RawEmployeeTicket = Omit<EmployeeTicket, 'employeeName' | 'department' | 'comments'>

export async function fetchTickets(): Promise<RawEmployeeTicket[]> {
  const data = await request<{ tickets: RawEmployeeTicket[] }>('/api/tickets', { method: 'GET' })
  return data.tickets
}

export async function createTicket(input: Omit<RawEmployeeTicket, 'id' | 'raisedOn' | 'updatedAt'>): Promise<RawEmployeeTicket> {
  const data = await request<{ ticket: RawEmployeeTicket }>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.ticket
}

export async function updateTicket(id: string, patch: Partial<Omit<RawEmployeeTicket, 'id' | 'raisedOn'>>): Promise<RawEmployeeTicket> {
  const data = await request<{ ticket: RawEmployeeTicket }>(`/api/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.ticket
}

// A ticket's replies — one row per comment, fetched all at once (every
// comment the signed-in user is allowed to see) rather than per-ticket, so
// they can be grouped client-side by ticketId the same way every other
// resource here is fetched once per session and derived from.
export interface RawTicketComment {
  id: string
  ticketId: string
  byName: string
  byRole: 'hr' | 'employee'
  body: string
  createdAt: string
}

export async function fetchTicketComments(): Promise<RawTicketComment[]> {
  const data = await request<{ ticket_comments: RawTicketComment[] }>('/api/ticket-comments', { method: 'GET' })
  return data.ticket_comments
}

export async function createTicketComment(ticketId: string, body: string): Promise<RawTicketComment> {
  const data = await request<{ ticket_comment: RawTicketComment }>('/api/ticket-comments', {
    method: 'POST',
    body: JSON.stringify({ ticketId, body }),
  })
  return data.ticket_comment
}

// ─────────────────────── Exit records ───────────────────────
// Same pattern again — exit_records stores employee_id, not the employee's
// name/department/role. clearanceChecklist IS a real column now (JSONB) —
// unlike ticket comments, it's a small fixed-shape list per record that
// only ever gets its items toggled, not added to independently, so it
// didn't need a separate table.
export type RawExitRecord = Omit<ExitRecord, 'employeeName' | 'department' | 'role'>

export async function fetchExitRecords(): Promise<RawExitRecord[]> {
  const data = await request<{ exit_records: RawExitRecord[] }>('/api/exit-records', { method: 'GET' })
  return data.exit_records
}

export async function createExitRecord(input: Omit<RawExitRecord, 'id'>): Promise<RawExitRecord> {
  const data = await request<{ exit_record: RawExitRecord }>('/api/exit-records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.exit_record
}

export async function updateExitRecord(id: string, patch: Partial<Omit<RawExitRecord, 'id'>>): Promise<RawExitRecord> {
  const data = await request<{ exit_record: RawExitRecord }>(`/api/exit-records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.exit_record
}

// ─────────────────────── Job requisitions & candidates ───────────────────────
// job_requisitions.id is a client-supplied TEXT primary key (unlike every
// other table above, which is server-assigned BIGSERIAL) — createJobRequisition
// must send an id, and the frontend generates it (App.tsx). `applicants` is
// NOT a database column at all — it's a live count of candidates whose
// requisitionId matches, computed in App.tsx from the candidates list, so
// it's excluded here.
export type RawJobRequisition = Omit<JobRequisition, 'applicants'>

export async function fetchJobRequisitions(): Promise<RawJobRequisition[]> {
  const data = await request<{ job_requisitions: RawJobRequisition[] }>('/api/job-requisitions', { method: 'GET' })
  return data.job_requisitions
}

export async function createJobRequisition(input: RawJobRequisition): Promise<RawJobRequisition> {
  const data = await request<{ job_requisition: RawJobRequisition }>('/api/job-requisitions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.job_requisition
}

export async function updateJobRequisition(id: string, patch: Partial<Omit<RawJobRequisition, 'id'>>): Promise<RawJobRequisition> {
  const data = await request<{ job_requisition: RawJobRequisition }>(`/api/job-requisitions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.job_requisition
}

// Candidates are read-only from the frontend today (Recruitment.tsx never
// creates or edits one) — only a fetch function here, matching that.
export async function fetchCandidates(): Promise<Candidate[]> {
  const data = await request<{ candidates: Candidate[] }>('/api/candidates', { method: 'GET' })
  return data.candidates
}

// ─────────────────────── Performance goals & reviews ───────────────────────
// Performance.tsx (the only screen that reads these) has no create/edit UI
// at all for either goals or reviews — it's a pure dashboard/table view —
// so like candidates above, only fetch functions are needed here.
export type RawPerformanceGoal = Omit<PerformanceGoal, 'employeeName'>

export async function fetchPerformanceGoals(): Promise<RawPerformanceGoal[]> {
  const data = await request<{ performance_goals: RawPerformanceGoal[] }>('/api/performance-goals', { method: 'GET' })
  return data.performance_goals
}

export type RawPerformanceReview = Omit<PerformanceReview, 'employeeName' | 'role' | 'department'>

export async function fetchPerformanceReviews(): Promise<RawPerformanceReview[]> {
  const data = await request<{ performance_reviews: RawPerformanceReview[] }>('/api/performance-reviews', { method: 'GET' })
  return data.performance_reviews
}

// ─────────────────────── Notifications ───────────────────────
// notifications.employee_id is NOT NULL — every notification belongs to one
// employee — but the frontend's Notification type never had an employeeId
// field at all (it was mock-only data, so nothing needed to scope it). It's
// added there now so this can filter to "my own notifications" like a real
// per-employee inbox. created_at (DB, server-set) is spelled `timestamp` on
// the frontend type — a naming translation like receiptFilename/
// receiptFileName elsewhere in this file. Nothing in the app creates a
// notification yet (no screen has a "new notification" flow) — only
// mark-as-read exists — so there's no create function here, just fetch/update.
export type RawNotification = Omit<Notification, 'timestamp'> & { createdAt: string }

export async function fetchNotifications(): Promise<RawNotification[]> {
  const data = await request<{ notifications: RawNotification[] }>('/api/notifications', { method: 'GET' })
  return data.notifications
}

export async function updateNotification(id: string, patch: Partial<Pick<RawNotification, 'read'>>): Promise<RawNotification> {
  const data = await request<{ notification: RawNotification }>(`/api/notifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.notification
}

// ─────────────────────── Leads (CRM) ───────────────────────
// leads.id is a client-supplied TEXT primary key (like job_requisitions,
// not a BIGSERIAL) — createLead has to send an id, and the frontend
// generates it. A lead's activity log (calls, emails, notes, site visits,
// WhatsApp) lives in its own table (lead_activities), not a column on
// leads — the same relational-list pattern used for ticket comments. The
// server derives who logged an activity from the signed-in session, never
// from the request body.
export type RawLead = Omit<Lead, 'activities'>

export async function fetchLeads(): Promise<RawLead[]> {
  const data = await request<{ leads: RawLead[] }>('/api/leads', { method: 'GET' })
  return data.leads
}

export async function createLead(input: RawLead): Promise<RawLead> {
  const data = await request<{ lead: RawLead }>('/api/leads', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.lead
}

export async function updateLead(id: string, patch: Partial<Omit<RawLead, 'id'>>): Promise<RawLead> {
  const data = await request<{ lead: RawLead }>(`/api/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.lead
}

export interface RawLeadActivity {
  id: string
  leadId: string
  type: 'call' | 'email' | 'note' | 'site-visit' | 'whatsapp'
  description: string
  byName: string
  createdAt: string
}

export async function fetchLeadActivities(): Promise<RawLeadActivity[]> {
  const data = await request<{ lead_activities: RawLeadActivity[] }>('/api/lead-activities', { method: 'GET' })
  return data.lead_activities
}

export async function createLeadActivity(leadId: string, type: RawLeadActivity['type'], description: string): Promise<RawLeadActivity> {
  const data = await request<{ lead_activity: RawLeadActivity }>('/api/lead-activities', {
    method: 'POST',
    body: JSON.stringify({ leadId, type, description }),
  })
  return data.lead_activity
}

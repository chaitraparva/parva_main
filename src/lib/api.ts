// Thin wrapper around the real backend (server/) — every call here is a
// relative /api/... path, which works both in dev (vite.config.ts proxies
// /api to the local Express server) and in production (vercel.json routes
// /api/* to the same serverless function), so nothing here needs a
// configured base URL.
//
// The session (JWT) is kept in localStorage so a page reload doesn't drop
// the user back to the sign-in screen — see restoreSession() below, called
// once from App.tsx on mount.

import type { Employee, Role, LeaveRequest, PayrollRecord, AttendanceRecord, ExpenseClaim } from '../types'

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
// employee's name/department. It also has no column at all for the actual
// receipt IMAGE (receiptDataUrl): the schema only keeps receipt_s3_key/
// receipt_filename, meant for a real file-storage upload (S3/Supabase
// Storage) that hasn't been built yet — so a receipt photo is visible only
// for the current session and is lost on refresh until that's added.
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

// Thin wrapper around the real backend (server/) — every call here is a
// relative /api/... path, which works both in dev (vite.config.ts proxies
// /api to the local Express server) and in production (vercel.json routes
// /api/* to the same serverless function), so nothing here needs a
// configured base URL.
//
// The session (JWT) is kept in localStorage so a page reload doesn't drop
// the user back to the sign-in screen — see restoreSession() below, called
// once from App.tsx on mount.

import type { Employee, Role } from '../types'

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
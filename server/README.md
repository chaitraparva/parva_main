# Parva Realty CRM — backend API

A real Express + PostgreSQL backend for the app, replacing the frontend's
in-memory demo data (`src/data/mockData.ts`). Tested locally end-to-end
against a real Postgres database before being handed off — see
"What's been verified" below.

Deploys as part of the same Vercel project as the frontend (see
`/api/index.js` and `/vercel.json` at the repo root) — you do not need a
separate backend host. Postgres and file storage are both provided by
Supabase, so there's no separate database or storage host either.

## What this is (and isn't) yet

Built so far: real authentication (bcrypt-hashed passwords, JWT sessions,
rate-limited login), the employee directory, and a full CRUD API for every
other module (leave, payroll, attendance, expenses, tickets, exits,
recruitment, performance, flags, notifications, leads) backed by a
matching Postgres schema. Employee documents/payslips go through Supabase
Storage with signed URLs — files never pass through this server, and links
expire in minutes.

Not built yet: the approval-workflow business rules for those CRUD
resources (e.g. exactly who can move a leave request from
"pending-manager" to "approved", or disburse a payroll run) — those need
real endpoints layered on top of the generic CRUD routes, and the React
frontend still needs to be pointed at this API instead of `mockData.ts`
(it currently still saves passwords to the browser's localStorage — see
"Known limitations" below). Both are the next pieces of work.

## One-time setup

1. **Create a Supabase project** at supabase.com if you haven't already,
   then in its dashboard:
   - **Settings → Database**: copy the "Transaction pooler" connection
     string (port 6543) — this is your `DATABASE_URL`.
   - **Settings → API**: copy the Project URL (`SUPABASE_URL`) and the
     `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY` — keep this
     out of the frontend entirely).
   - **Storage tab**: create a new bucket named `employee-documents` and
     mark it **Private** (not public).

2. **Apply the schema**:
   ```
   psql "$DATABASE_URL" -f schema.sql
   ```
   (or `npm run migrate` once `DATABASE_URL` is set in your environment)

3. **Seed the employee roster.** `employees.seed.json` is the source list —
   currently empty (the placeholder roster from `mockData.ts` was wiped so
   the real one can be entered directly, once it's finalized). Each entry
   needs a `loginRoles` array (e.g. `["hr", "manager"]`) naming exactly
   which portal(s) that person may sign in to — set explicitly per person,
   not derived from job title, so someone can hold more than one role. Once
   the file is filled in:
   ```
   npm run seed
   ```
   Every employee's initial password is set to `SEED_DEMO_PASSWORD` (bcrypt-
   hashed before storage — plain text is never kept). Change that env var
   before seeding a real production database.

4. **Set environment variables.** Copy `.env.example` to `.env` for local
   development; in production, set these in Vercel's dashboard (Project →
   Settings → Environment Variables) — never commit a `.env` file. See
   `.env.example` for the full list and what each one is for
   (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, the `SUPABASE_*`
   variables, `SEED_DEMO_PASSWORD`).

5. **Run it locally:**
   ```
   npm install
   npm start        # or `npm run dev` for auto-restart on file changes
   ```
   In production it isn't run directly — Vercel imports the same
   `src/index.js` app through `/api/index.js` and calls it per-request as a
   serverless function. The same environment variables above must also be
   set in Vercel's dashboard for that to work (a local `.env` file never
   reaches Vercel).

## What's been verified

Run locally against a real Postgres 16 instance (not mocked):

- Schema applies cleanly (`schema.sql`); seed loads all real employees.
- Login: correct email+password succeeds; wrong password, and an email
  that doesn't match the selected role's eligibility, are both rejected
  with the same generic error (no information leak about which part was
  wrong). Specifically verified: Finance Manager only accepts Ravishankar
  (not Yatheesh SP, who has the same job title); Line Manager rejects
  Thejavathi J N — the exact same eligibility rules the old frontend-only
  picker enforced, now enforced server-side instead.
- `/api/auth/me` restores a session from a token without re-sending
  credentials, and never returns the password hash.
- `POST /api/auth/set-password` — the piece that was missing until now:
  `verify-reset-token` only ever confirmed a link was genuine, it never
  actually saved a new password anywhere. `set-password` does, for both
  "first time, choose your password" and "forgot password" (same
  endpoint — both are just "prove you control the registered email, then
  set a password"). Verified end-to-end: an employee with no password
  yet can't log in until they use a signed reset token to set one; once
  set, login with the new password succeeds and the wrong password is
  still rejected; a password under 6 characters is rejected; a tampered
  or bogus token is rejected; the endpoint signs the employee straight
  in on success, matching what `/login` returns.
- **Multiple login roles per person** (`employees.login_roles`, a Postgres
  `TEXT[]` rather than a single value) — so one person can be eligible for
  more than one portal, e.g. someone who is both HR and a Line Manager.
  Set explicitly per person in `employees.seed.json` (a `loginRoles` array
  field), not derived from job title. Verified end-to-end: a person with
  `loginRoles: ["hr", "manager"]` can log in as either role with the same
  password and is rejected for any role not in that list; each session's
  JWT is scoped to the one role they picked at login, not their full set of
  eligible roles; `set-password` adds a role to the array if it's missing
  there instead of overwriting the others (checked deliberately by starting
  from a database array missing one of the person's two roles and
  confirming it's correctly restored, not clobbered); a reset token forged
  for a role the person isn't eligible for is rejected even though the
  token itself is validly signed, because eligibility is re-checked against
  the roster on every use, not just when the token was first issued.
- `PATCH /api/employees/me` — self-service profile editing: a signed-in
  employee can update their own name, phone, location and photo. A short
  allow-list, not "everything except email" — HR-controlled fields
  (job_title, login_roles, manager_id, base_salary, status, department,
  team, company, join_date) are deliberately excluded even though the
  employee owns the row, since editing your own salary, manager or portal
  access is a real security hole, not just a UX one. `email` is excluded on
  purpose — it's the registered login identifier, changeable only by HR.
  Verified end-to-end: allowed fields update correctly; `email`,
  `baseSalary`, `loginRoles` and `managerId` in the request body are
  silently ignored rather than applied (login with the original email still
  works afterward, with the updated name); a request with only
  ignored/unknown fields is rejected with 400; the endpoint always acts on
  the caller's own id from their token, never one from the request, so
  there's no way to target another employee's record; missing auth is
  rejected with 401. The frontend's Profile screen was updated to match —
  the email field there is now read-only too.
- Every route requires a valid JWT (401 without one); write-restricted
  resources (e.g. payroll records) correctly reject a signed-in user whose
  login role isn't allowed to write, while still letting them read.
- Login is rate-limited (10 attempts / 15 minutes / IP) — verified it
  actually returns 429 once exceeded.
- API responses are camelCase and numeric columns (salaries, amounts,
  ratings) come back as real JSON numbers, not strings — matches the
  frontend's existing TypeScript types exactly.

**Not yet verified against the live Vercel + Supabase deployment** (only
against a local Postgres instance) — the Express-as-a-serverless-function
wiring and the Supabase Storage upload/download flow should be
re-confirmed with real requests once real credentials exist. See "Known
limitations" below.

## Security choices worth knowing about

- Passwords are bcrypt-hashed (cost factor 12) — never stored or logged in
  plain text.
- The login endpoint compares against a dummy hash even when no employee
  matches, so response timing doesn't leak whether an email is registered.
- CORS only accepts requests from `FRONTEND_ORIGIN` — set this to your
  exact Vercel URL (or custom domain) in production, not `*`.
- Storage documents are private; the API only ever hands out short-lived
  signed upload/download links (5 and 2 minutes respectively), never a
  permanent public link. The Supabase `service_role` key that can create
  those links is only ever used server-side.
- `helmet` sets standard security headers; a general rate limit (120
  req/min/IP) applies on top of the stricter login-specific one.

## Known limitations of the Vercel serverless setup

- **Login rate-limiting resets more often than on a normal server.** The
  10-attempts/15-minutes counter lives in this process's memory, and a
  serverless function's memory doesn't reliably persist between requests
  the way a normal always-on server's would. It still blocks rapid
  back-to-back attempts within the same warm instance, but a determined
  attacker spread out over time isn't fully stopped by this alone. Not a
  priority at your current scale, but if it matters later, swap in a
  Redis-backed limiter (e.g. Upstash, which has a free tier) instead.
- **Database connection pooling is intentionally tiny** (`max: 1` — see
  `src/db.js`) because serverless functions can run many instances at
  once, each with its own pool. This is why the setup step above uses
  Supabase's "Transaction pooler" connection string rather than the direct
  one — using the direct connection here would risk exhausting Postgres's
  connection limit under real traffic.
- Both `package.json` (repo root) and `server/package.json` list the same
  backend dependencies (express, pg, bcryptjs, etc.) — this is
  intentional, not a mistake. Vercel builds the `/api` function from the
  repo root's `node_modules`, while `server/` also works as a standalone
  local project for development. Keep both in sync if you add a backend
  dependency.

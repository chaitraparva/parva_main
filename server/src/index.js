import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'

import authRouter from './routes/auth.js'
import publicRouter from './routes/public.js'
import adminRouter from './routes/admin.js'
import employeesRouter from './routes/employees.js'
import documentsRouter from './routes/documents.js'
import expenseReceiptsRouter from './routes/expense-receipts.js'
import profilePhotoRouter from './routes/profile-photo.js'
import ticketCommentsRouter from './routes/ticket-comments.js'
import {
  leaveRequestsRouter,
  payrollRecordsRouter,
  attendanceRouter,
  timesheetEntriesRouter,
  expenseClaimsRouter,
  ticketsRouter,
  exitRecordsRouter,
  jobRequisitionsRouter,
  candidatesRouter,
  performanceGoalsRouter,
  performanceReviewsRouter,
  flagsRouter,
  notificationsRouter,
  onboardingCandidatesRouter,
} from './routes/resources.js'
import { attendanceClockRouter } from './routes/attendance-clock.js'

const app = express()

// Vercel puts every request through its own proxy, which sets
// X-Forwarded-For to the real client IP. Without telling Express to trust
// that header, express-rate-limit can't safely determine each caller's IP
// (and logs a validation warning) — trusting exactly one hop is the
// correct, safe setting for this deployment shape (Vercel's edge is the
// only proxy in front of this function).
app.set('trust proxy', 1)

app.use(helmet())
// Expense receipt photos travel in as base64 JSON, which inflates their
// size by ~33% — 1mb was fine for plain records but is too small for a
// phone photo, so the whole API's JSON limit is raised to accommodate it.
app.use(express.json({ limit: '8mb' }))

// Only the deployed frontend's exact origin may call this API — set
// FRONTEND_ORIGIN to your Vercel URL (or custom domain) in production.
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin, credentials: false }))

// General API rate limit, on top of the stricter one on /api/auth/login.
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/public', publicRouter)
app.use('/api/admin', adminRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/expense-receipts', expenseReceiptsRouter)
app.use('/api/profile-photo', profilePhotoRouter)
app.use('/api/leave-requests', leaveRequestsRouter)
app.use('/api/payroll-records', payrollRecordsRouter)
// Must be registered BEFORE the generic /:id routes below it.
app.use('/api/attendance-records', attendanceClockRouter)
app.use('/api/attendance-records', attendanceRouter)
app.use('/api/timesheet-entries', timesheetEntriesRouter)
app.use('/api/expense-claims', expenseClaimsRouter)
app.use('/api/tickets', ticketsRouter)
app.use('/api/ticket-comments', ticketCommentsRouter)
app.use('/api/exit-records', exitRecordsRouter)
app.use('/api/job-requisitions', jobRequisitionsRouter)
app.use('/api/candidates', candidatesRouter)
app.use('/api/performance-goals', performanceGoalsRouter)
app.use('/api/performance-reviews', performanceReviewsRouter)
app.use('/api/flags', flagsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/onboarding-candidates', onboardingCandidatesRouter)

// Centralized error handler — keeps stack traces out of API responses.
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on our end.' })
})

// On Vercel this file is imported by /api/index.js and Vercel itself
// handles invoking the app per-request — it must NOT also call
// app.listen(), or the serverless function fails to start. Locally (and on
// any host that runs this file directly, e.g. `npm start`), VERCEL is
// unset, so it listens on a real port as before.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 4000
  app.listen(port, () => {
    console.log(`Parva Realty CRM API listening on port ${port}`)
  })
}

export default app

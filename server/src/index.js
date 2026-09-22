import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'

import authRouter from './routes/auth.js'
import employeesRouter from './routes/employees.js'
import documentsRouter from './routes/documents.js'
import {
  leaveRequestsRouter,
  payrollRecordsRouter,
  attendanceRouter,
  expenseClaimsRouter,
  ticketsRouter,
  exitRecordsRouter,
  jobRequisitionsRouter,
  candidatesRouter,
  performanceGoalsRouter,
  performanceReviewsRouter,
  flagsRouter,
  notificationsRouter,
  leadsRouter,
} from './routes/resources.js'

const app = express()

app.use(helmet())
app.use(express.json({ limit: '1mb' }))

// Only the deployed frontend's exact origin may call this API — set
// FRONTEND_ORIGIN to your Vercel URL (or custom domain) in production.
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin, credentials: false }))

// General API rate limit, on top of the stricter one on /api/auth/login.
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/leave-requests', leaveRequestsRouter)
app.use('/api/payroll-records', payrollRecordsRouter)
app.use('/api/attendance-records', attendanceRouter)
app.use('/api/expense-claims', expenseClaimsRouter)
app.use('/api/tickets', ticketsRouter)
app.use('/api/exit-records', exitRecordsRouter)
app.use('/api/job-requisitions', jobRequisitionsRouter)
app.use('/api/candidates', candidatesRouter)
app.use('/api/performance-goals', performanceGoalsRouter)
app.use('/api/performance-reviews', performanceReviewsRouter)
app.use('/api/flags', flagsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/leads', leadsRouter)

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

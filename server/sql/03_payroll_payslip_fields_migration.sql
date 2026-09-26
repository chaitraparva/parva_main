-- Run this once in Supabase's SQL editor before using the Payroll module.
--
-- PayrollHR's "Generate Payslip" flow (src/screens/hr/PayrollHR.tsx) computes
-- a real payslip cycle window and a few discretionary amounts per cycle
-- (see src/types.ts's PayrollRecord: periodStart, periodEnd, reimbursements,
-- bonus, otherDeductions) — but the payroll_records table was never given
-- columns for them. Without this, generating or updating a payslip fails.
-- Safe to run more than once (IF NOT EXISTS).

ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS period_start     DATE,
  ADD COLUMN IF NOT EXISTS period_end       DATE,
  ADD COLUMN IF NOT EXISTS reimbursements   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0;

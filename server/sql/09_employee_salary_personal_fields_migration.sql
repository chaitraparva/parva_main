-- Run this once in Supabase's SQL editor before using the Directory
-- screen's "Salary & Personal Details" editor (src/components/
-- SalaryStructureEditor.tsx).
--
-- That editor has always had these fields in the frontend's Employee type
-- (src/types.ts) and feeds them straight into payslip generation (src/lib/
-- payslip.ts, PayslipDocument.tsx) -- but the employees table was never
-- given columns for them, and there was no backend route to receive any of
-- them either. "Save" showed a false success and the values only ever
-- lived in the browser tab's memory -- gone on the next refresh, and every
-- payslip generated so far has HRA/allowances defaulting to 0 and
-- DOB/Gender/Aadhar/PAN blank. Safe to run more than once (IF NOT EXISTS).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hra                  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conveyance_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_allowance    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dob                  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aadhar_number        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pan_number           TEXT NOT NULL DEFAULT '';

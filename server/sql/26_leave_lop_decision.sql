-- Lets HR choose, when a leave is rejected, whether the days are loss of pay (LOP).
-- Run once in the Supabase SQL Editor. Safe to run twice.
--   lop     = rejected, and those days are deducted in the payslip
--   no-lop  = just rejected, nothing is deducted
--   (empty) = not decided yet

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS lop_decision TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_lop_decision_check') THEN
    ALTER TABLE leave_requests
      ADD CONSTRAINT leave_requests_lop_decision_check CHECK (lop_decision IN ('lop', 'no-lop'));
  END IF;
END $$;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'leave_requests' AND column_name = 'lop_decision';

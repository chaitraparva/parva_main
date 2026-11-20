-- Line Manager can REJECT a payroll record with a remark (HR then sees the
-- remark, fixes it and sends it back to the manager).
-- Run once in the Supabase SQL Editor. Safe to run twice.

-- 1) a place to store the remark
ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS rejection_remark TEXT NOT NULL DEFAULT '';

-- 2) allow the new status 'rejected' (drop the old status check, whatever it is called)
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'payroll_records'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE payroll_records DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE payroll_records
  ADD CONSTRAINT payroll_records_status_check
  CHECK (status IN ('pending-manager', 'pending-hr', 'pending-management', 'disbursed', 'rejected'));

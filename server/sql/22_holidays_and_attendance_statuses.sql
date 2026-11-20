-- Holiday / Week-off attendance statuses + Annual Holiday List per branch.
-- Run once in the Supabase SQL Editor. Safe to run twice.

-- 1) Attendance can now be marked 'holiday' or 'week-off' (not just present/absent/late/half-day).
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'attendance_records'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE attendance_records DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_status_check
  CHECK (status IN ('present', 'absent', 'late', 'half-day', 'holiday', 'week-off'));

-- 2) The Annual Holiday List: one row per branch per holiday date.
CREATE TABLE IF NOT EXISTS holidays (
  id          BIGSERIAL PRIMARY KEY,
  branch      TEXT NOT NULL,
  date        DATE NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch, date)
);

-- 3) Optional file (PDF / image) of a branch's holiday list, uploaded by HR.
CREATE TABLE IF NOT EXISTS holiday_list_files (
  id            BIGSERIAL PRIMARY KEY,
  branch        TEXT NOT NULL,
  year          INTEGER NOT NULL,
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  uploaded_by   TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

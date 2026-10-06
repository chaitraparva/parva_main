-- Run this once in Supabase's SQL editor before using the new Login / Logout /
-- Work From Home buttons and the Half Day leave option.
--
--   * attendance_records.work_mode : 'office' (default) or 'wfh' -- set by
--     which button the employee pressed (Login vs Work From Home).
--   * leave_requests.half_day      : true when the request is for half a day
--     (the existing `days` column already allows 0.5).
--
-- Safe to run more than once (IF NOT EXISTS).

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS work_mode TEXT NOT NULL DEFAULT 'office'
    CHECK (work_mode IN ('office', 'wfh'));

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS half_day BOOLEAN NOT NULL DEFAULT false;

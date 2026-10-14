-- Run this once in Supabase's SQL editor before connecting the office
-- biometric device (see office-bridge/README-setup.txt).
--
--   * employees.biometric_id : the number the eSSL device / eTimeTrack
--     software uses for this person (its "Employee Code"). Matched to the
--     portal account so a face/fingerprint punch lands on the right person.
--   * biometric_punches      : every raw punch received (kept as evidence;
--     duplicates are ignored, so re-sending the same punches is harmless).
--
-- Safe to run more than once.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS biometric_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_biometric_id
  ON employees (biometric_id) WHERE biometric_id IS NOT NULL AND biometric_id <> '';

CREATE TABLE IF NOT EXISTS biometric_punches (
  id           BIGSERIAL PRIMARY KEY,
  biometric_id TEXT NOT NULL,
  employee_id  TEXT REFERENCES employees(id),
  punched_at   TIMESTAMP NOT NULL,          -- office wall-clock time, no time zone
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (biometric_id, punched_at)
);

CREATE INDEX IF NOT EXISTS idx_biometric_punches_employee_time
  ON biometric_punches (employee_id, punched_at);

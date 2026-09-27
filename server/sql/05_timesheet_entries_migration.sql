-- Run this once in the Supabase SQL editor to add real backend storage for
-- the CRM Timesheet feature (My Timesheet / Team Timesheet), which until now
-- only lived in each browser's localStorage (see src/lib/timesheetStore.ts)
-- and included a hardcoded seed of one employee's real September entries so
-- the screen wasn't empty on first load. That seed is removed from the code
-- in this same change — after this migration, timesheet entries are real
-- rows in Postgres, shared across every device/browser, and nothing is
-- pre-filled.

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id                       BIGSERIAL PRIMARY KEY,
  employee_id              TEXT NOT NULL REFERENCES employees(id),
  date                     DATE NOT NULL,
  shift_start              TEXT NOT NULL DEFAULT '',
  shift_end                TEXT NOT NULL DEFAULT '',
  total_hours              NUMERIC(4, 2) NOT NULL DEFAULT 0,
  leads_assigned           INTEGER NOT NULL DEFAULT 0,
  calls_made               INTEGER NOT NULL DEFAULT 0,
  connected_calls          INTEGER NOT NULL DEFAULT 0,
  follow_ups_scheduled     INTEGER NOT NULL DEFAULT 0,
  client_appointments_set  INTEGER NOT NULL DEFAULT 0,
  sales_closed             INTEGER NOT NULL DEFAULT 0,
  company_funded_leads     BOOLEAN NOT NULL DEFAULT false,
  self_funded_leads        BOOLEAN NOT NULL DEFAULT false,
  tasks                    TEXT NOT NULL DEFAULT '',
  logged_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_timesheet_entries_employee_id ON timesheet_entries(employee_id);

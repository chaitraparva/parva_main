-- Run this FIRST, before 02_seed_roster.sql.
--
-- Your live employees table was created with a single login_role column
-- (one portal per person). Some people need more than one (Satish Kumar D
-- needs both HR and Manager), so this changes it to login_roles, a list.
-- Your table is still empty, so this is a safe, no-data-loss change.

ALTER TABLE employees DROP COLUMN IF EXISTS login_role;

ALTER TABLE employees
  ADD COLUMN login_roles TEXT[] NOT NULL DEFAULT '{}'
  CHECK (login_roles <@ ARRAY['crm', 'manager', 'hr', 'management', 'finance']);

DROP INDEX IF EXISTS idx_employees_login_role;
CREATE INDEX idx_employees_login_roles ON employees USING GIN (login_roles);

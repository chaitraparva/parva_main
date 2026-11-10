-- Adds / updates the 7 people from the "Employee Data" Google Sheet.
-- Run ONCE in the Supabase SQL Editor (paste everything, press Run).
-- Salary is intentionally NOT touched. Safe to run twice (it skips what is done).
--
-- What it does
--   1. Ajoy Rameshan, Ankita Nair, Anjana: switched to their new sheet IDs
--      (PAU230051 / 52 / 53). EVERYTHING linked to the old ID (attendance,
--      leave, expenses, payroll, leads, tickets, documents, manager links...)
--      is moved across automatically. Their details are refreshed from the sheet.
--   2. Nur Uddin, Sumitra Kandel, Shahab Ud Din, Mitterpreet Singh: added as new.
--   3. Logins (sign in with the work email; starting password is Welcome@123,
--      stored only as a secure hash — each person should change it after first login):
--        Ajoy, Ankita, Nur, Mitterpreet -> Employee login (crm)
--        Anjana                         -> Manager login
--        Sumitra, Shahab                -> no email yet, so no login
--   4. Company follows the email: parvarealty.ae -> Parva Realty, diagofinance.com -> Diago Finance.
--      Anjana is Branch Head: Ajoy and Ankita now report to her.
--      Nur, Sumitra, Shahab and Mitterpreet report to Akshitha.
--   5. If anything goes wrong, nothing is changed (all-or-nothing).

BEGIN;

-- Moves one employee to a new ID, carrying every reference with it.
CREATE OR REPLACE FUNCTION pg_temp.change_employee_id(old_id TEXT, new_id TEXT) RETURNS void AS $$
DECLARE
  cols TEXT;
  r RECORD;
  n BIGINT;
  old_email TEXT;
  old_bio TEXT;
  has_bio BOOLEAN;
BEGIN
  -- Already done (or the person was never there): nothing to do.
  IF EXISTS (SELECT 1 FROM employees WHERE id = new_id) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = old_id) THEN
    RAISE EXCEPTION 'Employee % was not found, so it cannot be moved to %', old_id, new_id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'biometric_id')
    INTO has_bio;

  -- The copy needs the old row's unique values (email, biometric id), so park them.
  SELECT email INTO old_email FROM employees WHERE id = old_id;
  IF has_bio THEN EXECUTE 'SELECT biometric_id FROM employees WHERE id = $1' INTO old_bio USING old_id; END IF;
  UPDATE employees SET email = NULL WHERE id = old_id;
  IF has_bio THEN EXECUTE 'UPDATE employees SET biometric_id = NULL WHERE id = $1' USING old_id; END IF;

  -- 1) A copy of the row under the new ID.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name <> 'id';
  EXECUTE format('INSERT INTO employees (id, %s) SELECT %L, %s FROM employees WHERE id = %L', cols, new_id, cols, old_id);
  UPDATE employees SET email = old_email WHERE id = new_id;
  IF has_bio THEN EXECUTE 'UPDATE employees SET biometric_id = $2 WHERE id = $1' USING new_id, old_bio; END IF;

  -- 2) Point everything that used the old ID at the new one (every text column in every table).
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
      AND NOT (c.table_name = 'employees' AND c.column_name = 'id')
  LOOP
    EXECUTE format('UPDATE public.%I SET %I = %L WHERE %I = %L', r.table_name, r.column_name, new_id, r.column_name, old_id);
  END LOOP;

  -- 3) Safety check: nothing may still use the old ID, then remove the old row.
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
      AND NOT (c.table_name = 'employees' AND c.column_name = 'id')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L', r.table_name, r.column_name, old_id) INTO n;
    IF n > 0 THEN RAISE EXCEPTION '% rows in %.% still use %', n, r.table_name, r.column_name, old_id; END IF;
  END LOOP;
  DELETE FROM employees WHERE id = old_id;
END;
$$ LANGUAGE plpgsql;

-- ───────────── The 3 people already in the portal: new ID + refreshed details ─────────────
SELECT pg_temp.change_employee_id('PA230047', 'PAU230051');  -- Ajoy Rameshan
SELECT pg_temp.change_employee_id('PA230048', 'PAU230052');  -- Ankita Nair
SELECT pg_temp.change_employee_id('PH230001', 'PAU230053');  -- Anjana

UPDATE employees SET name = 'Ajoy Rameshan', title = 'Property Consultant', email = 'ajoy@parvarealty.ae',
  phone = '971551013421', department = 'Sales', join_date = '2025-02-03', location = 'Dubai',
  company = 'Parva Realty', manager_id = 'PAU230053', password_hash = '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K', updated_at = now()
  WHERE id = 'PAU230051';
UPDATE employees SET name = 'Ankita Nair', title = 'Alliance Manager', email = 'ankita@parvarealty.ae',
  phone = '971564227855', department = 'Sales', join_date = '2024-11-01', location = 'Dubai',
  company = 'Parva Realty', manager_id = 'PAU230053', password_hash = '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K', updated_at = now()
  WHERE id = 'PAU230052';
UPDATE employees SET name = 'Anjana', job_title = 'manager', title = 'Branch Head', email = 'anjana@diagofinance.com',
  phone = '971561598229', department = 'Sales', location = 'Dubai', company = 'Diago Finance',
  login_roles = ARRAY['manager']::TEXT[], password_hash = '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K', updated_at = now()
  WHERE id = 'PAU230053';

-- ───────────── 4 new people ─────────────
INSERT INTO employees (id, name, job_title, title, email, phone, team, manager_id, join_date, status, department, location, company, login_roles, password_hash)
VALUES
  ('PAU230054', 'Nur Uddin',        'agent', 'Admin Officer', 'admin@parvarealty.ae',  '971502128850', '', 'DF230002', '2026-10-01', 'active', 'Admin', 'Dubai', 'Parva Realty', ARRAY['crm']::TEXT[], '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K'),
  ('PAU230055', 'Sumitra Kandel',   'agent', 'Receptionist',  NULL,                    '971501682745', '', 'DF230002', '2024-07-31', 'active', 'Admin', 'Dubai', 'Parva Realty', '{}', NULL),
  ('PAU230056', 'Shahab Ud Din',    'agent', 'Driver',        NULL,                    '971554624413', '', 'DF230002', '2025-08-18', 'active', '',      'Dubai', 'Parva Realty', '{}', NULL),
  ('PAU230057', 'Mitterpreet Singh','agent', 'Director',      'cto@diagofinance.com',  '971586147110', '', 'DF230002', '2023-06-13', 'active', 'Admin', 'Dubai', 'Diago Finance', ARRAY['crm']::TEXT[], '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K')
ON CONFLICT (id) DO NOTHING;

-- Quick result check (shown after Run).
SELECT id, name, title, email, join_date, login_roles FROM employees
 WHERE id IN ('PAU230051','PAU230052','PAU230053','PAU230054','PAU230055','PAU230056','PAU230057') ORDER BY id;

COMMIT;

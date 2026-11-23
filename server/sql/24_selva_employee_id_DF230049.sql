-- Selvakumar Sanmugam: change his Employee ID to DF230049.
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- Everything that points at his old ID (people who report to him, leave,
-- attendance, documents, etc.) is moved to the new ID with him.
-- If DF230049 already belongs to someone else, this stops with a clear message
-- and changes nothing.

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

DO $$
DECLARE
  old_id TEXT;
BEGIN
  SELECT id INTO old_id FROM employees WHERE lower(email) = 'selva@diagofinance.com';
  IF old_id IS NULL THEN
    RAISE EXCEPTION 'Selvakumar (selva@diagofinance.com) was not found.';
  ELSIF old_id = 'DF230049' THEN
    RAISE NOTICE 'Selvakumar is already DF230049 - nothing to do.';
  ELSIF EXISTS (SELECT 1 FROM employees WHERE id = 'DF230049') THEN
    RAISE EXCEPTION 'DF230049 already belongs to someone else - nothing was changed.';
  ELSE
    PERFORM pg_temp.change_employee_id(old_id, 'DF230049');
  END IF;
END $$;

COMMIT;

-- Check: Selva with the new ID, and his team (they should list him as manager).
SELECT id, name, title, email, manager_id FROM employees WHERE lower(email) = 'selva@diagofinance.com';
SELECT e.id, e.name, e.manager_id FROM employees e WHERE e.manager_id = 'DF230049' ORDER BY e.name;

-- Adds Tushar Gairola (Sales) with an Employee (CRM) login.
-- Run once in the Supabase SQL Editor (after 24). Safe to run twice.
--
--   ID         : DF230046 (the ID Selvakumar had before it moved to DF230049)
--   Login      : Employee login with tushar@diagofinance.com, starting password Welcome@123
--                (stored only as a secure hash - he should change it after first login)
--   Department : Sales
--   Reports to : Amit Naudiyal
--   Joined     : 25 October 2026
--   Location and company are copied from Amit Naudiyal's row (same team).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM employees WHERE lower(email) = 'tushar@diagofinance.com') THEN
    RAISE NOTICE 'Tushar is already added - nothing to do.';
  ELSIF EXISTS (SELECT 1 FROM employees WHERE id = 'DF230046') THEN
    RAISE EXCEPTION 'DF230046 is still used by someone else. Run 24_selva_employee_id_DF230049.sql first.';
  ELSIF NOT EXISTS (SELECT 1 FROM employees WHERE lower(email) = 'amitnaudiyal@diagofinance.com') THEN
    RAISE EXCEPTION 'Amit Naudiyal (the reporting manager) was not found.';
  ELSE
    INSERT INTO employees (id, name, job_title, title, email, phone, team, manager_id, join_date, status, department, location, company, login_roles, password_hash)
    SELECT 'DF230046', 'Tushar Gairola', 'agent', NULL, 'tushar@diagofinance.com', '7895329316', '', a.id,
           '2026-10-25', 'active', 'Sales', a.location, a.company,
           ARRAY['crm']::TEXT[], '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K'
    FROM employees a WHERE lower(a.email) = 'amitnaudiyal@diagofinance.com';
  END IF;
END $$;

SELECT e.id, e.name, e.email, e.phone, e.department, e.join_date, e.location, e.company, e.login_roles,
       e.manager_id, m.name AS reports_to
FROM employees e LEFT JOIN employees m ON m.id = e.manager_id
WHERE lower(e.email) = 'tushar@diagofinance.com';

-- Selvakumar Sanmugam's designation.
-- Run once in the Supabase SQL Editor. Safe to run twice.

UPDATE employees
   SET title = 'Head of Sales and Business Development & Bangalore Branch Head', updated_at = now()
 WHERE lower(email) = 'selva@diagofinance.com';

SELECT id, name, title, job_title, department, location FROM employees WHERE lower(email) = 'selva@diagofinance.com';

-- Adds Arun Gupta (Dehradun) with an Employee (CRM) login.
-- Run once in the Supabase SQL Editor. Safe to run twice (skips if the email already exists).
--
--   ID        : next free Diago Finance ID (DF23xxxx), picked automatically
--   Login     : Employee login with arungupta@diagofinance.com, starting password Welcome@123
--               (stored only as a secure hash — he should change it after first login)
--   Reports to: Renuka Rani
--   Join date : left blank for now (HR can fill it in later in the Directory)

INSERT INTO employees (id, name, job_title, title, email, phone, team, manager_id, join_date, status, department, location, company, login_roles, password_hash)
SELECT n.new_id, 'Arun Gupta', 'agent', NULL, 'arungupta@diagofinance.com', '7780834031', '', 'DF230008',
       '', 'active', '', 'Dehradun', 'Diago Finance',
       ARRAY['crm']::TEXT[], '$2b$12$JTANbWzCu6kzvjkD1IGwvuaRkysf4IAxUdEfZZfdxGbQorjGEYN3K'
FROM (
  SELECT 'DF23' || lpad((COALESCE(MAX(substring(id FROM 5)::int), 0) + 1)::text, 4, '0') AS new_id
  FROM employees WHERE id ~ '^DF23[0-9]{4}$'
) n
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE lower(email) = 'arungupta@diagofinance.com');

SELECT id, name, email, phone, manager_id, location, company, login_roles
FROM employees WHERE lower(email) = 'arungupta@diagofinance.com';

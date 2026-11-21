-- DELETES every payslip entry in the portal (the test entries made so far).
-- This cannot be undone. It does NOT touch employees' salary details
-- (Base Salary, HRA, allowances) -- only the generated payslips.
-- Run in the Supabase SQL Editor.

-- 1) Look first: how many payslips are there, and whose?
SELECT p.id, e.name, p.month, p.status, p.net_pay
FROM payroll_records p JOIN employees e ON e.id = p.employee_id
ORDER BY p.id;

-- 2) Delete them all.
DELETE FROM payroll_records;

-- 3) Check: should show 0.
SELECT count(*) AS payslips_left FROM payroll_records;

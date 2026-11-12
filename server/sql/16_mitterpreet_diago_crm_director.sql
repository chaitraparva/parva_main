-- Mitterpreet Singh: Director at Diago CRM, reporting to Neelesh H P (CEO).
-- Run once in the Supabase SQL Editor. Safe to run twice.
UPDATE employees
   SET title = 'Director',
       company = 'Diago CRM',
       manager_id = 'DF230001',
       updated_at = now()
 WHERE id = 'PAU230057';

SELECT id, name, title, company, manager_id FROM employees WHERE id = 'PAU230057';

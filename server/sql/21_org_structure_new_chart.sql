-- New organisation structure (from the hand-drawn chart).
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
--   Selva (Bangalore Branch Head)  -> Arun Kumar A, Manoj H, Subhash H N, Vishwas V now report to him
--                                     (Adithi A, Suhas S Vasishta stay under Arun; Nazish Khan stays under Vishwas)
--   Anjana (Dubai Branch Head)     -> Nur Uddin, Shahab Ud Din, Sumitra Kandel now report to her
--                                     (Ajoy Rameshan and Ankita Nair already do)
--
-- Everyone else on the chart already reports to the right person, and nobody
-- is removed: people who are not drawn on the chart (for example Chandramathi,
-- Mohsin, Nino, Harshitaa, Nandini and the Dehradun team) stay where they are.

UPDATE employees
   SET manager_id = (SELECT id FROM employees WHERE lower(email) = 'selva@diagofinance.com' LIMIT 1),
       updated_at = now()
 WHERE id IN ('DF230011', 'DF230040', 'DF230034', 'DF230037')
   AND EXISTS (SELECT 1 FROM employees WHERE lower(email) = 'selva@diagofinance.com');

UPDATE employees
   SET manager_id = 'PAU230053', updated_at = now()
 WHERE id IN ('PAU230054', 'PAU230055', 'PAU230056')
   AND EXISTS (SELECT 1 FROM employees WHERE id = 'PAU230053');

-- Check: who reports to Selva and to Anjana now
SELECT m.name AS manager, e.name AS reports, e.id
FROM employees e JOIN employees m ON m.id = e.manager_id
WHERE lower(m.email) = 'selva@diagofinance.com' OR m.id = 'PAU230053'
ORDER BY m.name, e.name;

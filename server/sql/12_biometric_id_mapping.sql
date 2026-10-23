-- Links each portal employee to their eTimeTrackLite / face-device Employee Code.
-- Run once in Supabase SQL Editor AFTER 11_biometric_punches_migration.sql.
-- Matched by name from the eTimeTrack employee list (23 Oct 2026).

-- ===== Confident matches (19) =====
UPDATE employees SET biometric_id = '2'  WHERE id = 'DF230019'; -- RANJITHA HS      -> Ranjitha H S
UPDATE employees SET biometric_id = '4'  WHERE id = 'DF230010'; -- SUHAS S V        -> Suhas S Vasishta
UPDATE employees SET biometric_id = '6'  WHERE id = 'DF230012'; -- ADITHI A         -> Adithi A
UPDATE employees SET biometric_id = '7'  WHERE id = 'DF230034'; -- SUBHASH H N      -> Subhash H N
UPDATE employees SET biometric_id = '10' WHERE id = 'DF230011'; -- ARUN KUMAR       -> Arun Kumar A
UPDATE employees SET biometric_id = '11' WHERE id = 'DF230016'; -- NINO SAMUNNIT..  -> Nino Samunnitha
UPDATE employees SET biometric_id = '12' WHERE id = 'DF230006'; -- THEJAVATHI       -> Thejavathi J N
UPDATE employees SET biometric_id = '13' WHERE id = 'DF230017'; -- NAZISH KHAN      -> Nazish Khan
UPDATE employees SET biometric_id = '15' WHERE id = 'PA230018'; -- NAGESH N         -> Nagesh N
UPDATE employees SET biometric_id = '16' WHERE id = 'DF230037'; -- VISHWAS V        -> Vishwas V
UPDATE employees SET biometric_id = '18' WHERE id = 'DF230020'; -- PRAJWAL J        -> Prajwal J
UPDATE employees SET biometric_id = '20' WHERE id = 'DF230029'; -- YATHEESH S P     -> Yatheesh SP
UPDATE employees SET biometric_id = '21' WHERE id = 'DF230042'; -- megashree        -> Meghashree
UPDATE employees SET biometric_id = '22' WHERE id = 'PA230041'; -- VIJAYA VAISHNA.. -> Vijaya Vaishnavi A
UPDATE employees SET biometric_id = '24' WHERE id = 'DF230008'; -- RENUKA           -> Renuka Rani
UPDATE employees SET biometric_id = '25' WHERE id = 'DF230036'; -- CHANDRAMATHI     -> Chandramathi
UPDATE employees SET biometric_id = '26' WHERE id = 'DF230033'; -- HARSHITAA R R    -> Harshitaa R R
UPDATE employees SET biometric_id = '27' WHERE id = 'DF230040'; -- manoj            -> Manoj H
UPDATE employees SET biometric_id = '28' WHERE id = 'DF230044'; -- satish           -> Satish Kumar D

-- ===== Please confirm, then remove the "-- " to run =====
-- UPDATE employees SET biometric_id = '3'  WHERE id = 'DF230002'; -- AKSHITA        -> Akshitha Rautri (Director)?
-- UPDATE employees SET biometric_id = '14' WHERE id = 'DF230043'; -- tejaswini      -> Tejasvi Anand?
-- UPDATE employees SET biometric_id = '17' WHERE id = 'DF230032'; -- PRASHANTH KUM.. -> Prashanth Mandoli?
-- Mohsin (DF230038): in eTimeTrack his code and name are swapped ("MOHSIN" / "4").
--   Fix it in eTimeTrack first, then: UPDATE employees SET biometric_id = '<his device code>' WHERE id = 'DF230038';

-- ===== In eTimeTrack but not in the portal roster (punches will show as "not matched") =====
-- 1 SARIKA SHET, 5 RICHA K, 8 ADMIN, 9 MKM, 19 ZAID KHAN J, 23 MITTER, VEER

-- Check result:
-- SELECT id, name, biometric_id FROM employees ORDER BY biometric_id NULLS LAST;

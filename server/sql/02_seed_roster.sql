-- Full corrected employee roster for Parva Group Portal.
-- Generated from the reviewed employees.seed.json and verified end-to-end
-- against a local Postgres instance before being handed off.
-- Paste this into the Supabase SQL Editor AFTER running the login_roles
-- migration (01_login_roles_migration.sql) and BEFORE the app goes live.
-- Safe to re-run: it upserts on id.

INSERT INTO employees (id, name, job_title, title, email, phone, team, manager_id, join_date, status, department, location, company, login_roles)
VALUES
  ('DF230001', 'Neelesh H P', 'admin', 'CEO', NULL, '', '', NULL, '', 'active', '', '', '', ARRAY['management']::TEXT[]),
  ('DF230002', 'Akshitha Rautri', 'admin', 'Director', NULL, '', '', 'DF230001', '', 'active', '', '', '', ARRAY['management']::TEXT[]),
  ('PA230046', 'Chaitra', 'admin', 'Director', 'chaitra@parvarealty.ae', '', '', 'DF230001', '', 'active', '', 'Bangalore', 'Parva Realty', ARRAY['management']::TEXT[]),
  ('DF230003', 'Ravishankar', 'finance', 'Manager', 'raviammu64@gmail.com', '9620813164', '', 'DF230001', '2022-03-10', 'active', '', 'Tumkur', 'Diago Academy', ARRAY['finance']::TEXT[]),
  ('DF230029', 'Yatheesh SP', 'finance', 'Accountant', 'accounts@diagofinance.com', '7259336021', '', 'DF230001', '2026-04-28', 'active', 'Accounts', 'Bangalore', 'Diago Academy', ARRAY['finance']::TEXT[]),
  ('DF230036', 'Chandramathi', 'agent', 'Branch Head Bangalore', 'chandramathi@diagofinance.com', '9901433133', '', 'DF230002', '2026-06-01', 'active', 'Sales', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230044', 'Satish Kumar D', 'hr', 'HR Head & Bangalore Branch Head', 'satishkumar@diagofinance.com', '9986957906', '', 'DF230002', '2026-08-24', 'active', 'HR & Business Development', 'Bangalore', 'Diago Academy', ARRAY['hr','manager']::TEXT[]),
  ('DF230008', 'Renuka Rani', 'manager', 'Global Sales Head', 'renuka@diagofinance.com', '8295277765', '', 'DF230002', '2025-12-07', 'active', 'Sales', 'Dehradun', 'Diago Academy', ARRAY['manager']::TEXT[]),
  ('DF230006', 'Thejavathi J N', 'agent', 'Global Operations Head', 'thejavathi@diagofinance.com', '9538909061', '', 'DF230002', '', 'active', 'Operations', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230038', 'Mohsin', 'agent', 'Operations Manager', 'mohsin@diagofinance.com', '', '', 'DF230002', '2025-11-01', 'active', 'Operations', 'Dubai', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230011', 'Arun Kumar A', 'agent', 'Team Lead', 'arun@diagofinance.com', '9364913523', '', 'DF230044', '2026-01-16', 'active', 'Sales', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230012', 'Adithi A', 'agent', 'Sales Associate', 'adithi@diagofinance.com', '9964089805', '', 'DF230011', '2026-02-02', 'active', 'CRM', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230010', 'Suhas S Vasishta', 'agent', 'Business Development Executive', 'suhassvasishta@diagofinance.com', '9364913524', '', 'DF230011', '2025-12-15', 'active', 'Sales', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230037', 'Vishwas V', 'agent', 'Team Lead', 'vishwass@diagofinance.com', '7411282661', '', 'DF230044', '2026-02-17', 'active', 'CRM', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230017', 'Nazish Khan', 'agent', 'Sales Associate', 'nazish@diagofinance.com', '9364912937', '', 'DF230037', '2026-02-18', 'active', 'Sales', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230016', 'Nino Samunnitha', 'agent', 'Operations executive', 'samunnithadiago@gmail.com', '9739953093', '', 'DF230037', '2026-02-18', 'active', 'Operations', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230033', 'Harshitaa R R', 'hr', 'Assistant manager', 'hr@diagofinance.com', '9535934702', '', 'DF230044', '', 'active', 'HR', '', '', ARRAY['hr']::TEXT[]),
  ('DF230019', 'Ranjitha H S', 'agent', 'Admin', 'ranjitha@diagofinance.com', '9364912939', '', 'DF230044', '', 'active', 'Administration', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230040', 'Manoj H', 'agent', 'Sales Associate', 'manoj@diagofinance.com', '8431131834', '', 'DF230044', '2026-07-06', 'active', 'CRM', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230034', 'Subhash H N', 'agent', 'Sales Associate', 'subhash@diagofinance.com', '6360382875', '', 'DF230044', '', 'active', 'CRM', 'Bangalore', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230027', 'Nandini B. Madagunaki', 'agent', 'Sales Associate', 'nandini@diagofinance.com', '8904821922', '', 'DF230044', '', 'active', 'CRM', '', '', ARRAY['crm']::TEXT[]),
  ('DF230004', 'Shradha Tapliyal', 'agent', 'Sales Manager', 'shradha@diagofinance.com', '8449789789', '', 'DF230008', '2026-01-05', 'active', 'Sales', 'Dehradun', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230042', 'Meghashree', 'agent', NULL, NULL, '', '', 'DF230008', '', 'active', '', '', '', ARRAY['crm']::TEXT[]),
  ('DF230007', 'Rabia Kapoor', 'agent', 'Global CSM', 'rabia@diagofinance.com', '7988817107', '', 'DF230008', '', 'active', 'CSM', '', '', ARRAY['crm']::TEXT[]),
  ('DF230045', 'Amit Naudiyal', 'agent', 'Senior Business Development Executive - Assistant Manager', 'amitnaudiyal@diagofinance.com', '9023399997', '', 'DF230008', '2026-09-07', 'active', 'Sales', 'Dehradun', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230035', 'Avi Chauhan', 'agent', 'Sales Associate', 'avi@diagofinance.com', '6397263232', '', 'DF230008', '2026-06-04', 'active', 'Sales', 'Dehradun', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230032', 'Prashanth Mandoli', 'agent', NULL, NULL, '', '', 'DF230008', '', 'active', '', '', '', ARRAY['crm']::TEXT[]),
  ('DF230043', 'Tejasvi Anand', 'agent', 'Sales Associate', 'Tejasvi@diagofinance.com', '8630852629', '', 'DF230008', '2026-08-10', 'active', 'Sales', 'Dehradun', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('DF230030', 'Vishal Kumar', 'agent', 'Global CRM', 'vishal@diagofinance.com', '8057743548', '', 'DF230008', '2026-04-06', 'active', 'CSM', 'Dehradun', 'Diago Academy', ARRAY['crm']::TEXT[]),
  ('PA230028', 'Deekshitha M.V', 'agent', 'Software Development Engineer', 'deekshitha@parvarealty.ae', '9880988655', '', 'PA230046', '2026-09-01', 'active', 'IT', 'Bangalore', 'Parva realty', ARRAY['crm']::TEXT[]),
  ('PA230018', 'Nagesh N', 'agent', 'Marketing & Business Development Associate', 'nagesh@parvarealty.ae', '7892347497', '', 'PA230046', '2026-05-04', 'active', 'Marketing nd Business Development', 'Bangalore', 'Parva realty', ARRAY['crm']::TEXT[]),
  ('PA230041', 'Vijaya Vaishnavi A', 'agent', 'Marketing & Business Development Associate', 'vaishnavi@parvarealty.ae', '8095565535', '', 'PA230046', '2026-05-04', 'active', 'Marketing nd Business Development', 'Bangalore', 'Parva realty', ARRAY['crm']::TEXT[]),
  ('PA230047', 'Ajoy Rameshan', 'agent', 'Property Consultant', 'ajoy@parvarealty.ae', '', '', 'PA230046', '', 'active', 'Sales', 'Dubai', 'Parva realty', ARRAY['crm']::TEXT[]),
  ('PA230048', 'Ankita Nair', 'agent', 'Alliance Manager', 'ankita@parvarealty.ae', '', '', 'PA230046', '', 'active', 'Sales', 'Dubai', 'Parva realty', ARRAY['crm']::TEXT[]),
  ('DF230020', 'Prajwal J', 'agent', 'Operations Associate', 'prajwal@diagofinance.com', '9364912938', '', 'DF230003', '2026-02-23', 'active', 'Operations', 'Tumkur', 'Diago finance', ARRAY['crm']::TEXT[]),
  ('PH230001', 'Anjana', 'agent', NULL, NULL, '', '', 'DF230002', '', 'active', '', '', '', '{}'),
  ('PH230002', 'Sushma', 'agent', NULL, NULL, '', '', 'PH230001', '', 'active', '', '', '', ARRAY['crm']::TEXT[]),
  ('PH230003', 'Mausin', 'agent', NULL, NULL, '', '', 'DF230008', '', 'active', '', '', '', '{}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, job_title = EXCLUDED.job_title, title = EXCLUDED.title,
  email = EXCLUDED.email, phone = EXCLUDED.phone, team = EXCLUDED.team,
  manager_id = EXCLUDED.manager_id, join_date = EXCLUDED.join_date,
  status = EXCLUDED.status, department = EXCLUDED.department,
  location = EXCLUDED.location, company = EXCLUDED.company,
  login_roles = EXCLUDED.login_roles, updated_at = now();

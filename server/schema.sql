-- Parva Realty CRM — Postgres schema
-- Run this once against a fresh database (e.g. `psql "$DATABASE_URL" -f schema.sql`).
-- Designed for AWS RDS PostgreSQL 16.x, but has no RDS-specific syntax —
-- works against any standard Postgres instance.

-- ───────────────────────── Employees & auth ─────────────────────────

CREATE TABLE employees (
  id             TEXT PRIMARY KEY,               -- e.g. 'DF230001', 'PA230018' — the user's own numbering
  name           TEXT NOT NULL,
  job_title      TEXT NOT NULL CHECK (job_title IN ('agent', 'manager', 'admin', 'hr', 'finance')),
  title          TEXT,                            -- real-world designation, e.g. "HR Head"
  -- A handful of employees in the source roster have no email on file yet
  -- (left blank rather than guessed) — nullable, with uniqueness enforced
  -- only among the ones that do have one.
  email          TEXT,
  phone          TEXT NOT NULL DEFAULT '',
  team           TEXT NOT NULL DEFAULT '',
  manager_id     TEXT REFERENCES employees(id),
  join_date      TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on-leave', 'inactive')),
  department     TEXT NOT NULL DEFAULT '',
  leads_assigned INTEGER NOT NULL DEFAULT 0,
  conversions    INTEGER NOT NULL DEFAULT 0,
  base_salary    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  response_time  TEXT NOT NULL DEFAULT 'N/A',
  location       TEXT NOT NULL DEFAULT '',
  photo_url      TEXT,
  company        TEXT NOT NULL DEFAULT '',

  -- Auth. password_hash is a bcrypt hash — never store plain text.
  -- login_roles is the explicit, direct source of truth for which portal(s)
  -- this person may sign in to — set once per person (e.g. by HR when the
  -- roster is entered), not derived from job_title. An empty array means
  -- this person cannot sign in to any portal. Most people have exactly one
  -- role in here, but it's an array because a handful of people (e.g.
  -- someone who is both HR and a Line Manager) genuinely need more than one.
  password_hash  TEXT,
  login_roles    TEXT[] NOT NULL DEFAULT '{}' CHECK (login_roles <@ ARRAY['crm', 'manager', 'hr', 'management', 'finance']),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_employees_email_unique ON employees(lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_login_roles ON employees USING GIN (login_roles);

-- ───────────────────────── Leads (CRM) ─────────────────────────

CREATE TABLE leads (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  source         TEXT NOT NULL CHECK (source IN ('Housing.com', 'Social Media', 'Referral', 'Walk-in')),
  status         TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Site Visit', 'Closed')),
  assigned_to    TEXT REFERENCES employees(id),
  agent_name     TEXT NOT NULL DEFAULT '',
  budget         TEXT NOT NULL DEFAULT '',
  property_type  TEXT NOT NULL CHECK (property_type IN ('Apartment', 'Villa', 'Plot')),
  location       TEXT NOT NULL DEFAULT '',
  follow_up_date TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_activities (
  id           BIGSERIAL PRIMARY KEY,
  lead_id      TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('call', 'email', 'note', 'site-visit', 'whatsapp')),
  description  TEXT NOT NULL DEFAULT '',
  by_name      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);

-- ───────────────────────── Leave ─────────────────────────

CREATE TABLE leave_requests (
  id                BIGSERIAL PRIMARY KEY,
  employee_id       TEXT NOT NULL REFERENCES employees(id),
  type              TEXT NOT NULL CHECK (type IN ('Sick', 'Casual', 'Earned', 'Unpaid')),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  days              NUMERIC(4, 1) NOT NULL,
  reason            TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by_role TEXT NOT NULL CHECK (submitted_by_role IN ('crm', 'manager', 'hr', 'management', 'finance')),
  pending_with      TEXT NOT NULL CHECK (pending_with IN ('crm', 'manager', 'hr', 'management', 'finance', 'done')),
  applied_on        TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by        TEXT REFERENCES employees(id),
  decided_at        TIMESTAMPTZ
);

CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);

-- ───────────────────────── Payroll ─────────────────────────

CREATE TABLE payroll_records (
  id               BIGSERIAL PRIMARY KEY,
  employee_id      TEXT NOT NULL REFERENCES employees(id),
  month            TEXT NOT NULL,                 -- e.g. '2026-09'
  base_salary      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  incentives       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending-manager'
                     CHECK (status IN ('pending-manager', 'pending-hr', 'pending-management', 'disbursed')),
  manager_approved BOOLEAN NOT NULL DEFAULT false,
  hr_processed     BOOLEAN NOT NULL DEFAULT false,
  admin_approved   BOOLEAN NOT NULL DEFAULT false,
  disbursed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The exact pay-cycle window and per-cycle discretionary amounts the
  -- "Generate Payslip" flow computes (see server/sql/03_payroll_payslip_
  -- fields_migration.sql for the migration that added these to an
  -- already-created table).
  period_start     DATE,
  period_end       DATE,
  reimbursements   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  UNIQUE (employee_id, month)
);

CREATE INDEX idx_payroll_records_employee_id ON payroll_records(employee_id);

-- ───────────────────────── Attendance ─────────────────────────

CREATE TABLE attendance_records (
  id           BIGSERIAL PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  date         DATE NOT NULL,
  check_in     TEXT NOT NULL DEFAULT '',
  check_out    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_records_employee_id ON attendance_records(employee_id);

-- ───────────────────────── Timesheets (CRM daily activity log) ─────────────────────────

CREATE TABLE timesheet_entries (
  id                       BIGSERIAL PRIMARY KEY,
  employee_id              TEXT NOT NULL REFERENCES employees(id),
  date                     DATE NOT NULL,
  shift_start              TEXT NOT NULL DEFAULT '',
  shift_end                TEXT NOT NULL DEFAULT '',
  total_hours              NUMERIC(4, 2) NOT NULL DEFAULT 0,
  leads_assigned           INTEGER NOT NULL DEFAULT 0,
  calls_made               INTEGER NOT NULL DEFAULT 0,
  connected_calls          INTEGER NOT NULL DEFAULT 0,
  follow_ups_scheduled     INTEGER NOT NULL DEFAULT 0,
  client_appointments_set  INTEGER NOT NULL DEFAULT 0,
  sales_closed             INTEGER NOT NULL DEFAULT 0,
  company_funded_leads     BOOLEAN NOT NULL DEFAULT false,
  self_funded_leads        BOOLEAN NOT NULL DEFAULT false,
  tasks                    TEXT NOT NULL DEFAULT '',
  logged_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_timesheet_entries_employee_id ON timesheet_entries(employee_id);

-- ───────────────────────── Expense claims ─────────────────────────

CREATE TABLE expense_claims (
  id               BIGSERIAL PRIMARY KEY,
  employee_id      TEXT NOT NULL REFERENCES employees(id),
  date             DATE NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL CHECK (category IN
                     ('Travel', 'Meals', 'Training', 'Equipment', 'Accommodation',
                      'Client Entertainment', 'Office Supplies', 'Other')),
  amount           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- Receipt files live in S3, not the database — this stores the S3 object
  -- key so the backend can mint a short-lived pre-signed URL on request.
  receipt_s3_key   TEXT,
  receipt_filename TEXT,
  status           TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Reimbursed')),
  approved_by      TEXT REFERENCES employees(id),
  claimed_on       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reimbursed_on    TIMESTAMPTZ,
  note             TEXT
);

CREATE INDEX idx_expense_claims_employee_id ON expense_claims(employee_id);

-- ───────────────────────── Employee tickets ─────────────────────────

CREATE TABLE tickets (
  id           BIGSERIAL PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN
                 ('IT Support', 'Finance Query', 'HR Request', 'Access Request',
                  'Document Request', 'Grievance', 'Other')),
  priority     TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status       TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Pending Info', 'Resolved', 'Closed')),
  description  TEXT NOT NULL DEFAULT '',
  assigned_to  TEXT REFERENCES employees(id),
  raised_on    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolution   TEXT
);

CREATE TABLE ticket_comments (
  id          BIGSERIAL PRIMARY KEY,
  ticket_id   BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  by_name     TEXT NOT NULL,
  by_role     TEXT NOT NULL CHECK (by_role IN ('hr', 'employee')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_employee_id ON tickets(employee_id);
CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- ───────────────────────── Exit management ─────────────────────────

CREATE TABLE exit_records (
  id                  BIGSERIAL PRIMARY KEY,
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  exit_type           TEXT NOT NULL CHECK (exit_type IN ('Resignation', 'Retirement', 'Termination', 'Contract End')),
  resignation_date    DATE NOT NULL,
  last_working_day    DATE NOT NULL,
  notice_period_days  INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'Notice Period'
                        CHECK (status IN ('Notice Period', 'Clearance Pending', 'Exit Interview Done', 'Completed')),
  exit_interview_done BOOLEAN NOT NULL DEFAULT false,
  fnf_amount          NUMERIC(12, 2),
  fnf_status          TEXT CHECK (fnf_status IN ('Pending', 'Processed')),
  reason              TEXT,
  rehire_eligible     BOOLEAN,
  -- A small, fixed-shape checklist (laptop return, access revocation, etc.)
  -- HR ticks off during offboarding — see sql/04_exit_clearance_checklist_migration.sql.
  clearance_checklist JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE exit_clearance_items (
  id          BIGSERIAL PRIMARY KEY,
  exit_id     BIGINT NOT NULL REFERENCES exit_records(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  owner       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_exit_records_employee_id ON exit_records(employee_id);
CREATE INDEX idx_exit_clearance_items_exit_id ON exit_clearance_items(exit_id);

-- ───────────────────────── Recruitment ─────────────────────────

CREATE TABLE job_requisitions (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  department         TEXT NOT NULL DEFAULT '',
  team               TEXT NOT NULL DEFAULT '',
  openings           INTEGER NOT NULL DEFAULT 1,
  location           TEXT NOT NULL DEFAULT '',
  employment_type    TEXT NOT NULL CHECK (employment_type IN ('Full-time', 'Contract', 'Intern')),
  status             TEXT NOT NULL DEFAULT 'Draft'
                       CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'On Hold', 'Closed')),
  requested_by       TEXT REFERENCES employees(id),
  approved_by        TEXT REFERENCES employees(id),
  posted_on          TIMESTAMPTZ,
  channels           TEXT[] NOT NULL DEFAULT '{}',
  start_date         DATE,
  target_close_date  DATE,
  ctc_range          TEXT NOT NULL DEFAULT ''
);

CREATE TABLE candidates (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  requisition_id   TEXT REFERENCES job_requisitions(id),
  role_applied     TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL DEFAULT '',
  stage            TEXT NOT NULL DEFAULT 'Applied'
                     CHECK (stage IN ('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected')),
  email            TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  experience       TEXT NOT NULL DEFAULT '',
  resume_score     INTEGER NOT NULL DEFAULT 0,
  applied_on       TIMESTAMPTZ NOT NULL DEFAULT now(),
  interview_date   TIMESTAMPTZ,
  interviewer      TEXT,
  bgv_status       TEXT NOT NULL DEFAULT 'Not Started' CHECK (bgv_status IN ('Not Started', 'In Progress', 'Cleared', 'Flagged')),
  offer_status     TEXT NOT NULL DEFAULT 'Not Sent' CHECK (offer_status IN ('Not Sent', 'Sent', 'Accepted', 'Declined')),
  ctc_offered      TEXT
);

CREATE INDEX idx_candidates_requisition_id ON candidates(requisition_id);

-- ───────────────────────── Performance ─────────────────────────

CREATE TABLE performance_goals (
  id           BIGSERIAL PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  quarter      TEXT NOT NULL,
  progress     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('On Track', 'At Risk', 'Completed', 'Not Started')),
  weight       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE performance_reviews (
  id              BIGSERIAL PRIMARY KEY,
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  cycle           TEXT NOT NULL,
  stage           TEXT NOT NULL DEFAULT 'Not Started'
                    CHECK (stage IN ('Not Started', 'Self Review', 'Manager Review', '360 Feedback', 'Calibration', 'Completed')),
  self_rating     NUMERIC(3, 1),
  manager_rating  NUMERIC(3, 1),
  final_rating    NUMERIC(3, 1),
  recommendation  TEXT CHECK (recommendation IN ('Promotion', 'Hike', 'PIP', 'No Change')),
  feedback_count  INTEGER NOT NULL DEFAULT 0,
  reviewer        TEXT REFERENCES employees(id)
);

CREATE INDEX idx_performance_goals_employee_id ON performance_goals(employee_id);
CREATE INDEX idx_performance_reviews_employee_id ON performance_reviews(employee_id);

-- ───────────────────────── Flags & notifications ─────────────────────────

CREATE TABLE flags (
  id           BIGSERIAL PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  type         TEXT NOT NULL CHECK (type IN ('Warning', 'Performance', 'Attendance', 'Conduct')),
  description  TEXT NOT NULL DEFAULT '',
  severity     TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),
  issued_by    TEXT REFERENCES employees(id),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Acknowledged', 'Resolved'))
);

CREATE INDEX idx_flags_employee_id ON flags(employee_id);

CREATE TABLE notifications (
  id           BIGSERIAL PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  type         TEXT NOT NULL CHECK (type IN ('missed-followup', 'unassigned-lead', 'pending-payroll', 'leave-request', 'flag')),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL DEFAULT '',
  read         BOOLEAN NOT NULL DEFAULT false,
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_employee_id ON notifications(employee_id);

-- ───────────────────────── Employee documents (S3-backed) ─────────────────────────

CREATE TABLE employee_documents (
  id           BIGSERIAL PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  -- Matches DOCUMENT_TYPES in src/lib/documentStore.ts exactly (the frontend's
  -- real dropdown list — the original 'payslip'/'offer-letter'/'id-proof'/
  -- 'other' set here was never what the UI actually sent).
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('Aadhar Card', 'PAN Card', 'Degree Certificate', 'Offer Letter', 'Bank Details', 'NDA', 'Resume', 'Other')),
  label        TEXT NOT NULL,
  file_name    TEXT NOT NULL DEFAULT '', -- original filename, kept separately so it doesn't need to be parsed back out of storage_path
  storage_path TEXT NOT NULL,              -- private Supabase Storage object path; never a public URL
  uploaded_by  TEXT REFERENCES employees(id),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employee_documents_employee_id ON employee_documents(employee_id);

-- ───────────────────────── Onboarding ─────────────────────────
-- New-joinee onboarding tracking (src/screens/hr/OnboardingHR.tsx). id is a
-- client-supplied TEXT primary key (the screen generates it as
-- `ob-${Date.now()}`, same as leads/job_requisitions above).
-- checklist_done/doc_items hold the fixed-shape onboarding checklist and
-- required-document checkboxes as small JSONB values — same pattern as
-- exit_records.clearance_checklist, not a separate table, since neither
-- CHECKLIST nor REQUIRED_DOCS (both defined in OnboardingHR.tsx) is
-- something users add arbitrary new rows to.
CREATE TABLE onboarding_candidates (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'agent',
  team                TEXT NOT NULL DEFAULT '',
  joining_date        TEXT NOT NULL,
  email               TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL DEFAULT '',
  doc_status          TEXT NOT NULL DEFAULT 'missing' CHECK (doc_status IN ('complete', 'pending', 'missing')),
  onboarding_progress INTEGER NOT NULL DEFAULT 0,
  checklist_done      JSONB NOT NULL DEFAULT '[]'::jsonb,
  doc_items           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_candidates_created_at ON onboarding_candidates(created_at);

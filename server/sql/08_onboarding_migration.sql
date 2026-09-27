-- Module: Onboarding. Previously src/screens/hr/OnboardingHR.tsx kept every
-- new joinee's record AND their granular checklist/document checkboxes only
-- in the browser's in-memory state — nothing here survived a refresh.
--
-- checklist_done/doc_items are small JSONB values holding the fixed-shape
-- onboarding checklist and required-document checkboxes (see CHECKLIST/
-- REQUIRED_DOCS in OnboardingHR.tsx) — same pattern as
-- exit_records.clearance_checklist (sql/04), not a separate table, since
-- neither list is something users add arbitrary new rows to.

CREATE TABLE IF NOT EXISTS onboarding_candidates (
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

CREATE INDEX IF NOT EXISTS idx_onboarding_candidates_created_at ON onboarding_candidates(created_at);

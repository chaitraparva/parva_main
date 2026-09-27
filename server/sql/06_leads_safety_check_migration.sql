-- Safety-check migration for the new Leads screens (My Leads / Team Leads).
-- `leads` and `lead_activities` were already part of the original schema, so
-- these almost certainly already exist in your database — this just makes
-- sure, using CREATE TABLE IF NOT EXISTS, so running it does nothing if
-- they're already there. Safe to run either way.

CREATE TABLE IF NOT EXISTS leads (
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

CREATE TABLE IF NOT EXISTS lead_activities (
  id           BIGSERIAL PRIMARY KEY,
  lead_id      TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('call', 'email', 'note', 'site-visit', 'whatsapp')),
  description  TEXT NOT NULL DEFAULT '',
  by_name      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);

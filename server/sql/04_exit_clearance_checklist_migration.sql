-- Module 6 (Exit records): the clearance checklist HR ticks off during an
-- employee's offboarding (laptop return, access revocation, knowledge
-- transfer, etc.) was only ever kept in the browser's in-memory state —
-- this adds a real column for it so it survives a refresh like every other
-- field on the exit record. It's a small, fixed-shape list per record
-- (not something users add arbitrary new rows to), so a JSONB array is a
-- better fit here than a separate table like ticket_comments.
ALTER TABLE exit_records
  ADD COLUMN IF NOT EXISTS clearance_checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

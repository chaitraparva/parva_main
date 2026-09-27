-- Wires up Employee Documents to the real backend (previously localStorage
-- only). Two things in the original `employee_documents` table (schema.sql)
-- didn't match what the frontend actually needed, so this migration fixes
-- them. Safe to run even if a few rows already exist (there shouldn't be
-- any yet, since the feature was never live before now).

-- 1. The old doc_type CHECK constraint allowed
--    ('payslip', 'offer-letter', 'id-proof', 'other') — not what the actual
--    upload dropdown (src/lib/documentStore.ts's DOCUMENT_TYPES) sends.
--    Replace it with the real list.
ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_doc_type_check;

ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_doc_type_check
  CHECK (doc_type IN ('Aadhar Card', 'PAN Card', 'Degree Certificate', 'Offer Letter', 'Bank Details', 'NDA', 'Resume', 'Other'));

-- 2. Add a proper file_name column so the original uploaded filename is
--    stored directly instead of being parsed back out of storage_path.
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '';

-- When an exit is marked "Completed", the person is removed from the portal:
-- employees.status becomes 'inactive', so they can no longer log in
-- (auth.js only allows status = 'active') and the app hides them from
-- directory / team / attendance lists. Their old records stay for history.
-- Run once in Supabase SQL Editor. Safe to run more than once.

CREATE OR REPLACE FUNCTION deactivate_employee_on_exit_completed()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Completed' THEN
    UPDATE employees SET status = 'inactive', updated_at = now()
    WHERE id = NEW.employee_id AND status <> 'inactive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exit_completed_deactivate ON exit_records;
CREATE TRIGGER trg_exit_completed_deactivate
  AFTER INSERT OR UPDATE OF status ON exit_records
  FOR EACH ROW EXECUTE FUNCTION deactivate_employee_on_exit_completed();

-- Fix people whose exit was already completed before this trigger existed.
UPDATE employees SET status = 'inactive', updated_at = now()
WHERE status <> 'inactive'
  AND id IN (SELECT employee_id FROM exit_records WHERE status = 'Completed');

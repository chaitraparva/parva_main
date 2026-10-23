-- PERMANENTLY deletes Veer Premi and ALL of his data from the portal.
-- This cannot be undone.
--
-- STEP 1 - run only this line first and check it shows exactly ONE row:
--   SELECT id, name, email FROM employees WHERE name ILIKE '%veer%';
--
-- STEP 2 - then run everything below. It stops with an error (and deletes
-- nothing) unless exactly one employee matches "veer".

DO $$
DECLARE
  v_id   TEXT;
  v_hits INT;
BEGIN
  SELECT count(*) INTO v_hits FROM employees WHERE name ILIKE '%veer%';
  IF v_hits <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 employee matching "veer", found %. Nothing deleted.', v_hits;
  END IF;
  SELECT id INTO v_id FROM employees WHERE name ILIKE '%veer%';

  -- places where he is only mentioned (approver, manager, assignee...) -> cleared
  UPDATE employees           SET manager_id   = NULL WHERE manager_id   = v_id;
  UPDATE leads               SET assigned_to  = NULL WHERE assigned_to  = v_id;
  UPDATE leave_requests      SET decided_by   = NULL WHERE decided_by   = v_id;
  UPDATE expense_claims      SET approved_by  = NULL WHERE approved_by  = v_id;
  UPDATE tickets             SET assigned_to  = NULL WHERE assigned_to  = v_id;
  UPDATE job_requisitions    SET requested_by = NULL WHERE requested_by = v_id;
  UPDATE job_requisitions    SET approved_by  = NULL WHERE approved_by  = v_id;
  UPDATE performance_reviews SET reviewer     = NULL WHERE reviewer     = v_id;
  UPDATE flags               SET issued_by    = NULL WHERE issued_by    = v_id;
  UPDATE employee_documents  SET uploaded_by  = NULL WHERE uploaded_by  = v_id;
  UPDATE biometric_punches   SET employee_id  = NULL WHERE employee_id  = v_id;

  -- his own records -> deleted
  DELETE FROM leave_requests      WHERE employee_id = v_id;
  DELETE FROM payroll_records     WHERE employee_id = v_id;
  DELETE FROM attendance_records  WHERE employee_id = v_id;
  DELETE FROM timesheet_entries   WHERE employee_id = v_id;
  DELETE FROM expense_claims      WHERE employee_id = v_id;
  DELETE FROM tickets             WHERE employee_id = v_id;
  DELETE FROM exit_records        WHERE employee_id = v_id;
  DELETE FROM performance_goals   WHERE employee_id = v_id;
  DELETE FROM performance_reviews WHERE employee_id = v_id;
  DELETE FROM flags               WHERE employee_id = v_id;
  DELETE FROM notifications       WHERE employee_id = v_id;
  DELETE FROM employee_documents  WHERE employee_id = v_id;

  DELETE FROM employees WHERE id = v_id;
  RAISE NOTICE 'Deleted employee % and all related records.', v_id;
END $$;

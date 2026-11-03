
CREATE OR REPLACE FUNCTION track_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        IF TG_OP = 'INSERT'
           OR OLD.status IS DISTINCT FROM 'completed' THEN
            NEW.completed_at = NOW();
        END IF;
    ELSE
        NEW.completed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_completion
ON tasks;

CREATE TRIGGER trg_task_completion
BEFORE INSERT OR UPDATE OF status
ON tasks
FOR EACH ROW
EXECUTE FUNCTION track_task_completion();

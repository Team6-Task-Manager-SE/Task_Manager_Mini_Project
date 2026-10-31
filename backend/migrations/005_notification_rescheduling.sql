
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

UPDATE notifications n
SET due_at = t.due_at
FROM tasks t
WHERE n.task_id = t.id
  AND n.due_at IS NULL;

ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS unique_task_due_notification;

CREATE UNIQUE INDEX IF NOT EXISTS
  unique_notification_per_due_date
ON notifications (
  user_id,
  task_id,
  notification_type,
  due_at
);

ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (notification_type IN ('due_soon', 'task_assigned'));

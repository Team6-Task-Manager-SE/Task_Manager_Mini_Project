CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    task_id BIGINT NOT NULL
        REFERENCES tasks(id) ON DELETE CASCADE,

    notification_type VARCHAR(50) NOT NULL,

    message TEXT NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS notifications_task_id_idx
ON notifications(task_id);
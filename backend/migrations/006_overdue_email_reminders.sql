
CREATE TABLE IF NOT EXISTS overdue_email_reminders (
    id BIGSERIAL PRIMARY KEY,

    task_id BIGINT NOT NULL
        REFERENCES tasks(id) ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    due_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'simulated')),

    delivery_method VARCHAR(30),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    processed_at TIMESTAMPTZ,

    CONSTRAINT unique_overdue_email_reminder
        UNIQUE (task_id, user_id, due_at)
);

CREATE INDEX IF NOT EXISTS overdue_email_reminders_status_idx
ON overdue_email_reminders(status, created_at);

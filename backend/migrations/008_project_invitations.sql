CREATE TABLE IF NOT EXISTS project_invitations (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email VARCHAR(320) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'accepted' AND accepted_at IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS project_invitations_user_status_idx
  ON project_invitations(invited_user_id, status);

CREATE INDEX IF NOT EXISTS project_invitations_project_status_idx
  ON project_invitations(project_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS project_invitations_pending_unique
  ON project_invitations(project_id, invited_user_id)
  WHERE status = 'pending';
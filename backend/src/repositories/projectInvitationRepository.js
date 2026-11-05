function createProjectInvitationRepository(pool) {
  return {
    async createInvitation({
      projectId,
      inviterId,
      invitedEmail,
      tokenHash,
      expiresAt,
    }) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Only the project owner can invite members.
        const projectResult = await client.query(
          `SELECT id, name
             FROM projects
            WHERE id = $1 AND owner_id = $2`,
          [projectId, inviterId]
        );

        if (projectResult.rowCount === 0) {
          await client.query("COMMIT");
          return { status: "forbidden" };
        }

        // Invitations are only for registered users.
        const userResult = await client.query(
          `SELECT id, name, email
             FROM users
            WHERE LOWER(email) = LOWER($1)`,
          [invitedEmail]
        );

        if (userResult.rowCount === 0) {
          await client.query("COMMIT");
          return { status: "user_not_found" };
        }

        const invitedUser = userResult.rows[0];

        if (String(invitedUser.id) === String(inviterId)) {
          await client.query("COMMIT");
          return { status: "cannot_invite_self" };
        }

        const result = await client.query(
          `INSERT INTO project_invitations (
             project_id,
             invited_by,
             invited_user_id,
             invited_email,
             token_hash,
             expires_at
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, project_id, invited_user_id, invited_email,
                     status, expires_at`,
          [
            projectId,
            inviterId,
            invitedUser.id,
            invitedUser.email,
            tokenHash,
            expiresAt,
          ]
        );

        await client.query("COMMIT");

        return {
          status: "created",
          invitation: result.rows[0],
          invitedUser,
          project: projectResult.rows[0],
        };
      } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
          return { status: "duplicate_invitation" };
        }

        throw error;
      } finally {
        client.release();
      }
    },

    async acceptInvitation({ tokenHash, userId }) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Lock the invitation so it cannot be accepted twice concurrently.
        const invitationResult = await client.query(
          `SELECT id, project_id, invited_user_id, status, expires_at
             FROM project_invitations
            WHERE token_hash = $1
            FOR UPDATE`,
          [tokenHash]
        );

        if (invitationResult.rowCount === 0) {
          await client.query("COMMIT");
          return { status: "invalid_invitation" };
        }

        const invitation = invitationResult.rows[0];

        if (String(invitation.invited_user_id) !== String(userId)) {
          await client.query("COMMIT");
          return { status: "wrong_user" };
        }

        if (invitation.status === "accepted") {
          await client.query("COMMIT");
          return { status: "already_accepted" };
        }

        if (invitation.status !== "pending") {
          await client.query("COMMIT");
          return { status: "invalid_invitation" };
        }

        if (new Date(invitation.expires_at) <= new Date()) {
          await client.query(
            `UPDATE project_invitations
                SET status = 'expired'
              WHERE id = $1`,
            [invitation.id]
          );

          await client.query("COMMIT");
          return { status: "expired" };
        }

        // Add the invited user to the project.
        await client.query(
          `INSERT INTO project_members (project_id, user_id, membership_role)
           VALUES ($1, $2, 'member')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [invitation.project_id, userId]
        );

        await client.query(
          `UPDATE project_invitations
              SET status = 'accepted',
                  accepted_at = NOW()
            WHERE id = $1`,
          [invitation.id]
        );

        await client.query("COMMIT");

        return {
          status: "accepted",
          projectId: invitation.project_id,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = { createProjectInvitationRepository };
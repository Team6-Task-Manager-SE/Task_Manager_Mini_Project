const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");

require("dotenv").config();

const pool = require("../src/config/database");
const {
  createProjectInvitationRepository,
} = require("../src/repositories/projectInvitationRepository");

after(async () => {
  await pool.end();
});

test("F-040 supports secure project invitations and acceptance", async () => {
  const repository = createProjectInvitationRepository(pool);
  const suffix = randomUUID();

  const userIds = [];
  let projectId = null;

  function createTokenHash() {
    return createHash("sha256")
      .update(randomUUID())
      .digest("hex");
  }

  async function createUser(label) {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        `Invitation Test ${label}`,
        `invitation-${label}-${suffix}@example.test`,
        "test-only-not-a-real-password",
      ]
    );

    const id = result.rows[0].id;
    userIds.push(id);
    return id;
  }

  try {
    const ownerId = await createUser("owner");
    const invitedUserId = await createUser("invited");
    const unrelatedUserId = await createUser("unrelated");
    const expiredUserId = await createUser("expired");

    const projectResult = await pool.query(
      `INSERT INTO projects (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [ownerId, `Invitation Test Project ${suffix}`, "F-040 test"]
    );

    projectId = projectResult.rows[0].id;

    const invitedEmail =
      `invitation-invited-${suffix}@example.test`;

    // An unrelated user cannot invite members.
    const forbidden = await repository.createInvitation({
      projectId,
      inviterId: unrelatedUserId,
      invitedEmail,
      tokenHash: createTokenHash(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    assert.equal(forbidden.status, "forbidden");

    // Only registered users can be invited.
    const missingUser = await repository.createInvitation({
      projectId,
      inviterId: ownerId,
      invitedEmail: `missing-${suffix}@example.test`,
      tokenHash: createTokenHash(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    assert.equal(missingUser.status, "user_not_found");

    // The owner cannot invite themselves.
    const selfInvitation = await repository.createInvitation({
      projectId,
      inviterId: ownerId,
      invitedEmail: `invitation-owner-${suffix}@example.test`,
      tokenHash: createTokenHash(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    assert.equal(selfInvitation.status, "cannot_invite_self");

    // The owner can successfully invite a registered user.
    const tokenHash = createTokenHash();

    const invitation = await repository.createInvitation({
      projectId,
      inviterId: ownerId,
      invitedEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + 86400000),
    });

    assert.equal(invitation.status, "created");
    assert.equal(
      Number(invitation.invitation.invited_user_id),
      Number(invitedUserId)
    );

    // A duplicate pending invitation is rejected.
    const duplicate = await repository.createInvitation({
      projectId,
      inviterId: ownerId,
      invitedEmail,
      tokenHash: createTokenHash(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    assert.equal(duplicate.status, "duplicate_invitation");

    // An unrelated user cannot accept the invitation.
    const wrongUser = await repository.acceptInvitation({
      tokenHash,
      userId: unrelatedUserId,
    });

    assert.equal(wrongUser.status, "wrong_user");

    // An unknown token is rejected.
    const invalid = await repository.acceptInvitation({
      tokenHash: createTokenHash(),
      userId: invitedUserId,
    });

    assert.equal(invalid.status, "invalid_invitation");

    // The invited user can accept the invitation.
    const accepted = await repository.acceptInvitation({
      tokenHash,
      userId: invitedUserId,
    });

    assert.equal(accepted.status, "accepted");
    assert.equal(Number(accepted.projectId), Number(projectId));

    // Acceptance adds the invited user to project_members.
    const membership = await pool.query(
      `SELECT membership_role
         FROM project_members
        WHERE project_id = $1 AND user_id = $2`,
      [projectId, invitedUserId]
    );

    assert.equal(membership.rowCount, 1);
    assert.equal(membership.rows[0].membership_role, "member");

    // An accepted invitation cannot be accepted again.
    const acceptedAgain = await repository.acceptInvitation({
      tokenHash,
      userId: invitedUserId,
    });

    assert.equal(acceptedAgain.status, "already_accepted");

    // Create an invitation that has already expired.
    const expiredTokenHash = createTokenHash();

    const expiredInvitation = await repository.createInvitation({
      projectId,
      inviterId: ownerId,
      invitedEmail: `invitation-expired-${suffix}@example.test`,
      tokenHash: expiredTokenHash,
      expiresAt: new Date(Date.now() - 1000),
    });

    assert.equal(expiredInvitation.status, "created");

    const expired = await repository.acceptInvitation({
      tokenHash: expiredTokenHash,
      userId: expiredUserId,
    });

    assert.equal(expired.status, "expired");

    // Confirm that the expired status was saved in PostgreSQL.
    const expiredRecord = await pool.query(
      `SELECT status
         FROM project_invitations
        WHERE token_hash = $1`,
      [expiredTokenHash]
    );

    assert.equal(expiredRecord.rows[0].status, "expired");

    console.log("F-040 PostgreSQL invitation tests passed.");
  } finally {
    // Project deletion cascades to invitations and memberships.
    if (projectId !== null) {
      await pool.query(
        "DELETE FROM projects WHERE id = $1",
        [projectId]
      );
    }

    if (userIds.length > 0) {
      await pool.query(
        "DELETE FROM users WHERE id = ANY($1::bigint[])",
        [userIds.map(String)]
      );
    }
  }
});
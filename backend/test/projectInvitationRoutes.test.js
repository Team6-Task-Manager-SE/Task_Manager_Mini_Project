const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const { createApp } = require("../src/app");

let inviteResult = {
  status: "created",
  invitation: {
    id: 1,
    project_id: 100,
    invited_email: "member@example.test",
    status: "pending",
  },
};

let acceptResult = {
  status: "accepted",
  projectId: 100,
};

let lastInviteArgs = null;
let lastAcceptArgs = null;

const invitationService = {
  async inviteUser(args) {
    lastInviteArgs = args;
    return inviteResult;
  },

  async acceptInvitation(args) {
    lastAcceptArgs = args;
    return acceptResult;
  },
};

const app = createApp({
  tasks: {},
  invitationService,
});

function tokenFor(id) {
  return createAccessToken({
    id,
    email: `user${id}@example.test`,
    role: "user",
  });
}

test("invitation endpoints reject requests without authentication", async () => {
  const invite = await request(app)
    .post("/api/v1/projects/100/members")
    .send({ email: "member@example.test" });

  assert.equal(invite.status, 401);

  const accept = await request(app)
    .post("/api/v1/project-invitations/accept")
    .send({ token: "test-token" });

  assert.equal(accept.status, 401);
});

test("invitation endpoints reject invalid bearer tokens", async () => {
  const response = await request(app)
    .post("/api/v1/projects/100/members")
    .set("Authorization", "Bearer invalid-token")
    .send({ email: "member@example.test" });

  assert.equal(response.status, 401);
});

test("invitation endpoint rejects an invalid project ID", async () => {
  lastInviteArgs = null;

  const response = await request(app)
    .post("/api/v1/projects/abc/members")
    .set("Authorization", `Bearer ${tokenFor(101)}`)
    .send({ email: "member@example.test" });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_PROJECT_ID");
  assert.equal(lastInviteArgs, null);
});

test("project owner invitation request returns 201", async () => {
  inviteResult = {
    status: "created",
    invitation: {
      id: 2,
      project_id: 100,
      invited_email: "member@example.test",
      status: "pending",
    },
  };

  const response = await request(app)
    .post("/api/v1/projects/100/members")
    .set("Authorization", `Bearer ${tokenFor(101)}`)
    .send({ email: "member@example.test" });

  assert.equal(response.status, 201);
  assert.equal(response.body.status, "success");
  assert.equal(response.body.data.id, 2);

  // The inviter ID must come from the authenticated token.
  assert.equal(Number(lastInviteArgs.inviterId), 101);
  assert.equal(lastInviteArgs.projectId, "100");
  assert.equal(lastInviteArgs.invitedEmail, "member@example.test");
});

test("invitation endpoint maps invalid email to 400", async () => {
  inviteResult = { status: "invalid_email" };

  const response = await request(app)
    .post("/api/v1/projects/100/members")
    .set("Authorization", `Bearer ${tokenFor(101)}`)
    .send({ email: "invalid-email" });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_EMAIL");
});

test("invitation endpoint rejects non-owners with 403", async () => {
  inviteResult = { status: "forbidden" };

  const response = await request(app)
    .post("/api/v1/projects/100/members")
    .set("Authorization", `Bearer ${tokenFor(102)}`)
    .send({ email: "member@example.test" });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "PROJECT_OWNER_REQUIRED");
});

test("invitation endpoint maps unregistered users to 404", async () => {
  inviteResult = { status: "user_not_found" };

  const response = await request(app)
    .post("/api/v1/projects/100/members")
    .set("Authorization", `Bearer ${tokenFor(101)}`)
    .send({ email: "unknown@example.test" });

  assert.equal(response.status, 404);
  assert.equal(response.body.code, "USER_NOT_FOUND");
});

test("invitation endpoint maps duplicate invitations to 409", async () => {
  inviteResult = { status: "duplicate_invitation" };

  const response = await request(app)
    .post("/api/v1/projects/100/members")
    .set("Authorization", `Bearer ${tokenFor(101)}`)
    .send({ email: "member@example.test" });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "INVITATION_ALREADY_PENDING");
});

test("invited user can accept an invitation", async () => {
  acceptResult = {
    status: "accepted",
    projectId: 100,
  };

  const response = await request(app)
    .post("/api/v1/project-invitations/accept")
    .set("Authorization", `Bearer ${tokenFor(103)}`)
    .send({ token: "valid-invitation-token" });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "success");
  assert.equal(Number(response.body.data.projectId), 100);

  // The accepting user ID must come from the authenticated token.
  assert.equal(Number(lastAcceptArgs.userId), 103);
  assert.equal(lastAcceptArgs.token, "valid-invitation-token");
});

test("acceptance rejects a different user with 403", async () => {
  acceptResult = { status: "wrong_user" };

  const response = await request(app)
    .post("/api/v1/project-invitations/accept")
    .set("Authorization", `Bearer ${tokenFor(104)}`)
    .send({ token: "another-users-token" });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "INVITATION_USER_MISMATCH");
});

test("acceptance rejects invalid or expired invitations with 400", async () => {
  acceptResult = { status: "invalid_invitation" };

  const invalid = await request(app)
    .post("/api/v1/project-invitations/accept")
    .set("Authorization", `Bearer ${tokenFor(103)}`)
    .send({ token: "invalid-token" });

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, "INVALID_OR_EXPIRED_INVITATION");

  acceptResult = { status: "expired" };

  const expired = await request(app)
    .post("/api/v1/project-invitations/accept")
    .set("Authorization", `Bearer ${tokenFor(103)}`)
    .send({ token: "expired-token" });

  assert.equal(expired.status, 400);
  assert.equal(expired.body.code, "INVALID_OR_EXPIRED_INVITATION");
});

test("acceptance rejects an already accepted invitation with 409", async () => {
  acceptResult = { status: "already_accepted" };

  const response = await request(app)
    .post("/api/v1/project-invitations/accept")
    .set("Authorization", `Bearer ${tokenFor(103)}`)
    .send({ token: "previously-accepted-token" });

  assert.equal(response.status, 409);
  assert.equal(response.body.code, "INVITATION_ALREADY_ACCEPTED");
});
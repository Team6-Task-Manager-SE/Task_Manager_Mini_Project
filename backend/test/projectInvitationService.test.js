const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  createProjectInvitationService,
} = require("../src/services/projectInvitationService");

test("invitation generates a secure token and sends an email", async () => {
  let savedInvitation;
  let sentEmail;

  const invitationRepository = {
    async createInvitation(data) {
      savedInvitation = data;

      return {
        status: "created",
        invitation: { id: 1, status: "pending" },
        invitedUser: {
          id: 2,
          name: "Test Member",
          email: "member@example.test",
        },
        project: {
          id: 10,
          name: "Test Project",
        },
      };
    },

    async acceptInvitation(data) {
      return { status: "accepted", projectId: 10, ...data };
    },
  };

  const emailService = {
    async sendProjectInvitation(data) {
      sentEmail = data;
    },
  };

  const service = createProjectInvitationService({
    invitationRepository,
    emailService,
    frontendUrl: "http://localhost:5173/",
  });

  const result = await service.inviteUser({
    projectId: 10,
    inviterId: 1,
    invitedEmail: " MEMBER@EXAMPLE.TEST ",
  });

  assert.equal(result.status, "created");
  assert.equal(result.invitation.id, 1);

  assert.equal(savedInvitation.invitedEmail, "member@example.test");

  // The stored token must be a SHA-256 hash, not the raw token.
  assert.match(savedInvitation.tokenHash, /^[a-f0-9]{64}$/);

  assert.ok(sentEmail);
  assert.equal(sentEmail.email, "member@example.test");
  assert.equal(sentEmail.name, "Test Member");
  assert.equal(sentEmail.projectName, "Test Project");

  const url = new URL(sentEmail.invitationLink);
  const token = url.searchParams.get("token");

  assert.equal(url.pathname, "/accept-invitation");
  assert.match(token, /^[a-f0-9]{64}$/);

  const calculatedHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  assert.equal(calculatedHash, savedInvitation.tokenHash);
});

test("invalid email is rejected without creating an invitation", async () => {
  let repositoryCalled = false;

  const service = createProjectInvitationService({
    invitationRepository: {
      async createInvitation() {
        repositoryCalled = true;
      },
    },
    emailService: {
      async sendProjectInvitation() {},
    },
  });

  const result = await service.inviteUser({
    projectId: 10,
    inviterId: 1,
    invitedEmail: "invalid-email",
  });

  assert.equal(result.status, "invalid_email");
  assert.equal(repositoryCalled, false);
});

test("invitation email is not sent when repository rejects invitation", async () => {
  let emailSent = false;

  const service = createProjectInvitationService({
    invitationRepository: {
      async createInvitation() {
        return { status: "forbidden" };
      },
    },
    emailService: {
      async sendProjectInvitation() {
        emailSent = true;
      },
    },
  });

  const result = await service.inviteUser({
    projectId: 10,
    inviterId: 3,
    invitedEmail: "member@example.test",
  });

  assert.equal(result.status, "forbidden");
  assert.equal(emailSent, false);
});

test("acceptance hashes the token before checking the repository", async () => {
  let receivedTokenHash;
  const token = crypto.randomBytes(32).toString("hex");

  const service = createProjectInvitationService({
    invitationRepository: {
      async createInvitation() {},
      async acceptInvitation(data) {
        receivedTokenHash = data.tokenHash;
        return { status: "accepted", projectId: 10 };
      },
    },
    emailService: {},
  });

  const result = await service.acceptInvitation({
    token,
    userId: 2,
  });

  const expectedHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  assert.equal(receivedTokenHash, expectedHash);
  assert.equal(result.status, "accepted");
});

test("invalid invitation tokens are rejected", async () => {
  let repositoryCalled = false;

  const service = createProjectInvitationService({
    invitationRepository: {
      async createInvitation() {},
      async acceptInvitation() {
        repositoryCalled = true;
      },
    },
    emailService: {},
  });

  const result = await service.acceptInvitation({
    token: "invalid-token",
    userId: 2,
  });

  assert.equal(result.status, "invalid_invitation");
  assert.equal(repositoryCalled, false);
});
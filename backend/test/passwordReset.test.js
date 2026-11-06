const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createAuthService } = require("../src/services/authService");
const { verifyPassword } = require("../src/services/passwordService");

function createTestContext({ user = { id: 42, name: "Reset User", email: "reset@example.test" } } = {}) {
  const storedTokens = [];
  const auditLogs = [];
  const sentEmails = [];
  let passwordHash = "old-hash";
  const users = {
    async findByEmail() { return user; },
    async createPasswordResetToken(token) { storedTokens.push(token); },
    async consumePasswordResetToken({ tokenHash, passwordHash: nextHash }) {
      const record = storedTokens.find((item) => item.tokenHash === tokenHash);
      if (!record || record.expiresAt <= new Date()) return null;
      storedTokens.splice(storedTokens.indexOf(record), 1);
      passwordHash = nextHash;
      return { userId: user.id };
    },
    async addAuditLog(entry) { auditLogs.push(entry); },
  };
  const emailService = {
    async sendPasswordReset(email) { sentEmails.push(email); return { delivery: "test" }; },
  };
  return {
    service: createAuthService({ users, emailService }),
    storedTokens,
    auditLogs,
    sentEmails,
    readPasswordHash: () => passwordHash,
  };
}

test("reset requests store only a hashed, expiring token and email the raw token", async () => {
  const context = createTestContext();
  const before = Date.now();
  const result = await context.service.requestPasswordReset({
    email: "reset@example.test",
    ipAddress: "127.0.0.1",
  });

  const saved = context.storedTokens[0];
  const rawToken = context.sentEmails[0].token;
  assert.deepEqual(result, { accepted: true });
  assert.match(rawToken, /^[a-f0-9]{64}$/);
  assert.notEqual(saved.tokenHash, rawToken);
  assert.equal(saved.tokenHash, crypto.createHash("sha256").update(rawToken).digest("hex"));
  assert.ok(saved.expiresAt.getTime() >= before + 29 * 60 * 1000);
  assert.ok(saved.expiresAt.getTime() <= before + 31 * 60 * 1000);
  assert.equal(context.sentEmails[0].email, "reset@example.test");
  assert.equal(context.auditLogs[0].eventType, "PASSWORD_RESET_REQUESTED");
});

test("unknown email reset request returns the same accepted result without sending mail", async () => {
  const context = createTestContext({ user: null });
  const result = await context.service.requestPasswordReset({ email: "missing@example.test" });
  assert.deepEqual(result, { accepted: true });
  assert.equal(context.sentEmails.length, 0);
  assert.equal(context.storedTokens.length, 0);
});

test("a valid reset changes the password and records completion", async () => {
  const context = createTestContext();
  await context.service.requestPasswordReset({ email: "reset@example.test" });
  const rawToken = context.sentEmails[0].token;

  await context.service.resetPassword({
    token: rawToken,
    password: "NewPassword123",
    ipAddress: "127.0.0.1",
  });

  assert.equal(await verifyPassword("NewPassword123", context.readPasswordHash()), true);
  assert.equal(context.auditLogs.at(-1).eventType, "PASSWORD_RESET_COMPLETED");
  await assert.rejects(
    context.service.resetPassword({ token: rawToken, password: "AnotherPassword123" }),
    (error) => error.code === "INVALID_RESET_TOKEN" && error.statusCode === 400,
  );
});

test("expired or unknown reset tokens are rejected", async () => {
  const context = createTestContext();
  await assert.rejects(
    context.service.resetPassword({ token: "a".repeat(64), password: "NewPassword123" }),
    (error) => error.code === "INVALID_RESET_TOKEN" && error.statusCode === 400,
  );
});

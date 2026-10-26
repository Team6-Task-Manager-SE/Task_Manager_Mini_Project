const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-tests";

const { createAuthService } = require("../src/services/authService");
const { verifyPassword } = require("../src/services/passwordService");
const createAuthRateLimiter = require("../src/middleware/authRateLimiter");

function createMemoryUsers() {
  const records = [];
  const auditLogs = [];
  return {
    records,
    auditLogs,
    async findByEmail(email) {
      return records.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
    },
    async create({ name, email, passwordHash }) {
      const user = {
        id: records.length + 1,
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: "user",
        email_confirmed: false,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: new Date(),
      };
      records.push(user);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailConfirmed: false,
        createdAt: user.created_at,
      };
    },
    async recordFailedLogin(userId) {
      const user = records.find((item) => item.id === userId);
      user.failed_login_attempts += 1;
      if (user.failed_login_attempts >= 5) user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
      return { failed_login_attempts: user.failed_login_attempts, locked_until: user.locked_until };
    },
    async resetFailedLogins(userId) {
      const user = records.find((item) => item.id === userId);
      user.failed_login_attempts = 0;
      user.locked_until = null;
    },
    async addAuditLog(entry) { auditLogs.push(entry); },
    async confirmEmail(userId) {
      const user = records.find((item) => String(item.id) === String(userId));
      if (!user) return null;
      user.email_confirmed = true;
      return { id: user.id, name: user.name, email: user.email, role: user.role, emailConfirmed: true };
    },
  };
}

function createService() {
  const users = createMemoryUsers();
  const sentEmails = [];
  const emailService = {
    async sendRegistrationConfirmation(message) {
      sentEmails.push(message);
      return { delivery: "test" };
    },
  };
  return { users, sentEmails, service: createAuthService({ users, emailService }) };
}

test("registration hashes the password and sends a confirmation", async () => {
  const { users, sentEmails, service } = createService();
  const result = await service.register({
    name: "Test User",
    email: "Test@Example.com",
    password: "SecurePass1",
    ipAddress: "127.0.0.1",
  });

  assert.equal(result.user.email, "test@example.com");
  assert.notEqual(users.records[0].password_hash, "SecurePass1");
  assert.equal(await verifyPassword("SecurePass1", users.records[0].password_hash), true);
  assert.equal(sentEmails.length, 1);
  assert.ok(sentEmails[0].token);
});

test("duplicate email registration is rejected", async () => {
  const { service } = createService();
  const input = { name: "Test User", email: "test@example.com", password: "SecurePass1" };
  await service.register(input);
  await assert.rejects(() => service.register(input), (error) => error.code === "EMAIL_EXISTS");
});

test("valid login returns a JWT and resets failed attempts", async () => {
  const { users, service } = createService();
  await service.register({ name: "Test User", email: "test@example.com", password: "SecurePass1" });
  users.records[0].failed_login_attempts = 2;

  const result = await service.login({ email: "test@example.com", password: "SecurePass1" });
  assert.equal(result.user.email, "test@example.com");
  assert.equal(result.token.split('.').length, 3);
  assert.equal(users.records[0].failed_login_attempts, 0);
});

test("five invalid logins lock the account and record an audit event", async () => {
  const { users, service } = createService();
  await service.register({ name: "Test User", email: "test@example.com", password: "SecurePass1" });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await assert.rejects(
      () => service.login({ email: "test@example.com", password: "WrongPassword1" }),
      (error) => error.code === "INVALID_CREDENTIALS"
    );
  }
  await assert.rejects(
    () => service.login({ email: "test@example.com", password: "WrongPassword1" }),
    (error) => error.code === "ACCOUNT_LOCKED" && error.statusCode === 423
  );
  assert.ok(users.auditLogs.some((entry) => entry.eventType === "ACCOUNT_LOCKED"));
});

test("authentication endpoints reject the eleventh request in one minute", async () => {
  const app = express();
  app.use(createAuthRateLimiter({ isOpen: false }));
  app.get("/auth", (req, res) => res.json({ ok: true }));

  for (let requestNumber = 1; requestNumber <= 10; requestNumber += 1) {
    const response = await request(app).get("/auth");
    assert.equal(response.status, 200);
  }
  const blocked = await request(app).get("/auth");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, "RATE_LIMITED");
});

const { hashPassword, verifyPassword } = require("./passwordService");
const {
  createAccessToken,
  createEmailConfirmationToken,
  verifyToken,
} = require("./tokenService");
const { toPublicUser } = require("../repositories/userRepository");

class AuthError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function createAuthService({ users, emailService }) {
  return {
    async register({ name, email, password, ipAddress }) {
      const existingUser = await users.findByEmail(email);
      if (existingUser) {
        throw new AuthError("An account with this email already exists", 409, "EMAIL_EXISTS");
      }

      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = await users.create({ name, email, passwordHash });
      } catch (error) {
        if (error.code === "23505") {
          throw new AuthError("An account with this email already exists", 409, "EMAIL_EXISTS");
        }
        throw error;
      }

      const confirmationToken = createEmailConfirmationToken(user);
      const emailResult = await emailService.sendRegistrationConfirmation({
        email: user.email,
        name: user.name,
        token: confirmationToken,
      });
      await users.addAuditLog({
        userId: user.id,
        eventType: "USER_REGISTERED",
        ipAddress,
      });

      return { user, confirmationDelivery: emailResult.delivery };
    },

    async login({ email, password, ipAddress }) {
      const user = await users.findByEmail(email);
      if (!user) {
        throw new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
      if (lockedUntil && lockedUntil > new Date()) {
        throw new AuthError(
          `Account is locked until ${lockedUntil.toISOString()}`,
          423,
          "ACCOUNT_LOCKED"
        );
      }

      const passwordMatches = await verifyPassword(password, user.password_hash);
      if (!passwordMatches) {
        const state = await users.recordFailedLogin(user.id);
        if (state.failed_login_attempts >= 5) {
          await users.addAuditLog({
            userId: user.id,
            eventType: "ACCOUNT_LOCKED",
            ipAddress,
            metadata: { failedAttempts: state.failed_login_attempts },
          });
          throw new AuthError(
            `Account is locked until ${new Date(state.locked_until).toISOString()}`,
            423,
            "ACCOUNT_LOCKED"
          );
        }
        throw new AuthError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      await users.resetFailedLogins(user.id);
      await users.addAuditLog({
        userId: user.id,
        eventType: "USER_LOGGED_IN",
        ipAddress,
      });

      const publicUser = toPublicUser(user);
      return { user: publicUser, token: createAccessToken(publicUser) };
    },

    async confirmEmail(token) {
      let payload;
      try {
        payload = verifyToken(token, "email-confirmation");
      } catch {
        throw new AuthError("Confirmation link is invalid or expired", 400, "INVALID_TOKEN");
      }
      const user = await users.confirmEmail(payload.sub);
      if (!user) {
        throw new AuthError("Account not found", 404, "USER_NOT_FOUND");
      }
      return user;
    },
  };
}

module.exports = { AuthError, createAuthService };

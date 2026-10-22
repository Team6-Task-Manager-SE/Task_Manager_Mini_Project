const jwt = require("jsonwebtoken");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be configured");
  }
  return secret;
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role, type: "access" },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );
}

function createEmailConfirmationToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, type: "email-confirmation" },
    getSecret(),
    { expiresIn: "24h" }
  );
}

function verifyToken(token, expectedType) {
  const payload = jwt.verify(token, getSecret());
  if (payload.type !== expectedType) {
    throw new Error("Invalid token type");
  }
  return payload;
}

module.exports = {
  createAccessToken,
  createEmailConfirmationToken,
  verifyToken,
};

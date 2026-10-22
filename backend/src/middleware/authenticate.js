const { verifyToken } = require("../services/tokenService");

function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      status: "error",
      code: "AUTH_REQUIRED",
      message: "A valid bearer token is required",
    });
  }

  try {
    const payload = verifyToken(token, "access");
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({
      status: "error",
      code: "INVALID_TOKEN",
      message: "The access token is invalid or expired",
    });
  }
}

module.exports = authenticate;

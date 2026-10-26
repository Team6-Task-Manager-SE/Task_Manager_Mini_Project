function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource",
      });
    }

    return next();
  };
}

module.exports = authorizeRoles;

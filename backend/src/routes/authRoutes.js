const express = require("express");
const validateRequest = require("../middleware/validateRequest");
const authenticate = require("../middleware/authenticate");
const createAuthRateLimiter = require("../middleware/authRateLimiter");
const { registerRules, loginRules, confirmEmailRules } = require("../validators/authValidators");

function createAuthRouter({ controller, redisClient }) {
  const router = express.Router();
  router.use(createAuthRateLimiter(redisClient));

  router.post("/register", registerRules, validateRequest, controller.register);
  router.post("/login", loginRules, validateRequest, controller.login);
  router.get("/confirm-email", confirmEmailRules, validateRequest, controller.confirmEmail);
  router.get("/me", authenticate, controller.currentUser);

  return router;
}

module.exports = createAuthRouter;

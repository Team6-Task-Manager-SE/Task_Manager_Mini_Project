const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

function createAdminAnalyticsRouter({ analytics }) {
  if (!analytics || typeof analytics.getOverview !== "function") {
    throw new TypeError("An admin analytics repository is required");
  }

  const router = express.Router();
  router.use(authenticate, authorizeRoles("admin"));

  router.get("/analytics", async (req, res, next) => {
    try {
      const overview = await analytics.getOverview();
      return res.status(200).json({ status: "success", data: overview });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createAdminAnalyticsRouter;

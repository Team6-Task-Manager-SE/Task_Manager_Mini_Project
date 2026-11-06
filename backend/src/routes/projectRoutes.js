const express = require("express");
const { body } = require("express-validator");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const validateRequest = require("../middleware/validateRequest");

const createProjectRules = [
  body("name")
    .isString().withMessage("Project name must be a string")
    .bail().trim().notEmpty().withMessage("Project name is required")
    .bail().isLength({ max: 200 }).withMessage("Project name must be at most 200 characters"),
  body("description")
    .optional()
    .isString().withMessage("Project description must be a string")
    .bail().trim().isLength({ max: 5000 }).withMessage("Project description must be at most 5000 characters"),
];

function createProjectRouter({ projects }) {
  if (!projects || typeof projects.getAllForUser !== "function" || typeof projects.createForUser !== "function") {
    throw new TypeError("A project repository is required");
  }

  const router = express.Router();
  router.use(authenticate, authorizeRoles("user", "admin"));

  router.get("/", async (req, res, next) => {
    try {
      const data = await projects.getAllForUser(req.user.id);
      return res.status(200).json({ status: "success", data });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", createProjectRules, validateRequest, async (req, res, next) => {
    try {
      const data = await projects.createForUser({
        ownerId: req.user.id,
        name: req.body.name,
        description: req.body.description || "",
      });
      return res.status(201).json({
        status: "success",
        message: "Project created successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createProjectRouter;

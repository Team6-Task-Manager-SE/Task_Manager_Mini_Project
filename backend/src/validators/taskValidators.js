const { body } = require("express-validator");

const createTaskRules = [
  body("title")
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .bail()
    .isLength({ max: 200 })
    .withMessage("Title must be at most 200 characters"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description must be at most 5000 characters"),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date")
    .bail()
    .toDate(),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),

  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Tags must be an array of at most 10 items"),

  body("tags.*")
    .isString()
    .withMessage("Each tag must be a string")
    .bail()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Each tag must be at most 30 characters"),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .bail()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category must be at most 50 characters"),
];

const updateTaskRules = [
  body("title")
    .optional()
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be blank")
    .bail()
    .isLength({ max: 200 })
    .withMessage("Title must be at most 200 characters"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .bail()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description must be at most 5000 characters"),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date")
    .bail()
    .toDate(),

  body("status")
    .optional()
    .isIn(["todo", "in-progress", "completed"])
    .withMessage(
      "Status must be todo, in-progress, or completed"
    ),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("Priority must be low, medium, or high"),

  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Tags must be an array of at most 10 items"),

  body("tags.*")
    .isString()
    .withMessage("Each tag must be a string")
    .bail()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Each tag must be at most 30 characters"),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .bail()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category must be at most 50 characters"),
];

module.exports = {
  createTaskRules,
  updateTaskRules,
};
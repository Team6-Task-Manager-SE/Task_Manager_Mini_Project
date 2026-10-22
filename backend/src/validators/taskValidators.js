
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
];
module.exports = { createTaskRules };

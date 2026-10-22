const { body, query } = require("express-validator");

const registerRules = [
  body("name")
    .isString().withMessage("Name must be a string")
    .bail().trim().isLength({ min: 2, max: 120 })
    .withMessage("Name must be between 2 and 120 characters"),
  body("email")
    .isEmail().withMessage("A valid email address is required")
    .bail().normalizeEmail(),
  body("password")
    .isString().withMessage("Password must be a string")
    .bail().isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters")
    .matches(/[a-z]/).withMessage("Password must contain a lowercase letter")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain a number"),
];

const loginRules = [
  body("email")
    .isEmail().withMessage("A valid email address is required")
    .bail().normalizeEmail(),
  body("password").isString().notEmpty().withMessage("Password is required"),
];

const confirmEmailRules = [
  query("token").isString().notEmpty().withMessage("Confirmation token is required"),
];

module.exports = { registerRules, loginRules, confirmEmailRules };

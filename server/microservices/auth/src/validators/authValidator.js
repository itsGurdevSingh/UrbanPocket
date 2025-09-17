// src/validators/authValidator.js
import { body, validationResult } from 'express-validator';

export const validateRegistration = [
  // 1. Validation Rules
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),

  // 2. Validation Check
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
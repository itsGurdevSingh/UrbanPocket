// src/validators/authValidator.js
import { body, cookie, validationResult } from 'express-validator';

// 1. Create a reusable error handling function
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Refactor your validators to use the new function
export const validateRegistration = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  handleValidationErrors // <-- Use the reusable handler
];

export const validateLogin = [
  body('identifier').notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors // <-- Use the reusable handler
];

export const validateRefreshToken = [
  cookie('refreshToken').notEmpty().withMessage('Refresh token is required in cookies'),
  handleValidationErrors // <-- Use the reusable handler
];

export const validateAddAddress = [
  body('street').trim().notEmpty().withMessage('Street is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
  body('zipCode').trim().notEmpty().withMessage('Zip code is required'),
  handleValidationErrors // <-- Use the reusable handler
];

export const validateUpdateAddress = [
  body('addressId').trim().notEmpty().withMessage('Address ID is required'),
  body('addressData').isObject().withMessage('Address data must be an object'),
  body('addressData.street').optional().trim().notEmpty().withMessage('Street cannot be empty'),
  body('addressData.city').optional().trim().notEmpty().withMessage('City cannot be empty'),
  body('addressData.state').optional().trim().notEmpty().withMessage('State cannot be empty'),
  body('addressData.country').optional().trim().notEmpty().withMessage('Country cannot be empty'),
  body('addressData.zipCode').optional().trim().notEmpty().withMessage('Zip code cannot be empty'),
  handleValidationErrors // <-- Use the reusable handler
];

// Validator for deleting an address
export const validateDeleteAddress = [
  body('addressId')
    .trim()
    .notEmpty()
    .withMessage('Address ID is required')
    .isMongoId()
    .withMessage('Address ID must be a valid MongoDB id'),
  handleValidationErrors,
];
// src/validators/cart.validator.js
import { body, param } from 'express-validator';
import { handleValidationErrors } from './utils.js';

// Validator for adding item to cart
export const validateAddCartItem = [
    body('variantId')
        .trim()
        .notEmpty()
        .withMessage('Variant ID is required')
        .isMongoId()
        .withMessage('Variant ID must be a valid MongoDB ObjectId'),
    body('quantity')
        .optional()
        .isInt({ min: 1, max: 999 })
        .withMessage('Quantity must be an integer between 1 and 999'),
    handleValidationErrors
];

// Validator for updating cart item
export const validateUpdateCartItem = [
    param('itemId')
        .trim()
        .notEmpty()
        .withMessage('Item ID is required')
        .isMongoId()
        .withMessage('Item ID must be a valid MongoDB ObjectId'),
    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 0, max: 999 })
        .withMessage('Quantity must be an integer between 0 and 999'),
    handleValidationErrors
];

// Validator for removing cart item
export const validateRemoveCartItem = [
    param('itemId')
        .trim()
        .notEmpty()
        .withMessage('Item ID is required')
        .isMongoId()
        .withMessage('Item ID must be a valid MongoDB ObjectId'),
    handleValidationErrors
];

// src/validators/order.validator.js
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from './utils.js';

/**
 * Validator for creating an order
 * TODO: Customize based on your order creation requirements
 */
export const validateCreateOrder = [
    // TODO: Add validation rules for order creation
    // Example:
    // body('items')
    //     .isArray({ min: 1 })
    //     .withMessage('Items must be a non-empty array'),
    // body('items.*.variantId')
    //     .trim()
    //     .notEmpty()
    //     .withMessage('Variant ID is required')
    //     .isMongoId()
    //     .withMessage('Variant ID must be a valid MongoDB ObjectId'),
    // body('items.*.quantity')
    //     .isInt({ min: 1 })
    //     .withMessage('Quantity must be at least 1'),
    // body('shippingAddress.street')
    //     .trim()
    //     .notEmpty()
    //     .withMessage('Street address is required'),
    // ... add more fields as needed
    handleValidationErrors
];

/**
 * Validator for getting order by ID
 */
export const validateGetOrder = [
    param('orderId')
        .trim()
        .notEmpty()
        .withMessage('Order ID is required')
        .isMongoId()
        .withMessage('Order ID must be a valid MongoDB ObjectId'),
    handleValidationErrors
];

/**
 * Validator for updating order
 * TODO: Customize based on your order update requirements
 */
export const validateUpdateOrder = [
    param('orderId')
        .trim()
        .notEmpty()
        .withMessage('Order ID is required')
        .isMongoId()
        .withMessage('Order ID must be a valid MongoDB ObjectId'),
    // TODO: Add validation rules for fields that can be updated
    // Example:
    // body('status')
    //     .optional()
    //     .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    //     .withMessage('Invalid order status'),
    handleValidationErrors
];

/**
 * Validator for query parameters (filtering, pagination, etc.)
 */
export const validateOrderQuery = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('status')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Status cannot be empty if provided'),
    // TODO: Add more query parameter validations as needed
    handleValidationErrors
];

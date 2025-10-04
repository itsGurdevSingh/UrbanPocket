import { body, param, validationResult } from 'express-validator';
import { ApiError } from '../utils/errors.js';

/**
 * Product validator
 */

// Validation rules for creating a product
export const createProductValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 150 })
        .withMessage('Product name must be between 2 and 150 characters'),
    body('description')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Description must be between 10 and 2000 characters'),
    body('categoryId')
        .isMongoId()
        .withMessage('Invalid category ID format'),
    body('brand')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Brand name cannot exceed 50 characters'),
    body('attributes')
        .isArray({ min: 1 })
        .withMessage('At least one attribute is required'),
    body('baseImages')
        .optional()
        .isArray()
        .withMessage('Base images must be an array'),
];

// Validation rules for updating a product
export const updateProductValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid product ID format'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 150 })
        .withMessage('Product name must be between 2 and 150 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Description must be between 10 and 2000 characters'),
    body('categoryId')
        .optional()
        .isMongoId()
        .withMessage('Invalid category ID format'),
    body('brand')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Brand name cannot exceed 50 characters'),
];

// Validation rules for getting by ID
export const getByIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid product ID format'),
];

/**
 * Middleware to handle validation results
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorDetails = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));

        throw new ApiError('Validation failed', {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: errorDetails
        });
    }
    next();
};
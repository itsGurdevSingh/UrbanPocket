import { body, param, validationResult } from 'express-validator';
import { ApiError } from '../utils/errors.js';

/**
 * Sample validator template
 * Replace 'Sample' with your actual validator name
 */

// Validation rules for creating a sample
export const createSampleValidation = [
    // TODO: Add your validation rules here
    // Example:
    // body('name')
    //     .trim()
    //     .isLength({ min: 2, max: 50 })
    //     .withMessage('Name must be between 2 and 50 characters'),
    // body('email')
    //     .isEmail()
    //     .withMessage('Please provide a valid email address')
    //     .normalizeEmail(),
];

// Validation rules for updating a sample
export const updateSampleValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ID format'),
    // TODO: Add your validation rules here (similar to create but make fields optional)
];

// Validation rules for getting by ID
export const getByIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ID format'),
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
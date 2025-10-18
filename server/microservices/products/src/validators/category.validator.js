import { body, param, query } from 'express-validator';
import { handleValidationErrors } from './utils.js';

export const createCategoryValidation = [
    body('name').isString().isLength({ min: 1, max: 50 }).trim().withMessage('name is required and must be 1-50 chars'),
    body('description').optional().isString().isLength({ max: 500 }).trim(),
    body('parentCategory').optional({ nullable: true }).isMongoId().withMessage('parentCategory must be a valid ObjectId'),
    handleValidationErrors,
];

export const updateCategoryValidation = [
    param('id').isMongoId().withMessage('Invalid category ID format'),
    body('name').optional().isString().isLength({ min: 1, max: 50 }).trim().withMessage('name must be 1-50 chars'),
    body('description').optional().isString().isLength({ max: 500 }).trim(),
    body('parentCategory').optional({ nullable: true }).isMongoId().withMessage('parentCategory must be a valid ObjectId'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    handleValidationErrors,
];

export const categoryIdValidation = [
    param('id').isMongoId().withMessage('Invalid category ID format'),
    handleValidationErrors,
];

export const getAllCategoriesValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('parentCategory')
        .optional()
        .custom((value) => {
            // Allow 'null' as a string for top-level categories
            if (value === 'null') return true;
            // Otherwise, must be a valid MongoDB ObjectId
            return /^[a-f\d]{24}$/i.test(value);
        })
        .withMessage('parentCategory must be a valid ObjectId or "null"'),
    query('q').optional().isString().trim().withMessage('q must be a string'),
    handleValidationErrors,
];
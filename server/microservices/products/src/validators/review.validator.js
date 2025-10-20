import { body, param, query } from 'express-validator';
import { handleValidationErrors } from './utils.js';

export const createReviewValidation = [
    body('product')
        .isMongoId()
        .withMessage('product must be a valid ObjectId'),
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('rating must be an integer between 1 and 5'),
    body('comment')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('comment must be a string with maximum 1000 characters'),
    handleValidationErrors,
];

export const updateReviewValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    body('rating')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('rating must be an integer between 1 and 5'),
    body('comment')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('comment must be a string with maximum 1000 characters'),
    handleValidationErrors,
];

export const reviewIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid review ID format'),
    handleValidationErrors,
];

export const productIdValidation = [
    param('productId')
        .isMongoId()
        .withMessage('Invalid product ID format'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('limit must be between 1 and 100'),
    handleValidationErrors,
];

export const getAllReviewsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('limit must be between 1 and 100'),
    handleValidationErrors,
];

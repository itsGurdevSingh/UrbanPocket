import { body, param } from 'express-validator';
import { handleValidationErrors } from './utils.js';

// Helper to validate that options is a non-empty object of string values
const optionsValidator = body('options')
    .custom(val => {
        if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
        return Object.values(val).every(v => typeof v === 'string' && v.trim().length > 0);
    })
    .withMessage('options must be an object with non-empty string values');

export const createVariantValidation = [
    body('productId').isMongoId().withMessage('Invalid product ID format'),
    body('sku').optional().isString().trim().isLength({ max: 120 }).withMessage('SKU must be at most 120 characters'),
    optionsValidator,
    body('price').isFloat({ gt: 0 }).withMessage('price must be > 0'),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }).withMessage('currency must be a 3-letter code')
        .matches(/^[A-Za-z]{3}$/).withMessage('currency must contain only letters')
        .customSanitizer(v => (v || 'INR').toUpperCase()),
    body('stock').isInt({ min: 0 }).withMessage('stock must be a non-negative integer'),
    body('baseUnit').isString().trim().notEmpty().withMessage('baseUnit is required'),
    body('variantImages').optional().isArray().withMessage('variantImages must be an array'),
    body('variantImages.*.url').optional().isString().trim().notEmpty().withMessage('variantImages[].url must be non-empty'),
    body('variantImages.*.altText').optional().isString().isLength({ max: 150 }).withMessage('variantImages[].altText max 150 chars'),
    body('isActive').optional().isBoolean().toBoolean(),
    handleValidationErrors,
];

export const updateVariantValidation = [
    param('id').isMongoId().withMessage('Invalid variant ID format'),
    body('sku').optional().isString().trim().isLength({ max: 120 }).withMessage('SKU must be at most 120 characters'),
    body('price').optional().isFloat({ gt: 0 }).withMessage('price must be > 0'),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }).withMessage('currency must be a 3-letter code')
        .matches(/^[A-Za-z]{3}$/).withMessage('currency must contain only letters')
        .customSanitizer(v => (v || 'INR').toUpperCase()),
    body('stock').optional().isInt({ min: 0 }).withMessage('stock must be a non-negative integer'),
    optionsValidator.optional(),
    body('baseUnit').optional().isString().trim().notEmpty().withMessage('baseUnit cannot be empty'),
    body('variantImages').optional().isArray().withMessage('variantImages must be an array'),
    body('variantImages.*.url').optional().isString().trim().notEmpty().withMessage('variantImages[].url must be non-empty'),
    body('variantImages.*.altText').optional().isString().isLength({ max: 150 }).withMessage('variantImages[].altText max 150 chars'),
    body('isActive').optional().isBoolean().toBoolean(),
    handleValidationErrors,
];

export const getVariantByIdValidation = [
    param('id').isMongoId().withMessage('Invalid variant ID format'),
    handleValidationErrors,
];

export const deleteVariantValidation = [
    param('id').isMongoId().withMessage('Invalid variant ID format'),
    handleValidationErrors,
];


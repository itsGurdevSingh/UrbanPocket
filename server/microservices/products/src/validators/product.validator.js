import { body, param, query, validationResult } from 'express-validator';
import { ApiError } from '../utils/errors.js';

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

/**
 * Product validators based on product model definition
 * Required fields (logical/business): name, description, sellerId, categoryId, attributes[]
 * Images (baseImages) will be derived from uploaded files in service layer; either files or baseImages must exist.
 * Optional fields: brand, baseImages[].altText, isActive
 */

// Helper to ensure attributes array has at least one non-empty string
const attributesValidation = body('attributes')
    .isArray({ min: 1 }).withMessage('attributes must be a non-empty array of strings')
    .bail()
    .custom((arr) => arr.every(v => typeof v === 'string' && v.trim().length > 0))
    .withMessage('Each attribute must be a non-empty string');

// Helper for baseImages
// Base images validation (used for update or if client supplies explicit URLs) - optional in create
export const baseImagesValidation = body('baseImages')
    .optional()
    .isArray({ min: 1 }).withMessage('baseImages must be a non-empty array')
    .bail()
    .custom((arr) => arr.every(img => img && typeof img === 'object' && typeof img.url === 'string' && img.url.trim().length > 0))
    .withMessage('Each base image must have a non-empty url string');

export const createProductValidation = [
    body('name')
        .exists({ checkFalsy: true }).withMessage('name is required')
        .isString().withMessage('name must be a string')
        .trim()
        .isLength({ min: 2, max: 150 }).withMessage('name must be between 2 and 150 characters'),
    body('description')
        .exists({ checkFalsy: true }).withMessage('description is required')
        .isString().withMessage('description must be a string')
        .trim()
        .isLength({ min: 5, max: 2000 }).withMessage('description must be between 5 and 2000 characters'),
    body('brand')
        .optional({ nullable: true })
        .isString().withMessage('brand must be a string')
        .trim()
        .isLength({ max: 50 }).withMessage('brand must be at most 50 characters'),
    body('sellerId')
        .exists({ checkFalsy: true }).withMessage('sellerId is required')
        .isMongoId().withMessage('sellerId must be a valid Mongo ID'),
    body('categoryId')
        .exists({ checkFalsy: true }).withMessage('categoryId is required')
        .isMongoId().withMessage('categoryId must be a valid Mongo ID'),
    attributesValidation,
    baseImagesValidation, // optional at create time now
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be boolean')
        .toBoolean(),

    // validation errors are handled here
    handleValidationErrors,
];

export const updateProductValidation = [
    param('id')
        .isMongoId().withMessage('Invalid product id'),
    body('name')
        .optional()
        .isString().withMessage('name must be a string')
        .trim()
        .isLength({ min: 2, max: 150 }).withMessage('name must be between 2 and 150 characters'),
    body('description')
        .optional()
        .isString().withMessage('description must be a string')
        .trim()
        .isLength({ min: 5, max: 2000 }).withMessage('description must be between 5 and 2000 characters'),
    body('brand')
        .optional({ nullable: true })
        .isString().withMessage('brand must be a string')
        .trim()
        .isLength({ max: 50 }).withMessage('brand must be at most 50 characters'),
    body('sellerId')
        .optional()
        .isMongoId().withMessage('sellerId must be a valid Mongo ID'),
    body('categoryId')
        .optional()
        .isMongoId().withMessage('categoryId must be a valid Mongo ID'),
    body('attributes')
        .optional()
        .isArray({ min: 1 }).withMessage('attributes must be a non-empty array of strings')
        .bail()
        .custom((arr) => arr.every(v => typeof v === 'string' && v.trim().length > 0))
        .withMessage('Each attribute must be a non-empty string'),
    body('baseImages')
        .optional()
        .isArray({ min: 1 }).withMessage('baseImages must be a non-empty array')
        .bail()
        .custom((arr) => arr.every(img => img && typeof img === 'object' && typeof img.url === 'string' && img.url.trim().length > 0))
        .withMessage('Each base image must have a non-empty url string'),
    body('baseImages.*.url')
        .optional()
        .isString().withMessage('baseImages.url must be a string')
        .trim()
        .notEmpty().withMessage('baseImages.url cannot be empty'),
    body('baseImages.*.altText')
        .optional({ nullable: true })
        .isString().withMessage('baseImages.altText must be a string')
        .trim()
        .isLength({ max: 150 }).withMessage('baseImages.altText must be at most 150 characters'),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be boolean')
        .toBoolean(),

    handleValidationErrors,
];

export const getSellersProductValidation = [
    param('sellerId').isMongoId().withMessage('Invalid seller ID format'),
    handleValidationErrors,
]

export const getByIdValidation = [
    param('id').isMongoId().withMessage('Invalid ID format'),
    handleValidationErrors,
];

export const deleteProductValidation = [
    param('id').isMongoId().withMessage('Invalid product ID format'),
    handleValidationErrors,
];

// Validation for GET /getAll with pagination & filtering
export const getAllProductsValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
    query('categoryId').optional().isMongoId().withMessage('categoryId must be a valid Mongo ID'),
    query('sellerId').optional().isMongoId().withMessage('sellerId must be a valid Mongo ID'),
    query('brand').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('brand must be 1-50 chars'),
    query('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),
    query('ids').optional().custom(value => {
        const parts = value.split(',').map(v => v.trim()).filter(Boolean);
        if (!parts.length) throw new Error('ids cannot be empty');
        const mongoIdRegex = /^[a-fA-F0-9]{24}$/;
        if (!parts.every(p => mongoIdRegex.test(p))) throw new Error('ids must be valid Mongo IDs');
        return true;
    }),
    query('q').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('q must be 1-100 chars'),
    query('sort').optional().custom(val => {
        const allowed = new Set(['createdAt', 'updatedAt', 'name', 'brand', '-createdAt', '-updatedAt', '-name', '-brand']);
        const parts = val.split(',');
        if (!parts.every(p => allowed.has(p))) throw new Error('Invalid sort field');
        return true;
    }),
    query('fields').optional().custom(val => {
        const allowed = new Set(['name', 'brand', 'sellerId', 'categoryId', 'isActive', 'createdAt', 'updatedAt']);
        const parts = val.split(',');
        if (!parts.every(p => allowed.has(p))) throw new Error('Invalid fields selection');
        return true;
    }),
    // date ranges
    query('createdFrom').optional().isISO8601().toDate(),
    query('createdTo').optional().isISO8601().toDate(),
    query('updatedFrom').optional().isISO8601().toDate(),
    query('updatedTo').optional().isISO8601().toDate(),
    // cross-field validation
    (req, _res, next) => {
        const { createdFrom, createdTo, updatedFrom, updatedTo } = req.query;
        if (createdFrom && createdTo && createdFrom > createdTo) {
            return next(new ApiError('createdFrom must be <= createdTo', { statusCode: 400, code: 'VALIDATION_ERROR', details: [{ field: 'createdFrom', message: 'createdFrom must be <= createdTo' }] }));
        }
        if (updatedFrom && updatedTo && updatedFrom > updatedTo) {
            return next(new ApiError('updatedFrom must be <= updatedTo', { statusCode: 400, code: 'VALIDATION_ERROR', details: [{ field: 'updatedFrom', message: 'updatedFrom must be <= updatedTo' }] }));
        }
        next();
    },
    handleValidationErrors,
];

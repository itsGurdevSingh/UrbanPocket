import { body, param, query } from 'express-validator';
import { handleValidationErrors } from './utils.js';
import { ApiError } from '../utils/errors.js';

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


// Validate params for single image update
export const updateVariantImageValidation = [
    param('id').isMongoId().withMessage('Invalid variant ID format'),
    // fileId typically comes from external provider (e.g., ImageKit), so just ensure non-empty string
    param('fileId').isString().trim().notEmpty().withMessage('fileId is required'),
    handleValidationErrors,
];

// Validation for GET /getAll with pagination & filtering
export const getAllVariantsValidation = [
    // pagination
    query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),

    // direct variant field filters
    query('productId').optional().isMongoId().withMessage('productId must be a valid Mongo ID'),
    query('sku').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('sku must be 1-120 chars'),
    query('currency')
        .optional()
        .isString().trim().isLength({ min: 3, max: 3 }).withMessage('currency must be a 3-letter code')
        .matches(/^[A-Za-z]{3}$/).withMessage('currency must contain only letters')
        .customSanitizer(v => (v || 'INR').toUpperCase()),
    query('baseUnit').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('baseUnit must be 1-50 chars'),
    query('isActive').optional().isBoolean().withMessage('isActive must be boolean').toBoolean(),

    // numeric ranges
    query('priceMin').optional().isFloat({ min: 0 }).withMessage('priceMin must be >= 0').toFloat(),
    query('priceMax').optional().isFloat({ min: 0 }).withMessage('priceMax must be >= 0').toFloat(),
    query('stockMin').optional().isInt({ min: 0 }).withMessage('stockMin must be >= 0').toInt(),
    query('stockMax').optional().isInt({ min: 0 }).withMessage('stockMax must be >= 0').toInt(),

    // ids CSV
    query('ids').optional().custom(value => {
        const parts = value.split(',').map(v => v.trim()).filter(Boolean);
        if (!parts.length) throw new Error('ids cannot be empty');
        const mongoIdRegex = /^[a-fA-F0-9]{24}$/;
        if (!parts.every(p => mongoIdRegex.test(p))) throw new Error('ids must be valid Mongo IDs');
        return true;
    }),

    // free-text query (e.g., search by sku/options)
    query('q').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('q must be 1-100 chars'),

    // projection & sorting
    query('sort').optional().custom(val => {
        const allowed = new Set([
            'createdAt', 'updatedAt', 'price', 'stock', 'sku', 'currency', 'isActive',
            '-createdAt', '-updatedAt', '-price', '-stock', '-sku', '-currency', '-isActive',
        ]);
        const parts = val.split(',');
        if (!parts.every(p => allowed.has(p))) throw new Error('Invalid sort field');
        return true;
    }),
    query('fields').optional().custom(val => {
        const allowed = new Set([
            'productId', 'sku', 'options', 'price', 'currency', 'stock', 'baseUnit', 'isActive', 'createdAt', 'updatedAt', 'variantImages',
        ]);
        const parts = val.split(',');
        if (!parts.every(p => allowed.has(p))) throw new Error('Invalid fields selection');
        return true;
    }),

    // date ranges
    query('createdFrom').optional().isISO8601().toDate(),
    query('createdTo').optional().isISO8601().toDate(),
    query('updatedFrom').optional().isISO8601().toDate(),
    query('updatedTo').optional().isISO8601().toDate(),

    // options filter as JSON (e.g., ?options={"Color":"Red","Size":"M"})
    query('options').optional().custom(val => {
        try {
            const obj = typeof val === 'string' ? JSON.parse(val) : val;
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('options must be an object');
            const allStr = Object.values(obj).every(v => typeof v === 'string' && v.trim().length > 0);
            if (!allStr) throw new Error('options values must be non-empty strings');
            return true;
        } catch (e) {
            throw new Error('options must be valid JSON object of key->string');
        }
    }),

    // product-populated filters (via populate on productId)
    query('sellerId').optional().isMongoId().withMessage('sellerId must be a valid Mongo ID'),
    query('categoryId').optional().isMongoId().withMessage('categoryId must be a valid Mongo ID'),
    query('brand').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('brand must be 1-50 chars'),
    query('productIsActive').optional().isBoolean().withMessage('productIsActive must be boolean').toBoolean(),

    // cross-field validation
    (req, _res, next) => {
        const { priceMin, priceMax, stockMin, stockMax, createdFrom, createdTo, updatedFrom, updatedTo } = req.query;
        if (priceMin != null && priceMax != null && Number(priceMin) > Number(priceMax)) {
            return next(new ApiError('priceMin must be <= priceMax', { statusCode: 400, code: 'VALIDATION_ERROR', details: [{ field: 'priceMin', message: 'priceMin must be <= priceMax' }] }));
        }
        if (stockMin != null && stockMax != null && Number(stockMin) > Number(stockMax)) {
            return next(new ApiError('stockMin must be <= stockMax', { statusCode: 400, code: 'VALIDATION_ERROR', details: [{ field: 'stockMin', message: 'stockMin must be <= stockMax' }] }));
        }
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


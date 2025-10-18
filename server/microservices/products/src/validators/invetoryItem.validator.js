import { body, param, query } from "express-validator";
import { handleValidationErrors } from "./utils";

export const createInventoryItemValidation = [
    body('variantId')
        .exists({ checkFalsy: true }).withMessage('variantId is required')
        .isMongoId().withMessage('variantId must be a valid Mongo ID'),
    body('batchNumber')
        .optional({ nullable: true })
        .isString().withMessage('batchNumber must be a string')
        .trim()
        .isLength({ max: 100 }).withMessage('batchNumber must be at most 100 characters'),
    body('stock')
        .exists().withMessage('stock is required')
        .isFloat({ min: 0 }).withMessage('stock must be a non-negative number')
        .toFloat(),
    body('price.amount')
        .exists().withMessage('price.amount is required')
        .isFloat({ min: 0 }).withMessage('price.amount must be a non-negative number')
        .toFloat(),
    body('price.currency')
        .exists({ checkFalsy: true }).withMessage('price.currency is required')
        .isString().withMessage('price.currency must be a string')
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('price.currency must be a 3-letter currency code'),
    body('manufacturingDetails.mfgDate')
        .optional()
        .isISO8601().withMessage('manufacturingDetails.mfgDate must be a valid date')
        .toDate(),
    body('manufacturingDetails.expDate')
        .optional()
        .isISO8601().withMessage('manufacturingDetails.expDate must be a valid date')
        .toDate(),
    body('hsnCode')
        .optional({ nullable: true })
        .isString().withMessage('hsnCode must be a string')
        .trim()
        .isLength({ max: 20 }).withMessage('hsnCode must be at most 20 characters'),
    body('gstPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('gstPercentage must be between 0 and 100')
        .toFloat(),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be boolean')
        .toBoolean(),
    // validation errors are handled here
    handleValidationErrors,
];

export const inventoryItemIdValidation = [
    param('id')
        .exists({ checkFalsy: true }).withMessage('Inventory item ID is required')
        .isMongoId().withMessage('Inventory item ID must be a valid Mongo ID'),
    // validation errors are handled here
    handleValidationErrors,
];

export const updateInventoryItemValidation = [
    param('id')
        .exists({ checkFalsy: true }).withMessage('Inventory item ID is required')
        .isMongoId().withMessage('Inventory item ID must be a valid Mongo ID'),

    body('batchNumber')
        .optional({ nullable: true })
        .isString().withMessage('batchNumber must be a string')
        .trim()
        .isLength({ max: 100 }).withMessage('batchNumber must be at most 100 characters'),
    body('stock')
        .optional()
        .isFloat({ min: 0 }).withMessage('stock must be a non-negative number')
        .toFloat(),
    body('price.amount')
        .optional()
        .isFloat({ min: 0 }).withMessage('price.amount must be a non-negative number')
        .toFloat(),
    body('price.currency')
        .optional({ nullable: true })
        .isString().withMessage('price.currency must be a string')
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('price.currency must be a 3-letter currency code'),
    body('manufacturingDetails.mfgDate')
        .optional()
        .isISO8601().withMessage('manufacturingDetails.mfgDate must be a valid date')
        .toDate(),
    body('manufacturingDetails.expDate')
        .optional()
        .isISO8601().withMessage('manufacturingDetails.expDate must be a valid date')
        .toDate(),
    body('hsnCode')
        .optional({ nullable: true })
        .isString().withMessage('hsnCode must be a string')
        .trim()
        .isLength({ max: 20 }).withMessage('hsnCode must be at most 20 characters'),
    body('gstPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('gstPercentage must be between 0 and 100')
        .toFloat(),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be boolean')
        .toBoolean(),
    // validation errors are handled here
    handleValidationErrors,
];

export const getAllInventoryItemsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('page must be a positive integer')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
        .toInt(),
    query('sortBy')
        .optional()
        .isIn(['price', 'stock', 'createdAt', 'updatedAt', 'expDate', 'mfgDate'])
        .withMessage('sortBy must be one of: price, stock, createdAt, updatedAt, expDate, mfgDate'),
    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('sortOrder must be either asc or desc'),
    query('variantId')
        .optional()
        .isMongoId().withMessage('variantId must be a valid Mongo ID'),
    query('batchNumber')
        .optional()
        .isString().withMessage('batchNumber must be a string')
        .trim(),
    query('isActive')
        .optional()
        .isIn(['true', 'false']).withMessage('isActive must be true or false'),
    query('inStock')
        .optional()
        .isIn(['true', 'false']).withMessage('inStock must be true or false'),
    query('minPrice')
        .optional()
        .isFloat({ min: 0 }).withMessage('minPrice must be a non-negative number')
        .toFloat(),
    query('maxPrice')
        .optional()
        .isFloat({ min: 0 }).withMessage('maxPrice must be a non-negative number')
        .toFloat(),
    query('minStock')
        .optional()
        .isFloat({ min: 0 }).withMessage('minStock must be a non-negative number')
        .toFloat(),
    query('maxStock')
        .optional()
        .isFloat({ min: 0 }).withMessage('maxStock must be a non-negative number')
        .toFloat(),
    query('mfgDateFrom')
        .optional()
        .isISO8601().withMessage('mfgDateFrom must be a valid ISO date'),
    query('mfgDateTo')
        .optional()
        .isISO8601().withMessage('mfgDateTo must be a valid ISO date'),
    query('expDateFrom')
        .optional()
        .isISO8601().withMessage('expDateFrom must be a valid ISO date'),
    query('expDateTo')
        .optional()
        .isISO8601().withMessage('expDateTo must be a valid ISO date'),
    query('excludeExpired')
        .optional()
        .isIn(['true', 'false']).withMessage('excludeExpired must be true or false'),
    query('productName')
        .optional()
        .isString().withMessage('productName must be a string')
        .trim(),
    query('sku')
        .optional()
        .isString().withMessage('sku must be a string')
        .trim(),
    query('sellerId')
        .optional()
        .isMongoId().withMessage('sellerId must be a valid Mongo ID'),
    // validation errors are handled here
    handleValidationErrors,
];
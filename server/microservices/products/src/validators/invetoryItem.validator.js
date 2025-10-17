import { body, param } from "express-validator";
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
    body('stockInBaseUnits')
        .exists().withMessage('stockInBaseUnits is required')
        .isFloat({ min: 0 }).withMessage('stockInBaseUnits must be a non-negative number')
        .toFloat(),
    body('pricePerBaseUnit.amount')
        .exists().withMessage('pricePerBaseUnit.amount is required')
        .isFloat({ min: 0 }).withMessage('pricePerBaseUnit.amount must be a non-negative number')
        .toFloat(),
    body('pricePerBaseUnit.currency')
        .exists({ checkFalsy: true }).withMessage('pricePerBaseUnit.currency is required')
        .isString().withMessage('pricePerBaseUnit.currency must be a string')
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('pricePerBaseUnit.currency must be a 3-letter currency code'),
    body('status')
        .optional()
        .isIn(['Sealed', 'Unsealed']).withMessage('status must be either Sealed or Unsealed'),
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
    body('stockInBaseUnits')
        .optional()
        .isFloat({ min: 0 }).withMessage('stockInBaseUnits must be a non-negative number')
        .toFloat(),
    body('pricePerBaseUnit.amount')
        .optional()
        .isFloat({ min: 0 }).withMessage('pricePerBaseUnit.amount must be a non-negative number')
        .toFloat(),
    body('pricePerBaseUnit.currency')
        .optional({ nullable: true })
        .isString().withMessage('pricePerBaseUnit.currency must be a string')
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('pricePerBaseUnit.currency must be a 3-letter currency code'),
    body('status')
        .optional()
        .isIn(['Sealed', 'Unsealed']).withMessage('status must be either Sealed or Unsealed'),
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
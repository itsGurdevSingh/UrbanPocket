import { validationResult, param } from "express-validator";
import { ApiError } from "../utils/errors.js";

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

export const mongoIdValidation = [
    param('id').isMongoId().withMessage('Invalid product ID format'),
    handleValidationErrors,
];
import { body } from 'express-validator';
import { handleValidationErrors } from './utils.js';

export const createCategoryValidation = [
    body('name').isString().isLength({ min: 1, max: 50 }).trim().withMessage('name is required and must be 1-50 chars'),
    body('description').optional().isString().isLength({ max: 500 }).trim(),
    body('parentCategory').optional({ nullable: true }).isMongoId().withMessage('parentCategory must be a valid ObjectId'),
    handleValidationErrors,
];

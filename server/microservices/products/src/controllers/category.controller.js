import categoryService from '../services/category.service.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ApiResponse } from '../utils/success.js';

class categoryController {
    async createCategory(req, res, next) {
        try {
            const created = await categoryService.createCategory(req.body, req.user);
            res.status(201).json(new ApiResponse(created, 'Category created successfully'));
        } catch (error) {
            logger.error('Error creating category:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to create category', { statusCode: 500, code: 'CREATE_CATEGORY_ERROR', details: error.message }));
        }
    }
}

export default new categoryController();

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

    async getCategoryById(req, res, next) {
        try {
            const categoryId = req.params.id;
            const category = await categoryService.getCategoryById(categoryId);
            res.status(200).json(new ApiResponse(category, 'Category fetched successfully'));
        } catch (error) {
            logger.error('Error fetching category by ID:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to fetch category', { statusCode: 500, code: 'FETCH_CATEGORY_ERROR', details: error.message }));
        }
    }

    async updateCategory(req, res, next) {
        try {
            const categoryId = req.params.id;
            const updated = await categoryService.updateCategory(categoryId, req.body, req.user);
            res.status(200).json(new ApiResponse(updated, 'Category updated successfully'));
        } catch (error) {
            logger.error('Error updating category:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to update category', { statusCode: 500, code: 'UPDATE_CATEGORY_ERROR', details: error.message }));
        }
    }

    async deleteCategory(req, res, next) {
        try {
            const categoryId = req.params.id;
            await categoryService.deleteCategory(categoryId, req.user);
            res.status(200).json(new ApiResponse(null, 'Category deleted successfully'));
        } catch (error) {
            logger.error('Error deleting category:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to delete category', { statusCode: 500, code: 'DELETE_CATEGORY_ERROR', details: error.message }));
        }
    }

    async disableCategory(req, res, next) {
        try {
            const categoryId = req.params.id;
            const category = await categoryService.disableCategory(categoryId, req.user);
            res.status(200).json(new ApiResponse(category, 'Category disabled successfully'));
        } catch (error) {
            logger.error('Error disabling category:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to disable category', { statusCode: 500, code: 'DISABLE_CATEGORY_ERROR', details: error.message }));
        }
    }

    async enableCategory(req, res, next) {
        try {
            const categoryId = req.params.id;
            const category = await categoryService.enableCategory(categoryId, req.user);
            res.status(200).json(new ApiResponse(category, 'Category enabled successfully'));
        } catch (error) {
            logger.error('Error enabling category:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to enable category', { statusCode: 500, code: 'ENABLE_CATEGORY_ERROR', details: error.message }));
        }
    }

    async getAllCategories(req, res, next) {
        try {
            const result = await categoryService.getAllCategories(req.query);
            res.status(200).json(new ApiResponse(result, 'Categories fetched successfully'));
        } catch (error) {
            logger.error('Error fetching all categories:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to fetch categories', { statusCode: 500, code: 'FETCH_CATEGORIES_ERROR', details: error.message }));
        }
    }
}

export default new categoryController();
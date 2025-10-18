import categoryRepository from '../repositories/category.repository.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

class categoryService {
    async createCategory(categoryData, currentUser) {
        try {
            // Only admin can set parentCategory arbitrarily; sellers may create top-level categories? We'll allow both for now but enforce uniqueness.
            const existing = await categoryRepository.findOne({ name: categoryData.name });
            if (existing) {
                throw new ApiError('Category name must be unique', { statusCode: 400, code: 'DUPLICATE_CATEGORY_NAME' });
            }

            const doc = {
                name: categoryData.name,
                description: categoryData.description || '',
                parentCategory: categoryData.parentCategory || null,
            };

            const created = await categoryRepository.create(doc);
            return created;
        } catch (error) {
            logger.error('Error creating category:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to create category', { statusCode: 500, code: 'CREATE_CATEGORY_FAILED', details: error.message });
        }
    }

    async getCategoryById(categoryId) {
        try {
            const category = await categoryRepository.findById(categoryId);
            return category;
        } catch (error) {
            logger.error('Error fetching category by ID:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch category', { statusCode: 500, code: 'FETCH_CATEGORY_FAILED', details: error.message });
        }
    }

    async updateCategory(categoryId, updateData, currentUser) {
        try {
            // Fetch existing category
            const existing = await categoryRepository.findById(categoryId);

            // If name is changing, check uniqueness
            if (updateData.name && updateData.name !== existing.name) {
                const nameConflict = await categoryRepository.findOne({ name: updateData.name });
                if (nameConflict) {
                    throw new ApiError('Category name must be unique', { statusCode: 400, code: 'DUPLICATE_CATEGORY_NAME' });
                }
            }

            // Update category
            const updated = await categoryRepository.updateById(categoryId, updateData);
            return updated;
        } catch (error) {
            logger.error('Error updating category:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update category', { statusCode: 500, code: 'UPDATE_CATEGORY_FAILED', details: error.message });
        }
    }

    async deleteCategory(categoryId, currentUser) {
        try {
            // Check if category exists
            await categoryRepository.findById(categoryId);

            // Delete the category
            await categoryRepository.deleteById(categoryId);
            return true;
        } catch (error) {
            logger.error('Error deleting category:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to delete category', { statusCode: 500, code: 'DELETE_CATEGORY_FAILED', details: error.message });
        }
    }
}

export default new categoryService();
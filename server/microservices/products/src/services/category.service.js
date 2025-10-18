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
}

export default new categoryService();

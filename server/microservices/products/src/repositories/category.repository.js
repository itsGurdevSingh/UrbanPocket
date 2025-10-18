import Category from '../models/category.model.js';
import { ApiError } from '../utils/errors.js';

class CategoryRepository {
    constructor() {
        this.model = Category;
    }

    async findAll() {
        return await Category.find({});
    }

    async findOne(filter) {
        return await Category.findOne(filter).lean();
    }

    async findById(id) {
        const item = await Category.findById(id);
        if (!item) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }
        return item;
    }

    async create(data) {
        return await Category.create(data);
    }

    async updateById(id, data) {
        const item = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!item) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }
        return item;
    }

    async deleteById(id) {
        const item = await Category.findByIdAndDelete(id);
        if (!item) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }
        return item;
    }
}

export default new CategoryRepository();

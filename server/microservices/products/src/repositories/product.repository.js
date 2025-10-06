import product from '../models/product.model.js';
import { ApiError } from '../utils/errors.js';

class productRepository {
    async findAll() {
        return await product.find({});
    }

    async findById(id) {
        const item = await product.findById(id);
        if (!item) {
            throw new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
        }
        return item;
    }

    async create(data) {
        return await product.create(data);
    }

    async updateById(id, data) {
        const item = await product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!item) {
            throw new ApiError('product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
        }
        return item;
    }

    async deleteById(id) {
        const item = await product.findByIdAndDelete(id);
        if (!item) {
            throw new ApiError('product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
        }
        return item;
    }

    // Add custom query methods as needed
    async findByCustomField(value) {
        return await product.find({ customField: value });
    }

    async findByName(name) {
        return await product.findOne({ name: name });
    } 
}

export default new productRepository();
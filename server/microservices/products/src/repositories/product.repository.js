import Product from '../models/product.model.js';
import { ApiError } from '../utils/errors.js';

class ProductRepository {
    async findAll() {
        return await Product.find({ isActive: true }).populate('categoryId');
    }

    async findById(id) {
        const product = await Product.findById(id).populate('categoryId');
        if (!product) {
            throw new ApiError('Product not found', { statusCode: 404, code: 'NOT_FOUND' });
        }
        return product;
    }

    async create(data) {
        return await Product.create(data);
    }

    async updateById(id, data) {
        const product = await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!product) {
            throw new ApiError('Product not found', { statusCode: 404, code: 'NOT_FOUND' });
        }
        return product;
    }

    async deleteById(id) {
        const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
        if (!product) {
            throw new ApiError('Product not found', { statusCode: 404, code: 'NOT_FOUND' });
        }
        return product;
    }

    // Add custom query methods as needed
    async findBySellerId(sellerId) {
        return await Product.find({ sellerId, isActive: true }).populate('categoryId');
    }

    async findByCategory(categoryId) {
        return await Product.find({ categoryId, isActive: true }).populate('categoryId');
    }

    async findByBrand(brand) {
        return await Product.find({ brand, isActive: true }).populate('categoryId');
    }

    async searchProducts(searchTerm) {
        return await Product.find({
            $text: { $search: searchTerm },
            isActive: true
        }).populate('categoryId');
    }
}

export default new ProductRepository();
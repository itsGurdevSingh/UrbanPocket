import variant from '../models/variant.model.js';
import { ApiError } from '../utils/errors.js';

class VariantRepository {
    constructor() {
        this.model = variant;
    }

    async findAll(filter = {}) {
        return this.model.find(filter);
    }

    async findById(id) {
        const item = await this.model.findById(id);
        if (!item) {
            throw new ApiError('Variant not found', { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
        }
        return item;
    }

    async create(data) {
        return this.model.create(data);
    }

    async updateById(id, data) {
        const item = await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!item) {
            throw new ApiError('Variant not found', { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
        }
        return item;
    }

    async deleteById(id) {
        const item = await this.model.findByIdAndDelete(id);
        if (!item) {
            throw new ApiError('Variant not found', { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
        }
        return item;
    }

    async findBySkuWithinProduct(productId, sku) {
        return this.model.findOne({ productId, sku });
    }

    async findByProductId(productId) {
        return this.model.find({ productId });
    }
}

export default new VariantRepository();

import mongoose from 'mongoose';
import product from '../models/product.model.js';
import { ApiError } from '../utils/errors.js';

class productRepository {
    constructor() {
        this.model = product;
    }
    async findAll() {
        return await product.find({});
    }

    async findOne(filter) {
        return await product.findOne(filter);
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

    /**
     * Get all products using aggregation pipeline with pagination
     * @param {object} filters - Filter criteria
     * @param {object} sort - Sort configuration
     * @param {object} pagination - Page and limit
     * @returns {Promise<{products: Array, total: number}>}
     */
    async getAllProducts(filters = {}, sort = {}, pagination = {}) {
        const pipeline = [];

        // ----------------------------------------------------------------------------------
        // STAGE 1: INITIAL MATCH (FILTER)
        // ----------------------------------------------------------------------------------
        const matchStage = {};

        // Filter by categoryId
        if (filters.categoryId) {
            matchStage.categoryId = new mongoose.Types.ObjectId(filters.categoryId);
        }

        // Filter by sellerId
        if (filters.sellerId) {
            matchStage.sellerId = new mongoose.Types.ObjectId(filters.sellerId);
        }

        // Filter by isActive
        if (filters.isActive !== undefined) {
            matchStage.isActive = filters.isActive === true || filters.isActive === 'true';
        }

        // Filter by brand
        if (filters.brand) {
            matchStage.brand = filters.brand;
        }

        // Filter by multiple IDs
        if (filters.ids && filters.ids.length > 0) {
            matchStage._id = { $in: filters.ids.map(id => new mongoose.Types.ObjectId(id)) };
        }

        // Text search
        if (filters.q) {
            matchStage.$text = { $search: filters.q };
        }

        // Date range filters
        if (filters.createdFrom || filters.createdTo) {
            matchStage.createdAt = {};
            if (filters.createdFrom) matchStage.createdAt.$gte = new Date(filters.createdFrom);
            if (filters.createdTo) matchStage.createdAt.$lte = new Date(filters.createdTo);
        }

        if (filters.updatedFrom || filters.updatedTo) {
            matchStage.updatedAt = {};
            if (filters.updatedFrom) matchStage.updatedAt.$gte = new Date(filters.updatedFrom);
            if (filters.updatedTo) matchStage.updatedAt.$lte = new Date(filters.updatedTo);
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Add text score if searching
        if (filters.q) {
            pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 2: SORTING
        // ----------------------------------------------------------------------------------
        let sortStage = {};

        if (filters.q && !sort.sortBy) {
            // Sort by relevance score if text search without explicit sort
            sortStage = { score: { $meta: 'textScore' }, createdAt: -1 };
        } else if (sort.sortBy) {
            // Custom sort from query
            sortStage[sort.sortBy] = sort.sortOrder === 'desc' ? -1 : 1;
        } else {
            // Default sort by createdAt descending
            sortStage = { createdAt: -1 };
        }

        pipeline.push({ $sort: sortStage });

        // ----------------------------------------------------------------------------------
        // STAGE 3: PROJECTION (FIELD SELECTION)
        // ----------------------------------------------------------------------------------
        let projectStage = null;
        if (filters.fields && filters.fields.length > 0) {
            projectStage = filters.fields.reduce((acc, field) => {
                acc[field] = 1;
                return acc;
            }, { _id: 1 });

            // Always include score if searching
            if (filters.q) {
                projectStage.score = { $meta: 'textScore' };
            }

            pipeline.push({ $project: projectStage });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 4: PAGINATION & COUNT ($facet)
        // ----------------------------------------------------------------------------------
        const page = parseInt(pagination.page, 10) || 1;
        const limit = parseInt(pagination.limit, 10) || 20;
        const skip = (page - 1) * limit;

        pipeline.push({
            $facet: {
                paginatedResults: [{ $skip: skip }, { $limit: limit }],
                totalCount: [{ $count: 'count' }],
            },
        });

        // ----------------------------------------------------------------------------------
        // STAGE 5: CLEANUP & RESHAPE OUTPUT
        // ----------------------------------------------------------------------------------
        pipeline.push(
            {
                $project: {
                    products: '$paginatedResults',
                    total: { $arrayElemAt: ['$totalCount.count', 0] },
                },
            },
            {
                $addFields: {
                    total: { $ifNull: ['$total', 0] },
                },
            }
        );

        // ----------------------------------------------------------------------------------
        // EXECUTION
        // ----------------------------------------------------------------------------------
        const results = await product.aggregate(pipeline);

        return results[0] || { products: [], total: 0 };
    }

}

export default new productRepository();
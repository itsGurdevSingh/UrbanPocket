import ProductVariant from '../models/variant.model.js';
import { ApiError } from '../utils/errors.js';
import mongoose from 'mongoose';

class VariantRepository {
    constructor() {
        this.model = ProductVariant;
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

    /**
     * Get all variants using aggregation pipeline with filters, sorting, and pagination
     * @param {object} filters - Filter criteria
     * @param {object} sort - Sort configuration
     * @param {object} pagination - Page and limit
     * @returns {Promise<{variants: Array, total: number}>} Variants and total count
     */
    async getAllVariants(filters = {}, sort = {}, pagination = {}) {
        const pipeline = [];

        // ----------------------------------------------------------------------------------
        // STAGE 1: INITIAL MATCH (FILTER)
        // ----------------------------------------------------------------------------------
        const matchStage = {};

        // Product ID filter
        if (filters.productId) {
            matchStage.productId = new mongoose.Types.ObjectId(filters.productId);
        }

        // SKU filter (exact match)
        if (filters.sku) {
            matchStage.sku = filters.sku;
        }

        // Currency filter
        if (filters.currency) {
            matchStage['price.currency'] = filters.currency.toUpperCase();
        }

        // Base unit filter
        if (filters.baseUnit) {
            matchStage.baseUnit = filters.baseUnit;
        }

        // Active status filter
        if (filters.isActive !== undefined) {
            matchStage.isActive = filters.isActive;
        }

        // IDs filter (specific variant IDs)
        if (filters.ids && filters.ids.length > 0) {
            matchStage._id = { $in: filters.ids.map(id => new mongoose.Types.ObjectId(id)) };
        }

        // Price range filter
        if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
            matchStage['price.amount'] = {};
            if (filters.priceMin !== undefined) {
                matchStage['price.amount'].$gte = filters.priceMin;
            }
            if (filters.priceMax !== undefined) {
                matchStage['price.amount'].$lte = filters.priceMax;
            }
        }

        // Stock range filter
        if (filters.stockMin !== undefined || filters.stockMax !== undefined) {
            matchStage.stock = {};
            if (filters.stockMin !== undefined) {
                matchStage.stock.$gte = filters.stockMin;
            }
            if (filters.stockMax !== undefined) {
                matchStage.stock.$lte = filters.stockMax;
            }
        }

        // Date range filters
        if (filters.createdFrom || filters.createdTo) {
            matchStage.createdAt = {};
            if (filters.createdFrom) {
                matchStage.createdAt.$gte = new Date(filters.createdFrom);
            }
            if (filters.createdTo) {
                matchStage.createdAt.$lte = new Date(filters.createdTo);
            }
        }

        if (filters.updatedFrom || filters.updatedTo) {
            matchStage.updatedAt = {};
            if (filters.updatedFrom) {
                matchStage.updatedAt.$gte = new Date(filters.updatedFrom);
            }
            if (filters.updatedTo) {
                matchStage.updatedAt.$lte = new Date(filters.updatedTo);
            }
        }

        // Text search (SKU regex)
        if (filters.q) {
            matchStage.$or = [
                { sku: { $regex: filters.q, $options: 'i' } }
            ];
        }

        // Options filter (e.g., { Color: 'Red', Size: 'M' })
        if (filters.options && typeof filters.options === 'object') {
            for (const [key, value] of Object.entries(filters.options)) {
                matchStage[`options.${key}`] = value;
            }
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 2: SORTING
        // ----------------------------------------------------------------------------------
        let sortStage = {};

        if (sort.sortBy) {
            // Parse comma-separated sort fields
            sort.sortBy.split(',').forEach(field => {
                if (field.startsWith('-')) {
                    sortStage[field.slice(1)] = -1;
                } else {
                    sortStage[field] = 1;
                }
            });
        } else {
            // Default sort by createdAt descending (newest first)
            sortStage = { createdAt: -1 };
        }

        pipeline.push({ $sort: sortStage });

        // ----------------------------------------------------------------------------------
        // STAGE 3: PROJECTION (FIELD SELECTION)
        // ----------------------------------------------------------------------------------
        if (filters.fields && filters.fields.length > 0) {
            const projectStage = filters.fields.reduce((acc, field) => {
                acc[field] = 1;
                return acc;
            }, { _id: 1 });

            pipeline.push({ $project: projectStage });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 4: PAGINATION & COUNT ($facet)
        // ----------------------------------------------------------------------------------
        const page = pagination.page || 1;
        const limit = pagination.limit || 20;
        const skip = (page - 1) * limit;

        pipeline.push({
            $facet: {
                paginatedResults: [{ $skip: skip }, { $limit: limit }],
                totalCount: [{ $count: 'count' }]
            }
        });

        // ----------------------------------------------------------------------------------
        // STAGE 5: CLEANUP & RESHAPE OUTPUT
        // ----------------------------------------------------------------------------------
        pipeline.push(
            {
                $project: {
                    variants: '$paginatedResults',
                    total: { $arrayElemAt: ['$totalCount.count', 0] }
                }
            },
            {
                $addFields: {
                    total: { $ifNull: ['$total', 0] }
                }
            }
        );

        // ----------------------------------------------------------------------------------
        // EXECUTION
        // ----------------------------------------------------------------------------------
        const results = await ProductVariant.aggregate(pipeline);

        return results[0] || { variants: [], total: 0 };
    }
}

export default new VariantRepository();

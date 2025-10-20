import mongoose from 'mongoose';
import InventoryItem from "../models/inventory.model";

class InventoryItemRepository {

    async create(data) {
        return InventoryItem.create(data);
    }

    async findById(id) {
        return InventoryItem.findById(id);
    }

    async findByVariantId(variantId) {
        return InventoryItem.find({ variantId });
    }

    async update(id, data) {
        return InventoryItem.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return InventoryItem.findByIdAndDelete(id);
    }

    /**
     * Executes a dynamic aggregation pipeline to search and filter inventory items.
     * @param {object} filters - Desired filter criteria.
     * @param {object} sort - Sort field and order.
     * @param {object} pagination - Page and limit for results.
     * @returns {Promise<{items: Array, total: number}>} Search results and total count.
     */
    async findAll(filters = {}, sort = {}, pagination = {}) {
        const pipeline = [];

        // ----------------------------------------------------------------------------------
        // STAGE 1: INITIAL MATCH (PRE-FILTER)
        // Filter on the InventoryItem collection fields
        // ----------------------------------------------------------------------------------
        const initialMatch = {};

        // Filter by variantId if provided
        if (filters.variantId) {
            if (mongoose.isValidObjectId(filters.variantId)) {
                initialMatch.variantId = new mongoose.Types.ObjectId(filters.variantId);
            } else {
                // Invalid ObjectId, return empty result
                return { items: [], total: 0 };
            }
        }

        // Filter by batchNumber if provided
        if (filters.batchNumber) {
            initialMatch.batchNumber = new RegExp(filters.batchNumber, 'i');
        }

        // Filter by isActive status
        if (filters.isActive !== undefined) {
            initialMatch.isActive = filters.isActive === 'true' || filters.isActive === true;
        }

        // Filter by stock availability
        if (filters.inStock !== undefined) {
            const inStock = filters.inStock === 'true' || filters.inStock === true;
            if (inStock) {
                initialMatch.stock = { $gt: 0 };
            } else {
                initialMatch.stock = { $lte: 0 };
            }
        }

        // Price range filters
        if (filters.minPrice || filters.maxPrice) {
            initialMatch['price.amount'] = {};
            if (filters.minPrice) {
                initialMatch['price.amount'].$gte = Number(filters.minPrice);
            }
            if (filters.maxPrice) {
                initialMatch['price.amount'].$lte = Number(filters.maxPrice);
            }
        }

        // Stock range filters
        if (filters.minStock !== undefined) {
            if (!initialMatch.stock) {
                initialMatch.stock = {};
            }
            if (typeof initialMatch.stock === 'object' && !initialMatch.stock.$gt) {
                initialMatch.stock.$gte = Number(filters.minStock);
            }
        }

        if (filters.maxStock !== undefined) {
            if (!initialMatch.stock) {
                initialMatch.stock = {};
            }
            if (typeof initialMatch.stock === 'object') {
                initialMatch.stock.$lte = Number(filters.maxStock);
            }
        }

        // Manufacturing date filters
        if (filters.mfgDateFrom || filters.mfgDateTo) {
            initialMatch['manufacturingDetails.mfgDate'] = {};
            if (filters.mfgDateFrom) {
                initialMatch['manufacturingDetails.mfgDate'].$gte = new Date(filters.mfgDateFrom);
            }
            if (filters.mfgDateTo) {
                initialMatch['manufacturingDetails.mfgDate'].$lte = new Date(filters.mfgDateTo);
            }
        }

        // Expiration date filters
        if (filters.expDateFrom || filters.expDateTo) {
            initialMatch['manufacturingDetails.expDate'] = {};
            if (filters.expDateFrom) {
                initialMatch['manufacturingDetails.expDate'].$gte = new Date(filters.expDateFrom);
            }
            if (filters.expDateTo) {
                initialMatch['manufacturingDetails.expDate'].$lte = new Date(filters.expDateTo);
            }
        }

        // Filter expired items (exp date < today)
        if (filters.excludeExpired === 'true' || filters.excludeExpired === true) {
            initialMatch['manufacturingDetails.expDate'] = {
                $gte: new Date()
            };
        }

        pipeline.push({ $match: initialMatch });

        // ----------------------------------------------------------------------------------
        // STAGE 2: LOOKUP (JOIN) with ProductVariant and Product
        // To get additional info like product name, SKU, etc.
        // ----------------------------------------------------------------------------------
        pipeline.push(
            {
                $lookup: {
                    from: 'productvariants',
                    localField: 'variantId',
                    foreignField: '_id',
                    as: 'variant'
                }
            },
            { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'products',
                    localField: 'variant.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }
        );

        // ----------------------------------------------------------------------------------
        // STAGE 3: POST-JOIN MATCH (POST-FILTER)
        // Filter on joined data
        // ----------------------------------------------------------------------------------
        const postMatch = {};

        // Filter by product name
        if (filters.productName) {
            postMatch['product.name'] = new RegExp(filters.productName, 'i');
        }

        // Filter by SKU
        if (filters.sku) {
            postMatch['variant.sku'] = new RegExp(filters.sku, 'i');
        }

        // Filter by sellerId
        if (filters.sellerId) {
            if (mongoose.isValidObjectId(filters.sellerId)) {
                postMatch['product.sellerId'] = new mongoose.Types.ObjectId(filters.sellerId);
            }
        }

        if (Object.keys(postMatch).length > 0) {
            pipeline.push({ $match: postMatch });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 4: SORTING
        // ----------------------------------------------------------------------------------
        let sortStage = {};

        if (sort.sortBy) {
            switch (sort.sortBy) {
                case 'price':
                    sortStage = { 'price.amount': sort.sortOrder === 'desc' ? -1 : 1 };
                    break;
                case 'stock':
                    sortStage = { stock: sort.sortOrder === 'desc' ? -1 : 1 };
                    break;
                case 'createdAt':
                    sortStage = { createdAt: sort.sortOrder === 'desc' ? -1 : 1 };
                    break;
                case 'updatedAt':
                    sortStage = { updatedAt: sort.sortOrder === 'desc' ? -1 : 1 };
                    break;
                case 'expDate':
                    sortStage = { 'manufacturingDetails.expDate': sort.sortOrder === 'desc' ? -1 : 1 };
                    break;
                case 'mfgDate':
                    sortStage = { 'manufacturingDetails.mfgDate': sort.sortOrder === 'desc' ? -1 : 1 };
                    break;
                default:
                    sortStage = { createdAt: -1 };
            }
        } else {
            // Default sort by creation date (newest first)
            sortStage = { createdAt: -1 };
        }

        pipeline.push({ $sort: sortStage });

        // ----------------------------------------------------------------------------------
        // STAGE 5: PAGINATION & FINAL PROJECTION ($facet)
        // ----------------------------------------------------------------------------------
        const page = parseInt(pagination.page, 10) || 1;
        const limit = parseInt(pagination.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const finalProjection = {
            _id: 1,
            variantId: 1,
            batchNumber: 1,
            stock: 1,
            price: 1,
            manufacturingDetails: 1,
            hsnCode: 1,
            gstPercentage: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1,
            // Include variant and product info
            variant: {
                _id: '$variant._id',
                sku: '$variant.sku',
                options: '$variant.options',
                baseUnit: '$variant.baseUnit',
            },
            product: {
                _id: '$product._id',
                name: '$product.name',
                brand: '$product.brand',
                sellerId: '$product.sellerId',
            }
        };

        pipeline.push({
            $facet: {
                paginatedResults: [
                    { $skip: skip },
                    { $limit: limit },
                    { $project: finalProjection }
                ],
                totalCount: [{ $count: 'count' }],
            },
        });

        // ----------------------------------------------------------------------------------
        // STAGE 6: CLEANUP & RESHAPE OUTPUT
        // ----------------------------------------------------------------------------------
        pipeline.push(
            {
                $project: {
                    items: '$paginatedResults',
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
        const results = await InventoryItem.aggregate(pipeline);

        return results[0] || { items: [], total: 0 };
    }

};

export default new InventoryItemRepository();
import mongoose from 'mongoose';
import InventoryItem from "../models/inventory.model.js";
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

class InventoryItemRepository {

    constructor() {
        this.model = InventoryItem;
    }

    async create(data) {
        return this.model.create(data);
    }

    async findById(id) {
        return this.model.findById(id);
    }

    async findByVariantId(variantId) {
        return this.model.find({ variantId });
    }

    async update(id, data) {
        return this.model.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return this.model.findByIdAndDelete(id);
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
        const stockFilter = {};
        if (filters.inStock === 'true' || filters.inStock === true) {
            stockFilter.$gt = 0;
        } else if (filters.inStock === 'false' || filters.inStock === false) {
            stockFilter.$lte = 0;
        }

        if (filters.minStock !== undefined) {
            // This will correctly overwrite $gt: 0 with $gte: 50 (or whatever)
            stockFilter.$gte = Number(filters.minStock);
        }
        if (filters.maxStock !== undefined) {
            stockFilter.$lte = Number(filters.maxStock);
        }

        // Only add the stock filter to the match if it has keys
        if (Object.keys(stockFilter).length > 0) {
            initialMatch.stock = stockFilter;
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
        const expDateFilter = {};
        if (filters.expDateFrom) {
            expDateFilter.$gte = new Date(filters.expDateFrom);
        }
        if (filters.expDateTo) {
            expDateFilter.$lte = new Date(filters.expDateTo);
        }

        // Add the 'excludeExpired' logic
        if (filters.excludeExpired === 'true' || filters.excludeExpired === true) {
            // This sets or overwrites $gte with the *later* date, which is correct
            // e.g., if $gte was 'yesterday' this changes it to 'today'.
            expDateFilter.$gte = new Date();
        }

        if (Object.keys(expDateFilter).length > 0) {
            initialMatch['manufacturingDetails.expDate'] = expDateFilter;
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
        const results = await this.model.aggregate(pipeline);

        return results[0] || { items: [], total: 0 };
    }

    async findFefoBatches(variantId, requiredQuantity) {
        let quantityToFulfill = requiredQuantity;
        const batchesToReserve = [];

        const inventoryCursor = this.model.aggregate([
            {
                $match: {
                    variantId: new mongoose.Types.ObjectId(variantId),
                    isActive: true,
                    stock: { $gt: 0 },
                },
            },
            {
                $addFields: {
                    // Use the actual expiration date for sorting
                    expiresAt: "$manufacturingDetails.expDate",
                    // Create a sort field to put items *with* an expiry date first
                    hasExpiry: { $ne: ["$manufacturingDetails.expDate", null] },
                },
            },
            {
                $sort: {
                    hasExpiry: -1,  // true (has expiry) comes before false (no expiry)
                    expiresAt: 1, // Earliest expiration date first
                    createdAt: 1, // Oldest stock first as a fallback
                },
            },
        ]);

        for await (const batch of inventoryCursor) {
            if (quantityToFulfill <= 0) {
                break;
            }
            const quantityFromThisBatch = Math.min(batch.stock, quantityToFulfill);
            batchesToReserve.push({
                inventoryId: batch._id,
                quantity: quantityFromThisBatch,
                price: batch.price, // Also return price for the snapshot
                // location: batch.location, // Also return location for the pick list
            });

            quantityToFulfill -= quantityFromThisBatch;
        }

        if (quantityToFulfill > 0) {
            throw new Error(
                `Insufficient stock for variant ${variantId}. Required: ${requiredQuantity}, Found: ${requiredQuantity - quantityToFulfill
                }`
            );
        }
        return batchesToReserve;
    };

    // delete stock from multiple batches atomically for resevation
    async deductStockFromBatches(batches, variantId, externalSession = null) {
        if (!Array.isArray(batches) || batches.length === 0) {
            throw new ApiError('INVALID_INPUT', 'Batches array is empty or invalid.');
        }

        if (!variantId) {
            throw new ApiError('INVALID_INPUT', 'variantId is required.');
        }

        // get mongo session
        let session = externalSession;

        // if independent session is ture then create new session
        if (!externalSession) {
            session = await this.model.startSession();
        }

        try {

            // start transaction
            if (!externalSession) {
            session.startTransaction();
            }

            const bulkOps = batches.map(batch => ({
                updateOne: {
                    filter: { _id: batch.inventoryId, stock: { $gte: batch.quantity } },
                    update: { $inc: { stock: -batch.quantity } }
                }
            }));
            const result = await this.model.bulkWrite(bulkOps, { session });

            if (result.matchedCount !== batches.length) {
                throw new ApiError('STOCK_DEDUCTION_FAILED', 'Failed to deduct stock for some inventory items.');
            }

            // 2. Manually do the hook's job
            // The hooks didn't run with bulkWrite, so we do it ourselves.
            const totalDeducted = batches.reduce((acc, batch) => acc + batch.quantity, 0);

            await mongoose.model('ProductVariant').findByIdAndUpdate(
                variantId,
                { $inc: { stock: -totalDeducted } },
                { session } // Run this update *inside the same transaction*
            );

            // commit transaction
            if (!externalSession) {
            await session.commitTransaction();
            }

        } catch (error) {

            // abort transaction
            if (!externalSession) {
            await session.abortTransaction();
            }
            if (error instanceof ApiError) {
                logger.error('Stock deduction failed during transaction.', { error });
                throw error;
            }

            logger.error('Unexpected error during stock deduction.', { error });
            throw new ApiError('STOCK_DEDUCTION_FAILED', 'Failed to deduct stock for some inventory items.');
        } finally {
            // end session
            if (!externalSession) {
            session.endSession();
            }
        }

    }

    // add stock back to a specific batch 
    // externalSession indicates whether to use its own session or an external one by 
    //      -- default our parent will handle session because we ahve to delete reservation after adding stock back.
    async addStockToBatch(batches, variantId, externalSession = null) {
        if (!Array.isArray(batches) || batches.length === 0) {
            throw new ApiError('INVALID_INPUT', 'Batches array is empty or invalid.');
        }

        if (!variantId) {
            throw new ApiError('INVALID_INPUT', 'variantId is required.');
        }

        let session = externalSession;
        // if independent session is ture then create new session
        if (!externalSession) {
            session = await this.model.startSession();
        }

        try {
            // start transaction
            if (!externalSession) {
                session.startTransaction();
            }
            const bulkOps = batches.map(batch => ({
                updateOne: {
                    filter: { _id: batch.inventoryId },
                    update: { $inc: { stock: batch.quantity } }
                }
            }));
            const result = await this.model.bulkWrite(bulkOps, { session });
            if (result.matchedCount !== batches.length) {
                throw new ApiError('STOCK_ADDITION_FAILED', 'Failed to add stock for some inventory items.');
            }

            // 2. Manually do the hook's job
            const totalAdded = batches.reduce((acc, batch) => acc + batch.quantity, 0);
            await mongoose.model('ProductVariant').findByIdAndUpdate(
                variantId,
                { $inc: { stock: totalAdded } },
                { session } // Run inside the same transaction
            );
            // commit transaction
            if (!externalSession) {
                await session.commitTransaction();
            }
        } catch (error) {
            // abort transaction
            if (!externalSession) {
                await session.abortTransaction();
            }
            if (error instanceof ApiError) {
                logger.error('Stock addition failed during transaction.', { error });
                throw error;
            }
            logger.error('Unexpected error during stock addition.', { error });
            throw new ApiError('STOCK_ADDITION_FAILED', 'Failed to add stock for some inventory items.');
        } finally {
            // end session
            if (!externalSession) {
                session.endSession();
            }
        }
    }

};

export default new InventoryItemRepository();
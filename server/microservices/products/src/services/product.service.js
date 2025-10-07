import productRepository from '../repositories/product.repository.js';
import mongoose from 'mongoose';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import uploadService from './upload.service.js';

class productService {
    /**
     * Create product after ensuring uniqueness and uploading images (if files provided).
     * @param {object} productData - validated body (may or may not include baseImages)
     * @param {Array<Multer.File>} files - uploaded image files (memory storage)
     */
    async createProduct(productData, files = []) {
        try {
            // 1. Uniqueness check first
            const existing = await productRepository.findByName(productData.name);
            if (existing) {
                throw new ApiError('Product name must be unique', { statusCode: 400, code: 'DUPLICATE_PRODUCT_NAME' });
            }

            // 2. Resolve / upload images
            let baseImages = [];
            if (files && files.length > 0) {
                baseImages = await uploadService.uploadProductImages(files);
            } else if (Array.isArray(productData.baseImages) && productData.baseImages.length > 0) {
                baseImages = productData.baseImages;
            }
            if (baseImages.length === 0) {
                throw new ApiError('At least one product image is required', { statusCode: 400, code: 'NO_IMAGES' });
            }

            // 3. Persist with rollback safety using uploadService helper
            const doc = { ...productData, baseImages };
            const product = await uploadService.executeWithUploadRollback(baseImages, async () => {
                return productRepository.create(doc);
            }, { rollbackLogCode: 'PRODUCT_CREATE_ROLLBACK' });
            return product;
        } catch (error) {
            logger.error('Error in service layer while creating product:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to persist product', { statusCode: 500, code: 'PRODUCT_PERSIST_FAILED', details: error.message });
        }
    }

    /**
     * Fetch all products (basic details)
     * @returns {Promise<Array>}
     */

    async getAllProducts(query = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                categoryId,
                sellerId,
                brand,
                isActive = true,
                ids,
                q,
                sort,
                fields,
                createdFrom,
                createdTo,
                updatedFrom,
                updatedTo,
            } = query;

            const filter = {};

            if (categoryId) filter.categoryId = categoryId;
            if (sellerId) filter.sellerId = sellerId;
            if (isActive !== undefined) {
                if (isActive === true || isActive === 'true') filter.isActive = true;
                else if (isActive === false || isActive === 'false') filter.isActive = false;
            }
            if (brand) filter.brand = brand; // exact match keeps index usage
            if (ids) {
                const idArray = ids.split(',').map(v => v.trim()).filter(Boolean);
                if (idArray.length) {
                    const objectIds = idArray.map(id => new mongoose.Types.ObjectId(id));
                    filter._id = { $in: objectIds };
                }
            }
            // date ranges
            if (createdFrom || createdTo) {
                filter.createdAt = {};
                if (createdFrom) filter.createdAt.$gte = createdFrom;
                if (createdTo) filter.createdAt.$lte = createdTo;
            }
            if (updatedFrom || updatedTo) {
                filter.updatedAt = {};
                if (updatedFrom) filter.updatedAt.$gte = updatedFrom;
                if (updatedTo) filter.updatedAt.$lte = updatedTo;
            }

            if (q) {
                filter.$text = { $search: q };
            }

            // projection
            let projection = undefined;
            if (fields) {
                projection = fields.split(',').reduce((acc, f) => { acc[f] = 1; return acc; }, { _id: 1 });
            }
            if (q) {
                projection = { ...(projection || {}), score: { $meta: 'textScore' } };
            }

            // sort
            let sortObj = { createdAt: -1 };
            if (q && !sort) {
                sortObj = { score: { $meta: 'textScore' }, createdAt: -1 };
            } else if (sort) {
                sortObj = {};
                sort.split(',').forEach(part => {
                    if (part.startsWith('-')) {
                        sortObj[part.slice(1)] = -1;
                    } else {
                        sortObj[part] = 1;
                    }
                });
            }

            const pageNum = Number(page) || 1;
            const limitNum = Number(limit) || 20;
            const skip = (pageNum - 1) * limitNum;

            const [items, total] = await Promise.all([
                productRepository.model.find(filter).select(projection).sort(sortObj).skip(skip).limit(limitNum).lean(),
                productRepository.model.countDocuments(filter)
            ]);

            const totalPages = Math.ceil(total / limitNum) || 1;
            return {
                data: items,
                meta: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1,
                },
                // temporary backward compatibility
                count: items.length,
            };
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch products', { statusCode: 500, code: 'FETCH_PRODUCTS_FAILED', details: error.message });
        }
    }

    /**
     * Fetch product by ID (detailed view)
     * @param {string} productId
     * @returns {Promise<object|null>}
     */
    async getProductById(productId) {
        try {
            return productRepository.findById(productId);
        } catch (error) {
            logger.error('Error in service layer while fetching product by ID:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch product', { statusCode: 500, code: 'FETCH_PRODUCT_FAILED', details: error.message });
        }
    }

    /**
     * Delete product by ID
     * @param {string} productId
     * @returns {Promise<boolean>} - true if deleted, false if not found
     * @throws {ApiError} on failure
     * Note: associated images are also deleted in this implementation
     */
    async deleteProduct(productId, currentUser) {
        try {
            // 1. Fetch product to get associated images
            const product = await productRepository.findById(productId);
            if (!product) {
                return false; // not found
            }
            // Ownership / authorization check: only seller who owns it OR admin can delete.
            if (currentUser && currentUser.role === 'seller') {
                if (product.sellerId.toString() !== currentUser.id) {
                    throw new ApiError('Unauthorized to delete this product', { statusCode: 403, code: 'UNAUTHORIZED_PRODUCT_DELETE' });
                }
            }

            // Prepare images for deletion
            const imagesToDelete = product.baseImages || [];
            const imageFileIds = imagesToDelete.map(img => img.fileId);
            // 2. Delete product from DB
            await productRepository.deleteById(productId);
            // 3. Delete associated images (best-effort, log failures)
            if (imagesToDelete.length > 0) {
                try {
                    await uploadService.deleteImages(imageFileIds, { logCode: 'PRODUCT_DELETE_IMAGE_FAIL' });
                } catch (imgErr) {
                    logger.error('Failed to delete associated images after product deletion:', imgErr);
                    // Not throwing further to avoid masking the main operation result
                }
            }
            // 4. Indicate success regardless of whether images existed
            return true;
        } catch (error) {
            logger.error('Error in service layer while deleting product:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to delete product', { statusCode: 500, code: 'DELETE_PRODUCT_FAILED', details: error.message });
        }
    }
}

export default new productService();
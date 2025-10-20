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
    async createProduct(productData, files = [], currentUser) {
        try {
            // Ownership enforcement:
            // If a seller is creating a product, force sellerId to their own id (ignore any provided value).
            if (currentUser && currentUser.role === 'seller') {
                productData.sellerId = currentUser.userId; // enforce ownership
            }
            // If an admin is creating a product and no sellerId provided, require it.
            if (currentUser && currentUser.role === 'admin') {
                if (!productData.sellerId) {
                    throw new ApiError('sellerId is required when admin creates a product', { statusCode: 400, code: 'SELLER_ID_REQUIRED' });
                }
            }
            // (Future) Other roles could be restricted here
            // 1. Uniqueness of name in context of seller
            const existing = await productRepository.findOne({ name: productData.name, sellerId: productData.sellerId });
            if (existing) {
                throw new ApiError('Product name must be unique', { statusCode: 400, code: 'DUPLICATE_PRODUCT_NAME' });
            }

            // 2. Resolve / upload images
            let baseImages = [];
            if (files && files.length > 0) {
                baseImages = await uploadService.uploadImagesToCloud(files);
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
     * Fetch all products using aggregation pipeline
     * @param {object} query - Query parameters
     * @returns {Promise<object>} Products with pagination metadata
     */
    async getAllProducts(query = {}) {
        try {
            // Parse query parameters
            const {
                page = 1,
                limit = 20,
                categoryId,
                sellerId,
                brand,
                isActive,
                ids,
                q,
                sort,
                fields,
                createdFrom,
                createdTo,
                updatedFrom,
                updatedTo,
            } = query;

            // Build filters object
            const filters = {};

            if (categoryId) filters.categoryId = categoryId;
            if (sellerId) filters.sellerId = sellerId;
            if (isActive !== undefined) filters.isActive = isActive;
            if (brand) filters.brand = brand;
            if (q) filters.q = q;
            if (createdFrom) filters.createdFrom = createdFrom;
            if (createdTo) filters.createdTo = createdTo;
            if (updatedFrom) filters.updatedFrom = updatedFrom;
            if (updatedTo) filters.updatedTo = updatedTo;

            // Handle IDs filter
            if (ids) {
                const idArray = ids.split(',').map(v => v.trim()).filter(Boolean);
                if (idArray.length > 0) {
                    filters.ids = idArray;
                }
            }

            // Handle fields projection
            if (fields) {
                filters.fields = fields.split(',').map(f => f.trim()).filter(Boolean);
            }

            // Build sort object
            const sortConfig = {};
            if (sort) {
                const sortParts = sort.split(',');
                sortParts.forEach(part => {
                    if (part.startsWith('-')) {
                        sortConfig.sortBy = part.slice(1);
                        sortConfig.sortOrder = 'desc';
                    } else {
                        sortConfig.sortBy = part;
                        sortConfig.sortOrder = 'asc';
                    }
                });
            }

            // Pagination
            const pagination = {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
            };

            // Call repository with aggregation pipeline
            const { products, total } = await productRepository.getAllProducts(filters, sortConfig, pagination);

            // Calculate pagination metadata
            const totalPages = Math.ceil(total / pagination.limit) || 1;
            const meta = {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages,
                hasNextPage: pagination.page < totalPages,
                hasPrevPage: pagination.page > 1,
            };

            return {
                products,
                meta,
                // Backward compatibility
                count: products.length,
            };
        } catch (error) {
            logger.error('Error fetching all products:', error);
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
     * Update product by ID (with optional new images)
     * @param {string} productId
     * @param {object} updateData - validated body (may or may not include baseImages)
     * @param {Array<Multer.File>} files - uploaded image files (memory storage)
     * @param {object} currentUser - user performing the update (for authorization)
     * @returns {Promise<object|null>} - updated product or null if not found
     * @throws {ApiError} on failure
     */
    async updateProduct(productId, updateData, files = [], currentUser) {
        try {
            // 1. Fetch existing product
            const existing = await productRepository.findById(productId);
            if (!existing) {
                return null; // not found
            }
            // Ownership / authorization check: only seller who owns it OR admin can update.
            if (currentUser && currentUser.role === 'seller') {
                if (existing.sellerId.toString() !== currentUser.userId) {
                    throw new ApiError('Unauthorized to update this product', { statusCode: 403, code: 'UNAUTHORIZED_PRODUCT_UPDATE' });
                }
            }
            // 2. If name is changing, ensure uniquenessin context of seller
            if (updateData.name && updateData.name !== existing.name) {
                const nameConflict = await productRepository.findOne({ name: updateData.name, sellerId: existing.sellerId });
                if (nameConflict) {
                    throw new ApiError('Product name must be unique', { statusCode: 400, code: 'DUPLICATE_PRODUCT_NAME' });
                }
            }
            // 3. Resolve / upload new images if any
            let newBaseImages = existing.baseImages || [];
            if (files && files.length > 0) {
                const uploadedImages = await uploadService.uploadImagesToCloud(files);
                newBaseImages = newBaseImages.concat(uploadedImages);
            }
            if (Array.isArray(updateData.baseImages) && updateData.baseImages.length > 0) {
                // Merge existing images with new ones from updateData
                const existingImageIds = new Set(newBaseImages.map(img => img.fileId));
                updateData.baseImages.forEach(img => {
                    if (img.fileId && !existingImageIds.has(img.fileId)) {
                        newBaseImages.push(img);
                    }
                });
            }
            if (newBaseImages.length === 0) {
                throw new ApiError('At least one product image is required', { statusCode: 400, code: 'NO_IMAGES' });
            }
            // 4. Prepare update document
            const updateDoc = { ...updateData, baseImages: newBaseImages, updatedAt: new Date() };
            // 5. Persist update
            const updated = await productRepository.updateById(productId, updateDoc);
            return updated;
        } catch (error) {
            logger.error('Error in service layer while updating product:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update product', { statusCode: 500, code: 'UPDATE_PRODUCT_FAILED', details: error.message });
        }
    }

    /**
     * Update a specific product image by fileId
     * @param {string} productId
     * @param {string} fileId - ID of the image file to update
     * @param {Multer.File} file - new image file (memory storage)
     * @param {object} currentUser - user performing the update (for authorization)
     * @returns {Promise<object|null>} - updated product or null if not found
     */
    async updateProductImage(productId, fileId, file, currentUser) {
        try {
            // 1. Fetch existing product
            const existing = await productRepository.findById(productId);
            if (!existing) {
                return null; // not found
            }
            // Ownership / authorization check: only seller who owns it OR admin can update.
            if (currentUser && currentUser.role === 'seller') {
                if (existing.sellerId.toString() !== currentUser.userId) {
                    throw new ApiError('Unauthorized to update this product', { statusCode: 403, code: 'UNAUTHORIZED_PRODUCT_UPDATE' });
                }
            }
            // 2. Find the image to update
            const imgIndex = (existing.baseImages || []).findIndex(img => img.fileId === fileId);
            if (imgIndex === -1) {
                throw new ApiError('Image not found in product', { statusCode: 404, code: 'PRODUCT_IMAGE_NOT_FOUND' });
            }
            const oldImage = existing.baseImages[imgIndex];
            // 3. Upload new image
            const [uploadedImage] = await uploadService.uploadImagesToCloud([file]);
            if (!uploadedImage) {
                throw new ApiError('Failed to upload new image', { statusCode: 500, code: 'IMAGE_UPLOAD_FAILED' });
            }
            // 4. Replace the image in baseImages array
            const newBaseImages = [...existing.baseImages];
            newBaseImages[imgIndex] = uploadedImage;
            // 5. Persist update
            const updateDoc = { baseImages: newBaseImages, updatedAt: new Date() };
            const updated = await productRepository.updateById(productId, updateDoc);
            // 6. After successful DB update, attempt to delete old image (best-effort)
            if (oldImage && oldImage.fileId) {
                try {
                    await uploadService.deleteImages([oldImage.fileId], { logCode: 'OLD_IMAGE_DELETE_FAIL' });
                } catch (delErr) {
                    logger.error('Failed to delete old replaced image:', delErr);
                }
            }
            return updated.baseImages[imgIndex];
        } catch (error) {
            logger.error('Error in service layer while updating product image:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update product image', { statusCode: 500, code: 'UPDATE_PRODUCT_IMAGE_FAILED', details: error.message });
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
                if (product.sellerId.toString() !== currentUser.userId) {
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

    /**
     * Disable (soft delete) a product by ID
     * @param {string} productId
     * @param {object} currentUser - user performing the disable (for authorization)
     * @returns {Promise<boolean>} - true if disabled, false if not found
     * @throws {ApiError} on failure
     * Note: associated images are NOT deleted in this implementation
     */
    async disableProduct(productId, currentUser) {
        try {
            // 1. Fetch product to check existence and ownership
            const product = await productRepository.findById(productId);
            if (!product) {
                return false; // not found
            }
            // Ownership / authorization check: only seller who owns it OR admin can disable.
            if (currentUser && currentUser.role === 'seller') {
                if (product.sellerId.toString() !== currentUser.userId) {
                    throw new ApiError('Unauthorized to disable this product', { statusCode: 403, code: 'UNAUTHORIZED_PRODUCT_DISABLE' });
                }
            }
            // 2. Update isActive to false
            await productRepository.updateById(productId, { isActive: false, updatedAt: new Date() });
            return true;
        } catch (error) {
            logger.error('Error in service layer while disabling product:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to disable product', { statusCode: 500, code: 'DISABLE_PRODUCT_FAILED', details: error.message });
        }
    }

    /**
     * Enable (reactivate) a product by ID
     * @param {string} productId
     * @param {object} currentUser - user performing the enable (for authorization)
     * @returns {Promise<boolean>} - true if enabled, false if not found
     * @throws {ApiError} on failure
     * Note: associated images are NOT modified in this implementation
     */
    async enableProduct(productId, currentUser) {
        try {
            // 1. Fetch product to check existence and ownership
            const product = await productRepository.findById(productId);
            if (!product) {
                return false; // not found
            }
            // Ownership / authorization check: only seller who owns it OR admin can enable.
            if (currentUser && currentUser.role === 'seller') {
                if (product.sellerId.toString() !== currentUser.userId) {
                    throw new ApiError('Unauthorized to enable this product', { statusCode: 403, code: 'UNAUTHORIZED_PRODUCT_ENABLE' });
                }
            }
            // 2. Update isActive to true
            await productRepository.updateById(productId, { isActive: true, updatedAt: new Date() });
            return true;
        }
        catch (error) {
            logger.error('Error in service layer while enabling product:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to enable product', { statusCode: 500, code: 'ENABLE_PRODUCT_FAILED', details: error.message });
        }
    };

}

export default new productService();
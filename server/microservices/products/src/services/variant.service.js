import productRepository from "../repositories/product.repository.js";
import variantRepository from "../repositories/variant.repository.js";
import { ApiError } from "../utils/errors.js";
import uploadService from "./upload.service.js";
import mongoose from 'mongoose';

class VariantService {
    /**
     * variantData expected shape: { productId, sku?, options, price, stock, baseUnit, variantImages? }
     * files: multer memory files (images)
     * currentUser: { id, role }
     */
    async createVariant(variantData, files, currentUser) {
        try {
            if (!currentUser) {
                throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
            }

            // Fetch parent product (repository throws ApiError if not found)
            const product = await productRepository.findById(variantData.productId);

            // Product must be active
            if (product.isActive === false) {
                throw new ApiError('Cannot add variant to an inactive product', { statusCode: 400, code: 'PRODUCT_INACTIVE' });
            }

            // Ownership / role: seller must own product; admin allowed
            if (currentUser.role === 'seller') {
                if (product.sellerId?.toString() !== currentUser.id) {
                    throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
                }
            } else if (!['admin'].includes(currentUser.role)) {
                throw new ApiError('Insufficient permissions to create variant', { statusCode: 403, code: 'FORBIDDEN' });
            }

            // Upload or consume provided images
            let variantImages = [];
            if (files && files.length > 0) {
                variantImages = await uploadService.uploadImagesToCloud(files);
            } else if (Array.isArray(variantData.variantImages) && variantData.variantImages.length > 0) {
                variantImages = variantData.variantImages;
            }
            if (variantImages.length === 0) {
                throw new ApiError('At least one variant image is required', { statusCode: 400, code: 'NO_IMAGES' });
            }

            // Enforce SKU uniqueness within the product scope only if provided
            if (variantData.sku) {
                const existing = await variantRepository.findBySkuWithinProduct(product.id, variantData.sku);
                if (existing) {
                    throw new ApiError('Variant with this SKU already exists for this product', { statusCode: 400, code: 'DUPLICATE_VARIANT_SKU' });
                }
            }

            const doc = {
                productId: product.id,
                sku: variantData.sku,
                options: variantData.options,
                price: variantData.price,
                currency: (variantData.currency || 'INR').toUpperCase(),
                stock: variantData.stock,
                baseUnit: variantData.baseUnit,
                variantImages,
                isActive: variantData.isActive !== undefined ? variantData.isActive : true,
            };

            const created = await uploadService.executeWithUploadRollback(variantImages, async () => {
                return variantRepository.create(doc);
            }, { rollbackLogCode: 'VARIANT_CREATE_ROLLBACK' });

            return created;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to create variant', { statusCode: 500, code: 'CREATE_VARIANT_ERROR', details: error.message });
        }
    }

    /**
     * updateData can include: { sku?, options?, price?, stock?, baseUnit?, isActive?, variantImages? }
     * files: multer memory files (images)
     * currentUser: { id, role }
     * */
    async updateVariant(variantId, updateData, files, currentUser) {
        try {
            if (!currentUser) {
                throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
            }
            // Fetch existing variant (repository throws ApiError if not found)
            const variant = await variantRepository.findById(variantId);
            // Fetch parent product
            const product = await productRepository.findById(variant.productId);
            // Ownership / role: seller must own product; admin allowed
            if (currentUser.role === 'seller') {
                if (product.sellerId?.toString() !== currentUser.id) {
                    throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
                }
            } else if (!['admin'].includes(currentUser.role)) {
                throw new ApiError('Insufficient permissions to update variant', { statusCode: 403, code: 'FORBIDDEN' });
            }
            // If product is inactive, cannot update variant
            if (product.isActive === false) {
                throw new ApiError('Cannot update variant of an inactive product', { statusCode: 400, code: 'PRODUCT_INACTIVE' });
            }
            // If SKU is being updated, ensure uniqueness within product scope
            if (updateData.sku && updateData.sku !== variant.sku) {
                const existing = await variantRepository.findBySkuWithinProduct(product.id, updateData.sku);
                if (existing) {
                    throw new ApiError('Variant with this SKU already exists for this product', { statusCode: 400, code: 'DUPLICATE_VARIANT_SKU' });
                }
            }
            // Handle new images if provided
            // Keep track of existing images and only uploaded ones for rollback safety
            let newVariantImages = Array.isArray(variant.variantImages) ? [...variant.variantImages] : [];
            let uploadedImages = [];
            if (files && files.length > 0) {
                uploadedImages = await uploadService.uploadImagesToCloud(files);
                newVariantImages = newVariantImages.concat(uploadedImages);
            } else if (Array.isArray(updateData.variantImages) && updateData.variantImages.length > 0) {
                // URLs provided from client (no rollback needed as they are not uploaded now)
                newVariantImages = newVariantImages.concat(updateData.variantImages);
            }
            if (newVariantImages.length === 0) {
                throw new ApiError('At least one variant image is required', { statusCode: 400, code: 'NO_IMAGES' });
            }
            const updatedFields = {
                sku: updateData.sku !== undefined ? updateData.sku : variant.sku,
                options: updateData.options !== undefined ? updateData.options : variant.options,
                price: updateData.price !== undefined ? updateData.price : variant.price,
                currency: updateData.currency !== undefined ? updateData.currency.toUpperCase() : variant.currency,
                stock: updateData.stock !== undefined ? updateData.stock : variant.stock,
                baseUnit: updateData.baseUnit !== undefined ? updateData.baseUnit : variant.baseUnit,
                variantImages: newVariantImages,
                isActive: updateData.isActive !== undefined ? updateData.isActive : variant.isActive,
            };
            // Only rollback images that were newly uploaded in this request
            const updated = await uploadService.executeWithUploadRollback(uploadedImages, async () => {
                return variantRepository.updateById(variant.id, updatedFields);
            }, { rollbackLogCode: 'VARIANT_UPDATE_ROLLBACK' });
            return updated;
        }
        catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update variant', { statusCode: 500, code: 'UPDATE_VARIANT_ERROR', details: error.message });
        }
    }

    /**
     * update a single variant image identified by fileId
     * currentUser: { id, role }
     * returns updated image object { url, altText, fileId }
     */
    async updateVariantImage(variantId, fileId, file, currentUser) {
        try {
            if (!currentUser) {
                throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
            }
            if (!file) {
                throw new ApiError('Image file is required', { statusCode: 400, code: 'NO_FILE' });
            }
            // Fetch existing variant (repository throws ApiError if not found)
            const variant = await variantRepository.findById(variantId);
            // Fetch parent product
            const product = await productRepository.findById(variant.productId);
            // Ownership / role: seller must own product; admin allowed
            if (currentUser.role === 'seller') {
                if (product.sellerId?.toString() !== currentUser.id) {
                    throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
                }
            } else if (!['admin'].includes(currentUser.role)) {
                throw new ApiError('Insufficient permissions to update variant image', { statusCode: 403, code: 'FORBIDDEN' });
            }
            // If product is inactive, cannot update variant
            if (product.isActive === false) {
                throw new ApiError('Cannot update variant image of an inactive product', { statusCode: 400, code: 'PRODUCT_INACTIVE' });
            }
            // Find existing image by fileId
            const existingImages = Array.isArray(variant.variantImages) ? variant.variantImages : [];
            const imgIndex = existingImages.findIndex(img => img.fileId === fileId);
            if (imgIndex === -1) {
                throw new ApiError('No variant image found with the provided fileId', { statusCode: 404, code: 'VARIANT_IMAGE_NOT_FOUND' });
            }
            // Upload new image
            const [uploadedImage] = await uploadService.uploadImagesToCloud([file]);
            if (!uploadedImage) {
                throw new ApiError('Image upload failed', { statusCode: 500, code: 'IMAGE_UPLOAD_FAILED' });
            }
            // Replace the image at imgIndex with the newly uploaded one
            const oldImage = existingImages[imgIndex];
            const newVariantImages = [...existingImages];
            newVariantImages[imgIndex] = uploadedImage;
            // Update variant document
            const updatedVariant = await uploadService.executeWithUploadRollback([uploadedImage], async () => {
                return variantRepository.updateById(variant.id, { variantImages: newVariantImages });
            }, { rollbackLogCode: 'VARIANT_IMAGE_UPDATE_ROLLBACK' });

            // delete old image from cloud storage (best-effort)
            if (oldImage?.fileId) {
                await uploadService.deleteImages([oldImage.fileId]);
            }

            return updatedVariant.variantImages[imgIndex];
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update variant image', { statusCode: 500, code: 'UPDATE_VARIANT_IMAGE_ERROR', details: error.message });
        }
    }

    /**
     * permantently delete a variant by id
     * return true of false
     */
    async deleteVariant(variantId, currentUser) {
        try {
            if (!currentUser) {
                throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
            }
            // Fetch existing variant (repository throws ApiError if not found)
            const variant = await variantRepository.findById(variantId);
            // Fetch parent product
            const product = await productRepository.findById(variant.productId);
            // Ownership / role: seller must own product; admin allowed
            if (currentUser.role === 'seller') {
                if (product.sellerId?.toString() !== currentUser.id) {
                    throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
                }
            } else if (!['admin'].includes(currentUser.role)) {
                throw new ApiError('Insufficient permissions to delete variant', { statusCode: 403, code: 'FORBIDDEN' });
            }
            // If product is inactive, cannot delete variant
            if (product.isActive === false) {
                throw new ApiError('Cannot delete variant of an inactive product', { statusCode: 400, code: 'PRODUCT_INACTIVE' });
            }
            // Delete variant
            const deleted = await variantRepository.deleteById(variant.id);
            if (deleted && Array.isArray(variant.variantImages) && variant.variantImages.length > 0) {
                // Best-effort deletion of images from cloud storage
                const fileIds = variant.variantImages.map(img => img.fileId).filter(Boolean);
                if (fileIds.length > 0) {
                    await uploadService.deleteImages(fileIds);
                }
            }
            return deleted;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to delete variant', { statusCode: 500, code: 'DELETE_VARIANT_ERROR', details: error.message });
        }
    }

    /**
     * disable (soft delete) a variant by id
     * return flag indicating success
     */
    async disableVariant(variantId, currentUser) {
        try {
            if (!currentUser) {
                throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
            }
            // Fetch existing variant (repository throws ApiError if not found)
            const variant = await variantRepository.findById(variantId);
            // Fetch parent product
            const product = await productRepository.findById(variant.productId);
            // Ownership / role: seller must own product; admin allowed
            if (currentUser.role === 'seller') {
                if (product.sellerId?.toString() !== currentUser.id) {
                    throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
                }
            } else if (!['admin'].includes(currentUser.role)) {
                throw new ApiError('Insufficient permissions to disable variant', { statusCode: 403, code: 'FORBIDDEN' });
            }
            // If product is inactive, cannot disable variant
            if (product.isActive === false) {
                throw new ApiError('Cannot disable variant of an inactive product', { statusCode: 400, code: 'PRODUCT_INACTIVE' });
            }
            if (variant.isActive === false) {
                return variant; // already disabled
            }
            const disabled = await variantRepository.updateById(variant.id, { isActive: false });
            return disabled;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to disable variant', { statusCode: 500, code: 'DISABLE_VARIANT_ERROR', details: error.message });
        }
    }

    /**
     * enable (undo soft delete) a variant by id
     * return flag indicating success
     */
    async enableVariant(variantId, currentUser) {
        try {
            if (!currentUser) {
                throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
            }
            // Fetch existing variant (repository throws ApiError if not found)
            const variant = await variantRepository.findById(variantId);
            // Fetch parent product
            const product = await productRepository.findById(variant.productId);
            // Ownership / role: seller must own product; admin allowed
            if (currentUser.role === 'seller') {
                if (product.sellerId?.toString() !== currentUser.id) {
                    throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
                }
            }
            else if (!['admin'].includes(currentUser.role)) {
                throw new ApiError('Insufficient permissions to enable variant', { statusCode: 403, code: 'FORBIDDEN' });
            }
            if (variant.isActive === true) {
                return variant; // already enabled
            }
            const enabled = await variantRepository.updateById(variant.id, { isActive: true });
            return enabled;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to enable variant', { statusCode: 500, code: 'ENABLE_VARIANT_ERROR', details: error.message });
        }

    }

    /**
     * get variant by id
     * returns variant object
     */
    async getVariantById(variantId) {
        try {
            const variant = await variantRepository.findById(variantId);
            return variant;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch variant', { statusCode: 500, code: 'FETCH_VARIANT_ERROR', details: error.message });
        }
    }
    /**
     * get all variants for a product id
     * returns array of variant objects
     */
    async getVariantsByProductId(productId) {
        try {
            const variants = await variantRepository.findByProductId(productId);
            return variants;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch variants', { statusCode: 500, code: 'FETCH_VARIANTS_ERROR', details: error.message });
        }
    }

    /**
     * Get all variants with pagination and filtering.
     * Supports variant-field filters and basic ranges. Product-level filters can be added later via aggregation.
     */
    async getAllVariants(query = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                productId,
                sku,
                currency,
                baseUnit,
                isActive,
                ids,
                q,
                sort,
                fields,
                createdFrom,
                createdTo,
                updatedFrom,
                updatedTo,
                priceMin,
                priceMax,
                stockMin,
                stockMax,
                // product-linked filters (reserved for later): sellerId, categoryId, brand, productIsActive
            } = query;

            const filter = {};

            if (productId) filter.productId = productId;
            if (sku) filter.sku = sku;
            if (currency) filter.currency = currency;
            if (baseUnit) filter.baseUnit = baseUnit;
            if (isActive !== undefined) {
                if (isActive === true || isActive === 'true') filter.isActive = true;
                else if (isActive === false || isActive === 'false') filter.isActive = false;
            }
            if (ids) {
                const idArray = ids.split(',').map(v => v.trim()).filter(Boolean);
                if (idArray.length) {
                    filter._id = { $in: idArray.map(id => new mongoose.Types.ObjectId(id)) };
                }
            }
            // numeric ranges
            if (priceMin != null || priceMax != null) {
                filter.price = {};
                if (priceMin != null) filter.price.$gte = Number(priceMin);
                if (priceMax != null) filter.price.$lte = Number(priceMax);
            }
            if (stockMin != null || stockMax != null) {
                filter.stock = {};
                if (stockMin != null) filter.stock.$gte = Number(stockMin);
                if (stockMax != null) filter.stock.$lte = Number(stockMax);
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
            // free text: simple regex on sku
            if (q) {
                filter.$or = [
                    { sku: { $regex: new RegExp(q, 'i') } },
                ];
            }

            // projection
            let projection = undefined;
            if (fields) {
                projection = fields.split(',').reduce((acc, f) => { acc[f] = 1; return acc; }, { _id: 1 });
            }

            // sort
            let sortObj = { createdAt: -1 };
            if (sort) {
                sortObj = {};
                sort.split(',').forEach(part => {
                    if (part.startsWith('-')) sortObj[part.slice(1)] = -1; else sortObj[part] = 1;
                });
            }

            const pageNum = Number(page) || 1;
            const limitNum = Number(limit) || 20;
            const skip = (pageNum - 1) * limitNum;

            const [items, total] = await Promise.all([
                variantRepository.model.find(filter).select(projection).sort(sortObj).skip(skip).limit(limitNum).lean(),
                variantRepository.model.countDocuments(filter)
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
                count: items.length,
            };
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch variants', { statusCode: 500, code: 'FETCH_VARIANTS_ERROR', details: error.message });
        }
    }

}

export default new VariantService();
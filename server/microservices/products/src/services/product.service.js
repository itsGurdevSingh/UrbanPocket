import productRepository from '../repositories/product.repository.js';
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
     
    async getAllProducts() {
        try {
            return productRepository.findAll();
        } catch (error) {
            // logger.error('Error in service layer while fetching products:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch products', { statusCode: 500, code: 'FETCH_PRODUCTS_FAILED', details: error.message });
        }
    }
}

export default new productService();
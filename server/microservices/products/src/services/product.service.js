import sampleRepository from '../repositories/product.repository.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Sample service template
 * Replace 'Sample' with your actual service name
 */
class productService {
    async createProduct(productData) {
        try {
            // Call your repository layer to create a product
            const product = await sampleRepository.create(productData);
            return product;
        } catch (error) {
            logger.error('Error in service layer while creating product:', error);
            throw new ApiError('Service Error: Failed to create product', { statusCode: 500, code: 'SERVICE_CREATE_PRODUCT_ERROR', details: error.message });
        }
}
}

export default new productService();
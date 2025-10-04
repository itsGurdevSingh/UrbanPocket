import productRepository from '../repositories/product.repository.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Product service class
 * Handles business logic for product operations
 */
class ProductService {
    async createProduct(productData) {
        try {
            // Validate required fields
            if (!productData.name || !productData.description || !productData.sellerId) {
                throw new ApiError('Missing required fields', { statusCode: 400, code: 'VALIDATION_ERROR' });
            }

            // Call repository layer to create a product
            const product = await productRepository.create(productData);
            return product;
        } catch (error) {
            logger.error('Error in service layer while creating product:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Service Error: Failed to create product', { statusCode: 500, code: 'SERVICE_CREATE_PRODUCT_ERROR', details: error.message });
        }
    }

    async getAllProducts() {
        try {
            const products = await productRepository.findAll();
            return products;
        } catch (error) {
            logger.error('Error in service layer while fetching products:', error);
            throw new ApiError('Service Error: Failed to fetch products', { statusCode: 500, code: 'SERVICE_FETCH_PRODUCTS_ERROR', details: error.message });
        }
    }

    async getProductById(id) {
        try {
            const product = await productRepository.findById(id);
            return product;
        } catch (error) {
            logger.error('Error in service layer while fetching product:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Service Error: Failed to fetch product', { statusCode: 500, code: 'SERVICE_FETCH_PRODUCT_ERROR', details: error.message });
        }
    }

    async updateProduct(id, updateData) {
        try {
            const product = await productRepository.updateById(id, updateData);
            return product;
        } catch (error) {
            logger.error('Error in service layer while updating product:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Service Error: Failed to update product', { statusCode: 500, code: 'SERVICE_UPDATE_PRODUCT_ERROR', details: error.message });
        }
    }

    async deleteProduct(id) {
        try {
            const product = await productRepository.deleteById(id);
            return product;
        } catch (error) {
            logger.error('Error in service layer while deleting product:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError('Service Error: Failed to delete product', { statusCode: 500, code: 'SERVICE_DELETE_PRODUCT_ERROR', details: error.message });
        }
    }

    async getProductsBySellerId(sellerId) {
        try {
            const products = await productRepository.findBySellerId(sellerId);
            return products;
        } catch (error) {
            logger.error('Error in service layer while fetching products by seller:', error);
            throw new ApiError('Service Error: Failed to fetch products by seller', { statusCode: 500, code: 'SERVICE_FETCH_SELLER_PRODUCTS_ERROR', details: error.message });
        }
    }
}

export default new ProductService();
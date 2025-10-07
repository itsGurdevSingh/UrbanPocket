import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import productService from '../services/product.service.js';

class productController {

    async createProduct(req, res, next) {
        try {
            // Pass body and uploaded files to service (service will upload images after uniqueness check)
            const product = await productService.createProduct(req.body, req.files || []);

            res.status(201).json({
                status: 'success',
                message: 'Product created successfully',
                product: product || {} // return created product details
            });
        } catch (error) {
            logger.error('Error creating product:', error);
            // If the service already produced an ApiError (e.g. validation/duplicate/no images/upload failure)
            // propagate it so the global handler returns the intended status & code.
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to create product', { statusCode: 500, code: 'CREATE_PRODUCT_ERROR', details: error.message }));
        }
    }

    async getAllProducts(req, res, next) {
        try {
            const result = await productService.getAllProducts(req.query || {});
            res.status(200).json({
                status: 'success',
                products: result.data || [],
                meta: result.meta,
                count: result.count // backward compatibility
            });
        } catch (error) {
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to fetch products', { statusCode: 500, code: 'FETCH_PRODUCTS_ERROR', details: error.message }));
        }
    }

    async getProductById(req, res, next) {
        try {
            const productId = req.params.id;
            const product = await productService.getProductById(productId);
            if (!product) {
                return next(new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
            }
            res.status(200).json({
                status: 'success',
                product: product
            });
        } catch (error) {
            logger.error('Error fetching product by ID:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to fetch product', { statusCode: 500, code: 'FETCH_PRODUCT_ERROR', details: error.message }));
        }
    }

    async deleteProduct(req, res, next) {
        try {
            const productId = req.params.id;
            const deleted = await productService.deleteProduct(productId);

            if (!deleted) {
                return next(new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
            }
            res.status(200).json({
                status: 'success',
                message: 'Product deleted successfully'
            });
        }
        catch (error) {
            logger.error('Error deleting product:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to delete product', { statusCode: 500, code: 'DELETE_PRODUCT_ERROR', details: error.message }));
        }
    }
}

export default new productController();
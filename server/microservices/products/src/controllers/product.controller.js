import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import productService from '../services/product.service.js';

class productController {

    async createProduct(req, res, next) {
        try {
            // Pass body and uploaded files to service (service will upload images after uniqueness check)
            const product = await productService.createProduct(req.body, req.files || [],req.user);

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

    async updateProduct(req, res, next) {
        try {
            // Pass body and uploaded files to service (service will handle image uploads if any)
            const productId = req.params.id;
            const updatedProduct = await productService.updateProduct(productId, req.body, req.files || [], req.user);
            if (!updatedProduct) {
                return next(new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
            }
            res.status(200).json({
                status: 'success',
                message: 'Product updated successfully',
                product: updatedProduct
            });
        } catch (error) {
            logger.error('Error updating product:', error);
            if (error instanceof ApiError) {
                return next(error);
            }

            return next(new ApiError('Failed to update product', { statusCode: 500, code: 'UPDATE_PRODUCT_ERROR', details: error.message }));
        }
    }

    async updateProductImage(req, res, next) {
        try {
            const productId = req.params.id;
            const fileId = req.params.fileId;
            const updatedImage = await productService.updateProductImage(productId, fileId, req.file, req.user);
            // Service returns null only when product not found; distinguish vs missing image (handled by service throwing PRODUCT_IMAGE_NOT_FOUND)
            if (!updatedImage) {
                return next(new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
            }
            res.status(200).json({
                status: 'success',
                message: 'Product image updated successfully',
                product: updatedImage
            });
        }
        catch (error) {
            logger.error('Error updating product image:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to update product image', { statusCode: 500, code: 'UPDATE_PRODUCT_IMAGE_ERROR', details: error.message }));
        }
    }

    async deleteProduct(req, res, next) {
        try {
            const productId = req.params.id;
            const deleted = await productService.deleteProduct(productId, req.user);

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

    async disableProduct(req, res, next) {
        try {
            const productId = req.params.id;
            const disabled = await productService.disableProduct(productId, req.user);
            if (!disabled) {
                return next(new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
            }
            res.status(200).json({
                status: 'success',
                message: 'Product disabled successfully'
            });
        } catch (error) {
            logger.error('Error disabling product:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to disable product', { statusCode: 500, code: 'DISABLE_PRODUCT_ERROR', details: error.message }));
        }
    }

    async enableProduct(req, res, next) {
        try {
            const productId = req.params.id;
            const enabled = await productService.enableProduct(productId, req.user);
            if (!enabled) {
                return next(new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
            }
            res.status(200).json({
                status: 'success',
                message: 'Product enabled successfully'
            });
        } catch (error) {
            logger.error('Error enabling product:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to enable product', { statusCode: 500, code: 'ENABLE_PRODUCT_ERROR', details: error.message }));
        }
    }
}

export default new productController();
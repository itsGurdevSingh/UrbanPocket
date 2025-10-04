import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import productService from '../services/product.service.js';

class ProductController {
    // CRUD Routes for products
    // router.post('/', authenticateRole(['seller','admin']), productController.createProduct);
    // router.get('/', productController.getAllProducts);
    // router.get('/:id', productController.getProductById);
    // router.put('/:id', authenticateRole(['seller','admin']), productController.updateProduct);
    // router.delete('/:id', authenticateRole(['seller','admin']), productController.deleteProduct);

    async createProduct(req, res, next) {
        try {
            //call your service layer to create product
            const productData = { ...req.body, sellerId: req.user.id };
            const product = await productService.createProduct(productData);

            res.status(201).json({
                status: 'success',
                message: 'Product created successfully',
                product: product || {} // return created product details
            });
        } catch (error) {
            logger.error('Error creating product:', error);
            next(new ApiError('Failed to create product', { statusCode: 500, code: 'CREATE_PRODUCT_ERROR', details: error.message }));
        }
    }

    async getAllProducts(req, res, next) {
        try {
            const products = await productService.getAllProducts();

            res.status(200).json({
                status: 'success',
                results: products.length,
                products: products
            });
        } catch (error) {
            logger.error('Error fetching products:', error);
            next(new ApiError('Failed to fetch products', { statusCode: 500, code: 'FETCH_PRODUCTS_ERROR', details: error.message }));
        }
    }

    async getProductById(req, res, next) {
        try {
            const { id } = req.params;
            const product = await productService.getProductById(id);

            res.status(200).json({
                status: 'success',
                product: product
            });
        } catch (error) {
            logger.error('Error fetching product:', error);
            next(error);
        }
    }

    async updateProduct(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const product = await productService.updateProduct(id, updateData);

            res.status(200).json({
                status: 'success',
                message: 'Product updated successfully',
                product: product
            });
        } catch (error) {
            logger.error('Error updating product:', error);
            next(error);
        }
    }

    async deleteProduct(req, res, next) {
        try {
            const { id } = req.params;
            await productService.deleteProduct(id);

            res.status(200).json({
                status: 'success',
                message: 'Product deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting product:', error);
            next(error);
        }
    }
}

export default new ProductController();
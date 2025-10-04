import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import productService from '../services/product.service.js';

class productController {
    // CRUD Routes for products
// router.post('/', authenticateSeller, productController.createProduct);
// router.get('/', productController.getAllProducts);
// router.get('/:id', productController.getProductById);
// router.put('/:id', authenticateSeller, productController.updateProduct);
// router.delete('/:id', authenticateSeller, productController.deleteProduct);

    async createProduct(req, res, next) {
        try {
            //call your service layer to create product
            const product = await productService.createProduct(req.body);

            res.status(201).json({
                status: 'success',
                 message: 'Product created successfully' ,
                 product: product || {} // return created product details
                });
        } catch (error) {
            logger.error('Error creating product:', error);
            next(new ApiError('Failed to create product', { statusCode: 500, code: 'CREATE_PRODUCT_ERROR', details: error.message }));
        }
    }
}

export default new productController();
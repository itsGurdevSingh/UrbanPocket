import express from 'express';
import productController from '../controllers/product.controller.js';
import authenticateRole from '../middlewares/authenticateUser.js';
import { createProductValidation } from '../validators/product.validator.js';
import { uploadProductImages } from '../middlewares/upload.js';
import { parseJsonFields} from '../middlewares/reqLog.js';

const router = express.Router();

// CRUD Routes for products
// Order: auth -> file upload -> map files -> validation -> handle errors -> controller
router.post(
    '/create',
    uploadProductImages, // multer memory storage
    parseJsonFields, //parse JSON fields like attributes, baseImages from postman/form-data
    authenticateRole(['seller', 'admin']),
    createProductValidation,
    productController.createProduct
);

// router.get('/', productController.getAllProducts);
// router.get('/:id', productController.getProductById);
// router.put('/:id', authenticateSeller, productController.updateProduct);
// router.delete('/:id', authenticateSeller, productController.deleteProduct);


// Example of a protected route
router.get('/protected', authenticateRole(['seller', 'admin']), (req, res) => {
    res.json({ message: 'This is a protected route' });
});





export default router;
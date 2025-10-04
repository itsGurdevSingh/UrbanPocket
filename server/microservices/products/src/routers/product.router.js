import express from 'express';
import productController from '../controllers/product.controller.js';
import authenticateRole from '../middlewares/authenticateUser.js';

const router = express.Router();

// CRUD Routes for products
router.post('/', authenticateRole(['seller','admin']), productController.createProduct);
// router.get('/', productController.getAllProducts);
// router.get('/:id', productController.getProductById);
// router.put('/:id', authenticateSeller, productController.updateProduct);
// router.delete('/:id', authenticateSeller, productController.deleteProduct);


// Example of a protected route
router.get('/protected', authenticateRole(['seller','admin']) ,(req, res) => {
    res.json({ message: 'This is a protected route' });
});





export default router;
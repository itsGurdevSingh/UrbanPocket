import express from 'express';
import productController from '../controllers/product.controller.js';
import {authenticateRole,  authenticate } from '../middlewares/authenticateUser.js';
import { createProductValidation, getByIdValidation, getAllProductsValidation, updateProductValidation, updateProductImageValidation, productIdValidation } from '../validators/product.validator.js';
import { uploadProductImages, uploadSingleProductImage } from '../middlewares/upload.js';
import { reqLog, parseJsonFields } from '../middlewares/reqLog.js';

const router = express.Router();

// CRUD Routes for products
// Order: auth -> file upload -> map files -> validation -> handle errors -> controller

// protected routes for sellers/admins
router.post(
    '/create',
    uploadProductImages, // multer memory storage
    reqLog, // log request for debugging
    parseJsonFields, //parse JSON fields like attributes, baseImages from postman/form-data
    authenticateRole(['seller', 'admin']),
    createProductValidation,
    productController.createProduct
);

// update full product - only seller or admin can update
router.put(
    '/:id',
    uploadProductImages, // multer memory storage
    parseJsonFields, //parse JSON fields like attributes, baseImages from postman/form-data
    authenticateRole(['seller', 'admin']),
    updateProductValidation,
    productController.updateProduct
);

// update single image for product - only seller or admin can update
// /prductid/fileID 
router.put(
    '/:id/:fileId/',
    uploadSingleProductImage, // multer memory storage
    updateProductImageValidation,
    authenticateRole(['seller', 'admin']),
    productController.updateProductImage
);
// delete product - only seller or admin can delete
router.delete(
    '/:id',
    productIdValidation,
    authenticateRole(['seller', 'admin']),
    productController.deleteProduct
);

// disable product - only seller or admin can disable (soft delete)
router.patch(
    '/:id/disable',
    productIdValidation, // verify is valid id
    authenticateRole(['seller', 'admin']),
    productController.disableProduct
);

// enable product - only seller or admin can enable (soft undelete)
router.patch(
    '/:id/enable',
    productIdValidation, // verify is valid id
    authenticateRole(['seller', 'admin']),
    productController.enableProduct
);

// general routes for all roles 

// get all products - any authenticated user
router.get(
    '/getAll',
    authenticate, // any authenticated user regardless of role
    getAllProductsValidation,
    productController.getAllProducts
);
// get products by id - any authenticated user
router.get(
    '/:id',
    getByIdValidation, // validate first so we save costly authentication from other service .
    authenticate, // any login user
    productController.getProductById
);

// router.put('/:id', authenticateSeller, productController.updateProduct);


// Example of a protected route
router.get('/protected', authenticateRole(['seller', 'admin']), (req, res) => {
    res.json({ message: 'This is a protected route' });
});





export default router;
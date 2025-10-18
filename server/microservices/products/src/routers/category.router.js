import express from 'express';
import categoryController from '../controllers/category.controller.js';
import { authenticateRole, authenticate } from '../middlewares/authenticateUser.js';
import { createCategoryValidation, updateCategoryValidation, categoryIdValidation, getAllCategoriesValidation } from '../validators/category.validator.js';

const router = express.Router();

// GET /api/category/getAll - public (no auth required per docs)
router.get('/getAll', getAllCategoriesValidation, categoryController.getAllCategories);

// POST /api/category/create - only admin
router.post('/create', authenticateRole(['admin']), createCategoryValidation, categoryController.createCategory);

// GET /api/category/:id - public (no auth required per docs)
router.get('/:id', categoryIdValidation, categoryController.getCategoryById);

// PUT /api/category/:id - only admin
router.put('/:id', authenticateRole(['admin']), updateCategoryValidation, categoryController.updateCategory);

// DELETE /api/category/:id - only admin
router.delete('/:id', authenticateRole(['admin']), categoryIdValidation, categoryController.deleteCategory);

// PATCH /api/category/:id/disable - only admin
router.patch('/:id/disable', authenticateRole(['admin']), categoryIdValidation, categoryController.disableCategory);

// PATCH /api/category/:id/enable - only admin
router.patch('/:id/enable', authenticateRole(['admin']), categoryIdValidation, categoryController.enableCategory);

export default router;

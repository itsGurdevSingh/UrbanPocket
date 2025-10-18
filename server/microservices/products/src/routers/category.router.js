import express from 'express';
import categoryController from '../controllers/category.controller.js';
import { authenticateRole, authenticate } from '../middlewares/authenticateUser.js';
import { createCategoryValidation, updateCategoryValidation, categoryIdValidation } from '../validators/category.validator.js';

const router = express.Router();

// POST /api/category/create - only admin
router.post('/create', authenticateRole(['admin']), createCategoryValidation, categoryController.createCategory);

// GET /api/category/:id - public (no auth required per docs)
router.get('/:id', categoryIdValidation, categoryController.getCategoryById);

// PUT /api/category/:id - only admin
router.put('/:id', authenticateRole(['admin']), updateCategoryValidation, categoryController.updateCategory);

// DELETE /api/category/:id - only admin
router.delete('/:id', authenticateRole(['admin']), categoryIdValidation, categoryController.deleteCategory);

export default router;

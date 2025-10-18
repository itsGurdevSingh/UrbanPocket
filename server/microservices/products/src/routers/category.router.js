import express from 'express';
import categoryController from '../controllers/category.controller.js';
import { authenticateRole } from '../middlewares/authenticateUser.js';
import { createCategoryValidation } from '../validators/category.validator.js';

const router = express.Router();

// POST /api/category/create - only admin
router.post('/create', authenticateRole(['admin']), createCategoryValidation, categoryController.createCategory);

export default router;

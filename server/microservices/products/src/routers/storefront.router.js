import express from 'express';
import storefrontController from '../controllers/storefront.controller.js';
import { storefrontSearchValidation } from '../validators/storefront.validator.js';

const router = express.Router();

// Public route for searching products with validation
router.get('/search', storefrontSearchValidation, storefrontController.search);

export default router;

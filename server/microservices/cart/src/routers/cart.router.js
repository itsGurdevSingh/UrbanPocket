import express from 'express';
import cartController from '../controllers/cart.controller.js';
import { authenticate } from '../middlewares/authenticateUser.js';
import {
    validateAddCartItem,
    validateUpdateCartItem,
    validateRemoveCartItem
} from '../validators/cart.validator.js';

const router = express.Router();

/**
 * All cart routes require authentication
 * User must be logged in to access their cart
 */

// GET /api/cart - Get or create active cart for authenticated user
router.get('/', authenticate, cartController.getCart);

// POST /api/cart/items - Add item to cart or update quantity
router.post('/items', authenticate, validateAddCartItem, cartController.addItemToCart);

// PATCH /api/cart/items/:itemId - Update cart item quantity
router.patch('/items/:itemId', authenticate, validateUpdateCartItem, cartController.updateCartItem);

// DELETE /api/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', authenticate, validateRemoveCartItem, cartController.removeCartItem);

// DELETE /api/cart/clear - Clear all items from cart
router.delete('/clear', authenticate, cartController.clearCart);

export default router;
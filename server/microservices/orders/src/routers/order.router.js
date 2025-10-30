// src/routers/order.router.js
import express from 'express';
import orderController from '../controllers/order.controller.js';
import { authenticate } from '../middlewares/authenticateUser.js';
import {
    validateCreateOrder,
    validateGetOrder,
    validateUpdateOrder,
    validateOrderQuery
} from '../validators/order.validator.js';

const router = express.Router();

/**
 * All order routes require authentication
 * User must be logged in to access their orders
 */

// TODO: Uncomment and implement these routes as needed

// POST /api/orders - Create new order
// router.post('/', authenticate, validateCreateOrder, orderController.createOrder);

// GET /api/orders - List all orders for authenticated user
// router.get('/', authenticate, validateOrderQuery, orderController.listOrders);

// GET /api/orders/:orderId - Get specific order by ID
// router.get('/:orderId', authenticate, validateGetOrder, orderController.getOrder);

// PATCH /api/orders/:orderId - Update order (e.g., change shipping address)
// router.patch('/:orderId', authenticate, validateUpdateOrder, orderController.updateOrder);

// DELETE /api/orders/:orderId - Cancel order
// router.delete('/:orderId', authenticate, validateGetOrder, orderController.cancelOrder);

// TODO: Add additional routes as needed
// Example: GET /api/orders/:orderId/track - Track order
// Example: POST /api/orders/:orderId/return - Request return
// Example: GET /api/orders/:orderId/invoice - Get invoice

export default router;

import cartService from '../services/cart.service.js';
import { ApiResponse } from '../utils/success.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

class CartController {
    /**
     * GET /api/cart
     * Get or create active cart for authenticated user
     */
    async getCart(req, res, next) {
        try {
            const userId = req.user.id;
            const cart = await cartService.getOrCreateCart(userId);

            res.status(200).json(
                new ApiResponse(cart, 'Cart retrieved successfully')
            );
        } catch (error) {
            logger.error('Error in getCart controller:', error);
            if (error instanceof ApiError) return next(error);
            return next(
                new ApiError('Failed to retrieve cart', {
                    statusCode: 500,
                    code: 'GET_CART_ERROR',
                    details: error.message
                })
            );
        }
    }

    /**
     * POST /api/cart/items
     * Add item to cart or update quantity if exists
     */
    async addItemToCart(req, res, next) {
        try {
            const userId = req.user.id;
            const { variantId, quantity } = req.body;

            if (!variantId) {
                throw new ApiError('Variant ID is required', {
                    statusCode: 400,
                    code: 'MISSING_VARIANT_ID'
                });
            }

            const cart = await cartService.addItemToCart(userId, { variantId, quantity });

            res.status(200).json(
                new ApiResponse(cart, 'Item added to cart successfully')
            );
        } catch (error) {
            logger.error('Error in addItemToCart controller:', error);
            if (error instanceof ApiError) return next(error);
            return next(
                new ApiError('Failed to add item to cart', {
                    statusCode: 500,
                    code: 'ADD_ITEM_ERROR',
                    details: error.message
                })
            );
        }
    }

    /**
     * PATCH /api/cart/items/:itemId
     * Update cart item quantity
     */
    async updateCartItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { itemId } = req.params;
            const { quantity } = req.body;

            if (quantity === undefined || quantity === null) {
                throw new ApiError('Quantity is required', {
                    statusCode: 400,
                    code: 'MISSING_QUANTITY'
                });
            }

            const cart = await cartService.updateCartItem(userId, itemId, quantity);

            res.status(200).json(
                new ApiResponse(cart, 'Cart item updated successfully')
            );
        } catch (error) {
            logger.error('Error in updateCartItem controller:', error);
            if (error instanceof ApiError) return next(error);
            return next(
                new ApiError('Failed to update cart item', {
                    statusCode: 500,
                    code: 'UPDATE_ITEM_ERROR',
                    details: error.message
                })
            );
        }
    }

    /**
     * DELETE /api/cart/items/:itemId
     * Remove item from cart
     */
    async removeCartItem(req, res, next) {
        try {
            const userId = req.user.id;
            const { itemId } = req.params;

            const cart = await cartService.removeCartItem(userId, itemId);

            res.status(200).json(
                new ApiResponse(cart, 'Item removed from cart successfully')
            );
        } catch (error) {
            logger.error('Error in removeCartItem controller:', error);
            if (error instanceof ApiError) return next(error);
            return next(
                new ApiError('Failed to remove item from cart', {
                    statusCode: 500,
                    code: 'REMOVE_ITEM_ERROR',
                    details: error.message
                })
            );
        }
    }

    /**
     * DELETE /api/cart/clear
     * Clear all items from cart
     */
    async clearCart(req, res, next) {
        try {
            const userId = req.user.id;
            const cart = await cartService.clearCart(userId);

            res.status(200).json(
                new ApiResponse(cart, 'Cart cleared successfully')
            );
        } catch (error) {
            logger.error('Error in clearCart controller:', error);
            if (error instanceof ApiError) return next(error);
            return next(
                new ApiError('Failed to clear cart', {
                    statusCode: 500,
                    code: 'CLEAR_CART_ERROR',
                    details: error.message
                })
            );
        }
    }
}

export default new CartController();
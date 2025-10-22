import cartRepository from '../repositories/cart.repository.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

class CartService {
    /**
     * Get or create cart for user
     * If cart exists, return it. Otherwise, create a new one.
     * Cart is always active - order service clears it after successful order.
     * @param {string} userId - User's ObjectId
     * @returns {Promise<Object>} Cart document
     */
    async getOrCreateCart(userId) {
        try {
            // Try to find cart for user
            let cart = await cartRepository.findByUserId(userId);

            // If no cart exists, create a new one
            if (!cart) {
                logger.info(`Creating new cart for user: ${userId}`);
                const newCart = await cartRepository.create({
                    userId,
                    items: []
                });
                // Convert to plain object
                cart = newCart.toObject ? newCart.toObject() : newCart;
            }

            return cart;
        } catch (error) {
            logger.error('Error getting or creating cart:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to retrieve cart', {
                statusCode: 500,
                code: 'GET_CART_FAILED',
                details: error.message
            });
        }
    }

    /**
     * Add item to cart or update quantity if exists
     * @param {string} userId - User's ObjectId
     * @param {Object} itemData - { variantId, quantity }
     * @returns {Promise<Object>} Updated cart
     */
    async addItemToCart(userId, itemData) {
        try {
            let { variantId, quantity } = itemData;

            // Default quantity to 1 if not provided
            quantity = quantity || 1;

            // Validate quantity
            if (quantity < 1) {
                throw new ApiError('Quantity must be at least 1', {
                    statusCode: 400,
                    code: 'INVALID_QUANTITY'
                });
            }

            // TODO: Validate variant exists by calling product service
            // For now, we'll just add it to cart

            const cart = await cartRepository.addOrUpdateItem(userId, { variantId, quantity });
            return cart;
        } catch (error) {
            logger.error('Error adding item to cart:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to add item to cart', {
                statusCode: 500,
                code: 'ADD_ITEM_FAILED',
                details: error.message
            });
        }
    }

    /**
     * Update cart item quantity
     * @param {string} userId - User's ObjectId
     * @param {string} itemId - Cart item's ObjectId
     * @param {number} quantity - New quantity (0 to remove)
     * @returns {Promise<Object>} Updated cart
     */
    async updateCartItem(userId, itemId, quantity) {
        try {
            // If quantity is 0, remove the item
            if (quantity === 0) {
                return await this.removeCartItem(userId, itemId);
            }

            // Validate quantity
            if (quantity < 0) {
                throw new ApiError('Quantity cannot be negative', {
                    statusCode: 400,
                    code: 'INVALID_QUANTITY'
                });
            }

            // Find cart and update item
            const cart = await cartRepository.findByUserId(userId);
            if (!cart) {
                throw new ApiError('Cart not found', {
                    statusCode: 404,
                    code: 'CART_NOT_FOUND'
                });
            }

            // Find item in cart
            const itemIndex = cart.items.findIndex(
                item => item._id.toString() === itemId
            );

            if (itemIndex === -1) {
                throw new ApiError('Item not found in cart', {
                    statusCode: 404,
                    code: 'CART_ITEM_NOT_FOUND'
                });
            }

            // Update quantity
            cart.items[itemIndex].quantity = quantity;
            const updatedCart = await cartRepository.updateById(cart._id, { items: cart.items });

            return updatedCart;
        } catch (error) {
            logger.error('Error updating cart item:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update cart item', {
                statusCode: 500,
                code: 'UPDATE_ITEM_FAILED',
                details: error.message
            });
        }
    }

    /**
     * Remove item from cart
     * @param {string} userId - User's ObjectId
     * @param {string} itemId - Cart item's ObjectId
     * @returns {Promise<Object>} Updated cart
     */
    async removeCartItem(userId, itemId) {
        try {
            // First check if cart exists and has the item
            const cart = await cartRepository.findByUserId(userId);
            if (!cart) {
                throw new ApiError('Cart not found', {
                    statusCode: 404,
                    code: 'CART_NOT_FOUND'
                });
            }

            // Check if item exists in cart
            const itemExists = cart.items.some(item => item._id.toString() === itemId);
            if (!itemExists) {
                throw new ApiError('Item not found in cart', {
                    statusCode: 404,
                    code: 'CART_ITEM_NOT_FOUND'
                });
            }

            // Remove the item
            const updatedCart = await cartRepository.removeItem(userId, itemId);
            return updatedCart;
        } catch (error) {
            logger.error('Error removing cart item:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to remove item from cart', {
                statusCode: 500,
                code: 'REMOVE_ITEM_FAILED',
                details: error.message
            });
        }
    }

    /**
     * Clear all items from cart
     * @param {string} userId - User's ObjectId
     * @returns {Promise<Object>} Cleared cart
     */
    async clearCart(userId) {
        try {
            const cart = await cartRepository.clearItems(userId);
            return cart;
        } catch (error) {
            logger.error('Error clearing cart:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to clear cart', {
                statusCode: 500,
                code: 'CLEAR_CART_FAILED',
                details: error.message
            });
        }
    }
}

export default new CartService();
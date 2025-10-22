import { Cart } from '../models/cart.model.js';
import { ApiError } from '../utils/errors.js';

class CartRepository {
    constructor() {
        this.model = Cart;
    }

    /**
     * Find a cart by userId
     * @param {string} userId - User's ObjectId
     * @returns {Promise<Object|null>} Cart document or null
     */
    async findByUserId(userId) {
        return await Cart.findOne({ userId }).lean();
    }

    /**
     * Create a new cart
     * @param {Object} cartData - Cart data
     * @returns {Promise<Object>} Created cart document
     */
    async create(cartData) {
        return await Cart.create(cartData);
    }

    /**
     * Find cart by ID
     * @param {string} cartId - Cart's ObjectId
     * @returns {Promise<Object>} Cart document
     * @throws {ApiError} If cart not found
     */
    async findById(cartId) {
        const cart = await Cart.findById(cartId);
        if (!cart) {
            throw new ApiError('Cart not found', { statusCode: 404, code: 'CART_NOT_FOUND' });
        }
        return cart;
    }

    /**
     * Update cart by ID
     * @param {string} cartId - Cart's ObjectId
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated cart document
     * @throws {ApiError} If cart not found
     */
    async updateById(cartId, updateData) {
        const cart = await Cart.findByIdAndUpdate(cartId, updateData, {
            new: true,
            runValidators: true
        });
        if (!cart) {
            throw new ApiError('Cart not found', { statusCode: 404, code: 'CART_NOT_FOUND' });
        }
        return cart;
    }

    /**
     * Delete cart by ID
     * @param {string} cartId - Cart's ObjectId
     * @returns {Promise<Object>} Deleted cart document
     * @throws {ApiError} If cart not found
     */
    async deleteById(cartId) {
        const cart = await Cart.findByIdAndDelete(cartId);
        if (!cart) {
            throw new ApiError('Cart not found', { statusCode: 404, code: 'CART_NOT_FOUND' });
        }
        return cart;
    }

    /**
     * Add or update item in cart
     * @param {string} userId - User's ObjectId
     * @param {Object} itemData - Item data (variantId, quantity)
     * @returns {Promise<Object>} Updated cart document
     */
    async addOrUpdateItem(userId, itemData) {
        const { variantId, quantity } = itemData;

        // Try to find existing item in cart and update it
        let cart = await Cart.findOneAndUpdate(
            { userId, 'items.variantId': variantId },
            { $set: { 'items.$.quantity': quantity } },
            { new: true, runValidators: true }
        );

        // If item doesn't exist, add it to cart (or create cart if doesn't exist)
        if (!cart) {
            cart = await Cart.findOneAndUpdate(
                { userId },
                { $push: { items: { variantId, quantity } } },
                { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
            );
        }

        return cart;
    }

    /**
     * Remove item from cart
     * @param {string} userId - User's ObjectId
     * @param {string} itemId - Cart item's ObjectId
     * @returns {Promise<Object>} Updated cart document
     */
    async removeItem(userId, itemId) {
        const cart = await Cart.findOneAndUpdate(
            { userId },
            { $pull: { items: { _id: itemId } } },
            { new: true }
        );

        if (!cart) {
            throw new ApiError('Cart not found', { statusCode: 404, code: 'CART_NOT_FOUND' });
        }

        return cart;
    }

    /**
     * Clear all items from cart
     * @param {string} userId - User's ObjectId
     * @returns {Promise<Object>} Updated cart document
     */
    async clearItems(userId) {
        const cart = await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { new: true }
        );

        if (!cart) {
            throw new ApiError('Cart not found', { statusCode: 404, code: 'CART_NOT_FOUND' });
        }

        return cart;
    }
}

export default new CartRepository();
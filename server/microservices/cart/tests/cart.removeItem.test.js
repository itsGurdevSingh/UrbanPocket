// tests/cart.removeItem.test.js
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { Cart } from '../src/models/cart.model.js';

describe('DELETE /api/cart/items/:itemId', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const variantId1 = new mongoose.Types.ObjectId().toString();
    const variantId2 = new mongoose.Types.ObjectId().toString();
    let cartItemId;

    beforeEach(async () => {
        await Cart.deleteMany({});
        global.setTestAuthUserId(userId);

        // Create a cart with items for testing
        const cart = await Cart.create({
            userId,
            items: [
                { variantId: variantId1, quantity: 5 },
                { variantId: variantId2, quantity: 3 }
            ]
        });
        cartItemId = cart.items[0]._id.toString();
    });

    afterEach(async () => {
        await Cart.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('should remove item from cart successfully', async () => {
            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(200);

            expect(res.body).toMatchObject({
                success: true,
                message: 'Item removed from cart successfully',
                data: expect.objectContaining({
                    userId: userId,
                    items: expect.any(Array)
                })
            });

            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items.find(item => item._id === cartItemId)).toBeUndefined();
        });

        it('should preserve other items when removing one', async () => {
            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(200);

            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items[0].variantId).toBe(variantId2);
            expect(res.body.data.items[0].quantity).toBe(3);
        });

        it('should result in empty cart when removing last item', async () => {
            const cart = await Cart.findOne({ userId });
            const firstItemId = cart.items[0]._id.toString();
            const secondItemId = cart.items[1]._id.toString();

            await request(app)
                .delete(`/api/cart/items/${firstItemId}`)
                .expect(200);

            const res = await request(app)
                .delete(`/api/cart/items/${secondItemId}`)
                .expect(200);

            expect(res.body.data.items).toHaveLength(0);
        });

        it('should update updatedAt timestamp when removing item', async () => {
            const cart1 = await Cart.findOne({ userId });
            const firstUpdate = cart1.updatedAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(200);

            const cart2 = await Cart.findOne({ userId });
            expect(cart2.updatedAt.getTime()).toBeGreaterThan(firstUpdate.getTime());
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('should reject invalid itemId format', async () => {
            const res = await request(app)
                .delete('/api/cart/items/invalid-id')
                .expect(400);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: expect.any(String),
                    details: expect.arrayContaining([
                        expect.objectContaining({
                            field: 'itemId',
                            message: expect.any(String)
                        })
                    ])
                }
            });
        });
    });

    // ===== ERROR HANDLING =====
    describe('error handling', () => {
        it('should return 401 when user is not authenticated', async () => {
            global.setTestAuthFailure(true);

            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(401);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
        });

        it('should return 404 when item does not exist in cart', async () => {
            const nonExistentItemId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .delete(`/api/cart/items/${nonExistentItemId}`)
                .expect(404);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: 'CART_ITEM_NOT_FOUND',
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
        });

        it('should return 404 when cart does not exist for user', async () => {
            const newUserId = new mongoose.Types.ObjectId().toString();
            global.setTestAuthUserId(newUserId);

            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(404);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: expect.stringMatching(/NOT_FOUND|CART_NOT_FOUND/),
                    message: expect.any(String)
                }
            });
        });

        it('should return 500 with proper error structure on server errors', async () => {
            global.setTestAuthUserId('invalid-user-id');

            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(500);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: expect.any(String),
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
        });

        it('should handle attempting to remove already removed item', async () => {
            // Remove item first time
            await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(200);

            // Try to remove again
            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(404);

            expect(res.body.success).toBe(false);
        });
    });

    // ===== USER ISOLATION =====
    describe('user isolation', () => {
        it('should not allow removing items from other users\' carts', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            global.setTestAuthUserId(otherUserId);

            const res = await request(app)
                .delete(`/api/cart/items/${cartItemId}`)
                .expect(404);

            expect(res.body.success).toBe(false);

            // Verify original cart unchanged
            global.setTestAuthUserId(userId);
            const originalCart = await Cart.findOne({ userId });
            expect(originalCart.items).toHaveLength(2);
        });
    });
});

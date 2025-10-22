// tests/cart.clearCart.test.js
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { Cart } from '../src/models/cart.model.js';

describe('DELETE /api/cart/clear', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const variantId1 = new mongoose.Types.ObjectId().toString();
    const variantId2 = new mongoose.Types.ObjectId().toString();

    beforeEach(async () => {
        await Cart.deleteMany({});
        global.setTestAuthUserId(userId);
    });

    afterEach(async () => {
        await Cart.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('should clear all items from cart successfully', async () => {
            // Create cart with items
            await Cart.create({
                userId,
                items: [
                    { variantId: variantId1, quantity: 5 },
                    { variantId: variantId2, quantity: 3 }
                ]
            });

            const res = await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            expect(res.body).toMatchObject({
                success: true,
                message: 'Cart cleared successfully',
                data: expect.objectContaining({
                    userId: userId,
                    items: []
                })
            });
        });

        it('should handle clearing already empty cart', async () => {
            // Create empty cart
            await Cart.create({
                userId,
                items: []
            });

            const res = await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            expect(res.body.data.items).toEqual([]);
        });

        it('should update updatedAt timestamp when clearing cart', async () => {
            await Cart.create({
                userId,
                items: [{ variantId: variantId1, quantity: 5 }]
            });

            const cart1 = await Cart.findOne({ userId });
            const firstUpdate = cart1.updatedAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            const cart2 = await Cart.findOne({ userId });
            expect(cart2.updatedAt.getTime()).toBeGreaterThan(firstUpdate.getTime());
        });

        it('should preserve cart metadata after clearing items', async () => {
            await Cart.create({
                userId,
                items: [{ variantId: variantId1, quantity: 5 }]
            });

            const res = await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('userId', userId);
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        it('should clear cart with many items', async () => {
            const manyItems = Array.from({ length: 10 }, (_, i) => ({
                variantId: new mongoose.Types.ObjectId(),
                quantity: i + 1
            }));

            await Cart.create({
                userId,
                items: manyItems
            });

            const res = await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            expect(res.body.data.items).toHaveLength(0);

            // Verify in database
            const cart = await Cart.findOne({ userId });
            expect(cart.items).toHaveLength(0);
        });
    });

    // ===== ERROR HANDLING =====
    describe('error handling', () => {
        it('should return 401 when user is not authenticated', async () => {
            global.setTestAuthFailure(true);

            const res = await request(app)
                .delete('/api/cart/clear')
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

        it('should return 404 when cart does not exist for user', async () => {
            // No cart created for this user

            const res = await request(app)
                .delete('/api/cart/clear')
                .expect(404);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: expect.stringMatching(/NOT_FOUND|CART_NOT_FOUND/),
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
        });

        it('should return 500 with proper error structure on server errors', async () => {
            global.setTestAuthUserId('invalid-user-id');

            const res = await request(app)
                .delete('/api/cart/clear')
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
    });

    // ===== USER ISOLATION =====
    describe('user isolation', () => {
        it('should only clear authenticated user\'s cart', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();

            // Create carts for both users
            await Cart.create({
                userId,
                items: [{ variantId: variantId1, quantity: 5 }]
            });

            await Cart.create({
                userId: otherUserId,
                items: [{ variantId: variantId2, quantity: 3 }]
            });

            // Clear current user's cart
            await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            // Verify current user's cart is empty
            const userCart = await Cart.findOne({ userId });
            expect(userCart.items).toHaveLength(0);

            // Verify other user's cart is unchanged
            const otherCart = await Cart.findOne({ userId: otherUserId });
            expect(otherCart.items).toHaveLength(1);
            expect(otherCart.items[0].quantity).toBe(3);
        });
    });

    // ===== USE CASE: ORDER SERVICE INTEGRATION =====
    describe('order service integration', () => {
        it('should be idempotent - safe to call multiple times', async () => {
            await Cart.create({
                userId,
                items: [{ variantId: variantId1, quantity: 5 }]
            });

            // Clear once
            await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            // Clear again - should not fail
            const res = await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            expect(res.body.data.items).toEqual([]);
        });

        it('should prepare cart for next order after clearing', async () => {
            // Simulate order completion scenario
            await Cart.create({
                userId,
                items: [
                    { variantId: variantId1, quantity: 2 },
                    { variantId: variantId2, quantity: 1 }
                ]
            });

            // Order service clears cart
            await request(app)
                .delete('/api/cart/clear')
                .expect(200);

            // User adds new items for next order
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: new mongoose.Types.ObjectId().toString(), quantity: 1 })
                .expect(200);

            expect(res.body.data.items).toHaveLength(1);
        });
    });
});

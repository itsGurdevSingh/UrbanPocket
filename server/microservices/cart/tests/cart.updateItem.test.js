// tests/cart.updateItem.test.js
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { Cart } from '../src/models/cart.model.js';

describe('PATCH /api/cart/items/:itemId', () => {
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
        it('should update item quantity successfully', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 10 })
                .expect(200);

            expect(res.body).toMatchObject({
                success: true,
                message: 'Cart item updated successfully',
                data: expect.objectContaining({
                    userId: userId,
                    items: expect.arrayContaining([
                        expect.objectContaining({
                            _id: cartItemId,
                            quantity: 10
                        })
                    ])
                })
            });
        });

        it('should remove item when quantity is set to 0', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 0 })
                .expect(200);

            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items.find(item => item._id === cartItemId)).toBeUndefined();
        });

        it('should preserve other items when updating one item', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 15 })
                .expect(200);

            expect(res.body.data.items).toHaveLength(2);
            expect(res.body.data.items.find(item => item.variantId === variantId2).quantity).toBe(3);
        });

        it('should update to maximum quantity (999)', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 999 })
                .expect(200);

            expect(res.body.data.items[0].quantity).toBe(999);
        });

        it('should update updatedAt timestamp', async () => {
            const cart1 = await Cart.findOne({ userId });
            const firstUpdate = cart1.updatedAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 7 })
                .expect(200);

            const cart2 = await Cart.findOne({ userId });
            expect(cart2.updatedAt.getTime()).toBeGreaterThan(firstUpdate.getTime());
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('should reject request without quantity', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({})
                .expect(400);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: expect.any(String),
                    details: expect.arrayContaining([
                        expect.objectContaining({
                            field: 'quantity',
                            message: expect.any(String)
                        })
                    ])
                }
            });
        });

        it('should reject negative quantity', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: -1 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject quantity greater than 999', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 1000 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject non-integer quantity', async () => {
            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 5.5 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject invalid itemId format', async () => {
            const res = await request(app)
                .patch('/api/cart/items/invalid-id')
                .send({ quantity: 5 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== ERROR HANDLING =====
    describe('error handling', () => {
        it('should return 401 when user is not authenticated', async () => {
            global.setTestAuthFailure(true);

            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 10 })
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
                .patch(`/api/cart/items/${nonExistentItemId}`)
                .send({ quantity: 10 })
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
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 10 })
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
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 10 })
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
        it('should not allow updating items in other users\' carts', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            global.setTestAuthUserId(otherUserId);

            const res = await request(app)
                .patch(`/api/cart/items/${cartItemId}`)
                .send({ quantity: 10 })
                .expect(404);

            expect(res.body.success).toBe(false);

            // Verify original cart unchanged
            global.setTestAuthUserId(userId);
            const originalCart = await Cart.findOne({ userId });
            expect(originalCart.items[0].quantity).toBe(5);
        });
    });
});

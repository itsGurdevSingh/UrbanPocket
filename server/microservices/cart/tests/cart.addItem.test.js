// tests/cart.addItem.test.js
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { Cart } from '../src/models/cart.model.js';

describe('POST /api/cart/items', () => {
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
        it('should add new item to cart', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 2 })
                .expect(200);

            expect(res.body).toMatchObject({
                success: true,
                message: 'Item added to cart successfully',
                data: expect.objectContaining({
                    userId: userId,
                    items: [
                        expect.objectContaining({
                            variantId: variantId1,
                            quantity: 2
                        })
                    ]
                })
            });
        });

        it('should create cart if it does not exist', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 1 })
                .expect(200);

            const cart = await Cart.findOne({ userId });
            expect(cart).toBeDefined();
            expect(cart.items).toHaveLength(1);
        });

        it('should default quantity to 1 when not specified', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1 })
                .expect(200);

            expect(res.body.data.items[0].quantity).toBe(1);
        });

        it('should add multiple different items to cart', async () => {
            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 2 })
                .expect(200);

            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId2, quantity: 3 })
                .expect(200);

            expect(res.body.data.items).toHaveLength(2);
            expect(res.body.data.items.find(item => item.variantId === variantId1).quantity).toBe(2);
            expect(res.body.data.items.find(item => item.variantId === variantId2).quantity).toBe(3);
        });

        it('should update quantity if variant already exists (replace behavior)', async () => {
            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 2 })
                .expect(200);

            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 5 })
                .expect(200);

            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items[0].quantity).toBe(5);
        });

        it('should update updatedAt timestamp when adding item', async () => {
            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 1 })
                .expect(200);

            const cart1 = await Cart.findOne({ userId });
            const firstUpdate = cart1.updatedAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId2, quantity: 1 })
                .expect(200);

            const cart2 = await Cart.findOne({ userId });
            expect(cart2.updatedAt.getTime()).toBeGreaterThan(firstUpdate.getTime());
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('should reject request without variantId', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ quantity: 2 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'variantId',
                        message: 'Variant ID is required'
                    })
                ])
            );
        });

        it('should reject empty variantId', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: '', quantity: 2 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject invalid variantId format', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: 'invalid-id', quantity: 2 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'variantId',
                        message: 'Variant ID must be a valid MongoDB ObjectId'
                    })
                ])
            );
        });

        it('should reject quantity less than 1', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 0 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject negative quantity', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: -5 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject quantity greater than 999', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 1000 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'quantity',
                        message: 'Quantity must be an integer between 1 and 999'
                    })
                ])
            );
        });

        it('should reject non-integer quantity', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 2.5 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject multiple validation errors simultaneously', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: 'invalid', quantity: -1 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ===== USER ISOLATION =====
    describe('user isolation', () => {
        it('should not add items to other users\' carts', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();

            // Create cart for different user
            await Cart.create({
                userId: otherUserId,
                items: [{ variantId: variantId1, quantity: 2 }]
            });

            // Add item for authenticated user
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId2, quantity: 1 })
                .expect(200);

            expect(res.body.data.userId).toBe(userId);
            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items[0].variantId).toBe(variantId2);

            // Verify other user's cart unchanged
            const otherCart = await Cart.findOne({ userId: otherUserId });
            expect(otherCart.items).toHaveLength(1);
            expect(otherCart.items[0].variantId.toString()).toBe(variantId1);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('should handle maximum valid quantity (999)', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 999 })
                .expect(200);

            expect(res.body.data.items[0].quantity).toBe(999);
        });

        it('should trim whitespace from variantId', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: `  ${variantId1}  `, quantity: 1 })
                .expect(200);

            expect(res.body.data.items[0].variantId).toBe(variantId1);
        });

        it('should handle concurrent additions correctly', async () => {
            const promises = [
                request(app).post('/api/cart/items').send({ variantId: variantId1, quantity: 1 }),
                request(app).post('/api/cart/items').send({ variantId: variantId2, quantity: 2 })
            ];

            await Promise.all(promises);

            const cart = await Cart.findOne({ userId });
            expect(cart.items.length).toBeGreaterThanOrEqual(1);
        });

        it('should preserve other items when updating existing variant', async () => {
            await Cart.create({
                userId,
                items: [
                    { variantId: variantId1, quantity: 2 },
                    { variantId: variantId2, quantity: 3 }
                ]
            });

            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 10 })
                .expect(200);

            const cart = await Cart.findOne({ userId });
            expect(cart.items).toHaveLength(2);
            expect(cart.items.find(item => item.variantId.toString() === variantId2).quantity).toBe(3);
        });

        it('should maintain variant uniqueness in cart', async () => {
            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 2 })
                .expect(200);

            await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 5 })
                .expect(200);

            const cart = await Cart.findOne({ userId });
            const variantItems = cart.items.filter(
                item => item.variantId.toString() === variantId1
            );
            expect(variantItems).toHaveLength(1);
            expect(variantItems[0].quantity).toBe(5);
        });
    });

    // ===== ERROR HANDLING =====
    describe('error handling', () => {
        it('should return 401 when user is not authenticated', async () => {
            global.setTestAuthFailure(true);

            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 1 })
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

        it('should return 400 with validation error for missing required fields', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .send({})
                .expect(400);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: expect.any(String),
                    details: expect.arrayContaining([
                        expect.objectContaining({
                            field: 'variantId',
                            message: expect.any(String)
                        })
                    ]),
                    errorId: expect.any(String)
                }
            });
        });

        it('should return 400 with proper error structure for malformed JSON', async () => {
            const res = await request(app)
                .post('/api/cart/items')
                .set('Content-Type', 'application/json')
                .send('{"variantId": invalid}')
                .expect(400);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: expect.any(String),
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
        });

        it('should return 500 with proper error structure for server errors', async () => {
            global.setTestAuthUserId('invalid-user-id');

            const res = await request(app)
                .post('/api/cart/items')
                .send({ variantId: variantId1, quantity: 1 })
                .expect(500);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: expect.any(String),
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
            expect(res.body.error.code).toBe('ADD_ITEM_FAILED');
        });
    });
});

// tests/cart.getCart.test.js
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { Cart } from '../src/models/cart.model.js';

describe('GET /api/cart', () => {
    const userId = new mongoose.Types.ObjectId().toString();

    beforeEach(async () => {
        await Cart.deleteMany({});
        global.setTestAuthUserId(userId);
    });

    afterEach(async () => {
        await Cart.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('should return existing cart with items for authenticated user', async () => {
            const variantId1 = new mongoose.Types.ObjectId();
            const variantId2 = new mongoose.Types.ObjectId();

            await Cart.create({
                userId,
                items: [
                    { variantId: variantId1, quantity: 2 },
                    { variantId: variantId2, quantity: 1 }
                ]
            });

            const res = await request(app)
                .get('/api/cart')
                .expect(200);

            expect(res.body).toMatchObject({
                success: true,
                message: 'Cart retrieved successfully',
                data: expect.objectContaining({
                    _id: expect.any(String),
                    userId: userId,
                    items: expect.arrayContaining([
                        expect.objectContaining({
                            _id: expect.any(String),
                            variantId: variantId1.toString(),
                            quantity: 2
                        }),
                        expect.objectContaining({
                            _id: expect.any(String),
                            variantId: variantId2.toString(),
                            quantity: 1
                        })
                    ]),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String)
                })
            });
        });

        it('should create new empty cart if none exists for user', async () => {
            const res = await request(app)
                .get('/api/cart')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.userId).toBe(userId);
            expect(res.body.data.items).toEqual([]);

            // Verify cart persisted in database
            const cartInDb = await Cart.findOne({ userId });
            expect(cartInDb).toBeDefined();
            expect(cartInDb.items).toHaveLength(0);
        });

        it('should return cart with multiple items in correct order', async () => {
            const items = [
                { variantId: new mongoose.Types.ObjectId(), quantity: 1 },
                { variantId: new mongoose.Types.ObjectId(), quantity: 3 },
                { variantId: new mongoose.Types.ObjectId(), quantity: 5 }
            ];

            await Cart.create({ userId, items });

            const res = await request(app)
                .get('/api/cart')
                .expect(200);

            expect(res.body.data.items).toHaveLength(3);
            expect(res.body.data.items[0].quantity).toBe(1);
            expect(res.body.data.items[1].quantity).toBe(3);
            expect(res.body.data.items[2].quantity).toBe(5);
        });
    });

    // ===== USER ISOLATION =====
    describe('user isolation', () => {
        it('should only return cart for authenticated user', async () => {
            const user1Id = new mongoose.Types.ObjectId().toString();
            const user2Id = new mongoose.Types.ObjectId().toString();

            // Create carts for two different users
            await Cart.create({
                userId: user1Id,
                items: [{ variantId: new mongoose.Types.ObjectId(), quantity: 5 }]
            });

            await Cart.create({
                userId: user2Id,
                items: [{ variantId: new mongoose.Types.ObjectId(), quantity: 3 }]
            });

            // Request cart for user1
            global.setTestAuthUserId(user1Id);
            const res = await request(app)
                .get('/api/cart')
                .expect(200);

            expect(res.body.data.userId).toBe(user1Id);
            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items[0].quantity).toBe(5);
        });

        it('should create new cart for user even when other users have carts', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();

            await Cart.create({
                userId: otherUserId,
                items: [{ variantId: new mongoose.Types.ObjectId(), quantity: 3 }]
            });

            const res = await request(app)
                .get('/api/cart')
                .expect(200);

            expect(res.body.data.userId).toBe(userId);
            expect(res.body.data.items).toEqual([]);

            // Verify both carts exist
            expect(await Cart.countDocuments()).toBe(2);
        });
    });

    // ===== IDEMPOTENCY =====
    describe('idempotency', () => {
        it('should return same cart on repeated GET requests without modification', async () => {
            const res1 = await request(app).get('/api/cart').expect(200);
            const cartId1 = res1.body.data._id;
            const createdAt1 = res1.body.data.createdAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            const res2 = await request(app).get('/api/cart').expect(200);
            const res3 = await request(app).get('/api/cart').expect(200);

            expect(res2.body.data._id).toBe(cartId1);
            expect(res3.body.data._id).toBe(cartId1);
            expect(res2.body.data.createdAt).toBe(createdAt1);

            // Verify only one cart exists
            expect(await Cart.countDocuments({ userId })).toBe(1);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('should handle cart with maximum quantity items', async () => {
            await Cart.create({
                userId,
                items: [{ variantId: new mongoose.Types.ObjectId(), quantity: 999 }]
            });

            const res = await request(app).get('/api/cart').expect(200);
            expect(res.body.data.items[0].quantity).toBe(999);
        });

        it('should handle empty cart (zero items)', async () => {
            await Cart.create({ userId, items: [] });

            const res = await request(app).get('/api/cart').expect(200);
            expect(res.body.data.items).toEqual([]);
        });

        it('should include valid timestamps', async () => {
            const res = await request(app).get('/api/cart').expect(200);

            const createdAt = new Date(res.body.data.createdAt);
            const updatedAt = new Date(res.body.data.updatedAt);

            expect(createdAt.getTime()).not.toBeNaN();
            expect(updatedAt.getTime()).not.toBeNaN();
            expect(createdAt.getTime()).toBeLessThanOrEqual(updatedAt.getTime());
        });
    });

    // ===== ERROR HANDLING =====
    describe('error handling', () => {
        it('should return 401 when user is not authenticated', async () => {
            global.setTestAuthFailure(true);

            const res = await request(app)
                .get('/api/cart')
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

        it('should return 500 with proper error structure for invalid userId', async () => {
            global.setTestAuthUserId('invalid-user-id');

            const res = await request(app)
                .get('/api/cart')
                .expect(500);

            expect(res.body).toMatchObject({
                success: false,
                error: {
                    code: expect.any(String),
                    message: expect.any(String),
                    errorId: expect.any(String)
                }
            });
            expect(res.body.error.code).toBe('GET_CART_FAILED');
        });

        it('should return proper error structure on server errors', async () => {
            // Force a server error by using null userId
            global.setTestAuthUserId(null);

            const res = await request(app)
                .get('/api/cart')
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
});

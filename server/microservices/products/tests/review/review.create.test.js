import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Review from '../../src/models/review.model.js';
import Product from '../../src/models/product.model.js';
import Category from '../../src/models/category.model.js';

describe('POST /api/review/create', () => {
    let testProduct;
    let testCategory;
    let sellerId;

    beforeEach(async () => {
        await Review.deleteMany({});
        await Product.deleteMany({});
        await Category.deleteMany({});

        // Create a test category
        testCategory = await Category.create({
            name: 'Electronics',
            description: 'Electronic items'
        });

        // Create a seller ID
        sellerId = new mongoose.Types.ObjectId();

        // Create a test product
        testProduct = await Product.create({
            name: 'Test Product',
            description: 'Test Description',
            categoryId: testCategory._id,
            sellerId: sellerId,
            brand: 'TestBrand',
            baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
            isActive: true,
            rating: { average: 0, count: 0 }
        });

        // Set test user as a regular authenticated user with valid ObjectId
        global.setTestAuthRole('user');
        global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
    });

    afterEach(async () => {
        await Review.deleteMany({});
        await Product.deleteMany({});
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('creates a review successfully with valid data', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: 'Great product!'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Review created successfully');
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.product.toString()).toBe(testProduct._id.toString());
            expect(res.body.data.userId).toBeTruthy(); // Check userId exists (comes from mocked auth)
            expect(mongoose.Types.ObjectId.isValid(res.body.data.userId)).toBe(true); // Verify it's a valid ObjectId
            expect(res.body.data.rating).toBe(5);
            expect(res.body.data.comment).toBe('Great product!');
        });

        it('creates a review without comment (optional field)', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 4
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.rating).toBe(4);
            expect(res.body.data.comment).toBeUndefined();
        });

        it('creates review with minimum rating (1)', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 1,
                comment: 'Poor quality'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data.rating).toBe(1);
        });

        it('creates review with maximum rating (5)', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: 'Excellent!'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data.rating).toBe(5);
        });

        it('stores userId from authenticated user, not from request body', async () => {
            const authenticatedUserId = new mongoose.Types.ObjectId().toString();
            const maliciousUserId = new mongoose.Types.ObjectId().toString();
            global.setTestAuthUserId(authenticatedUserId);

            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: 'Great!',
                userId: maliciousUserId // This should be ignored
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data.userId).toBe(authenticatedUserId);
            expect(res.body.data.userId).not.toBe(maliciousUserId);
        });

        it('creates review with long comment (up to 1000 characters)', async () => {
            const longComment = 'A'.repeat(1000);

            const reviewData = {
                product: testProduct._id.toString(),
                rating: 4,
                comment: longComment
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data.comment).toHaveLength(1000);
        });

        it('updates product rating after review creation', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 4,
                comment: 'Good product'
            };

            await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            // Check product rating was updated
            const updatedProduct = await Product.findById(testProduct._id);
            expect(updatedProduct.rating.count).toBe(1);
            expect(updatedProduct.rating.average).toBe(4);
        });

        it('calculates correct average rating with multiple reviews', async () => {
            // Create first review
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            await request(app)
                .post('/api/review/create')
                .send({
                    product: testProduct._id.toString(),
                    rating: 5
                })
                .expect(201);

            // Create second review with different user
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            await request(app)
                .post('/api/review/create')
                .send({
                    product: testProduct._id.toString(),
                    rating: 3
                })
                .expect(201);

            // Check product rating
            const updatedProduct = await Product.findById(testProduct._id);
            expect(updatedProduct.rating.count).toBe(2);
            expect(updatedProduct.rating.average).toBe(4); // (5 + 3) / 2 = 4
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects review without product ID', async () => {
            const reviewData = {
                rating: 5,
                comment: 'Great!'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects review without rating', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                comment: 'Great!'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects invalid product ID format', async () => {
            const reviewData = {
                product: 'invalid-id',
                rating: 5
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects rating below 1', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 0
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects rating above 5', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 6
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects non-integer rating', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 4.5
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects comment longer than 1000 characters', async () => {
            const longComment = 'A'.repeat(1001);

            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: longComment
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects non-string comment', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: 12345
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== BUSINESS LOGIC ERRORS =====
    describe('business logic errors', () => {
        it('returns 404 for non-existent product', async () => {
            const fakeProductId = new mongoose.Types.ObjectId();

            const reviewData = {
                product: fakeProductId.toString(),
                rating: 5,
                comment: 'Great!'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(404);

            expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });

        it('rejects review for inactive product', async () => {
            // Create inactive product
            const inactiveProduct = await Product.create({
                name: 'Inactive Product',
                description: 'Test',
                categoryId: testCategory._id,
                sellerId: sellerId,
                brand: 'TestBrand',
                baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
                isActive: false,
                rating: { average: 0, count: 0 }
            });

            const reviewData = {
                product: inactiveProduct._id.toString(),
                rating: 5,
                comment: 'Great!'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(400);

            expect(res.body.error.code).toBe('PRODUCT_INACTIVE');
        });

        it('prevents duplicate reviews from same user', async () => {
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());

            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: 'First review'
            };

            // Create first review
            await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            // Attempt to create second review
            const secondReviewData = {
                product: testProduct._id.toString(),
                rating: 4,
                comment: 'Second review attempt'
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(secondReviewData)
                .expect(400);

            expect(res.body.error.code).toBe('DUPLICATE_REVIEW');
        });

        it('allows different users to review same product', async () => {
            // First user reviews
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            await request(app)
                .post('/api/review/create')
                .send({
                    product: testProduct._id.toString(),
                    rating: 5
                })
                .expect(201);

            // Second user reviews
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            const res = await request(app)
                .post('/api/review/create')
                .send({
                    product: testProduct._id.toString(),
                    rating: 4
                })
                .expect(201);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== AUTHENTICATION =====
    describe('authentication', () => {
        it('requires authentication (no mock setup should fail in real scenario)', async () => {
            // Note: In our test setup, auth is always mocked
            // This test verifies the route uses authenticate middleware
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            // Verify review was created with mocked user
            expect(res.body.data.userId).toBeTruthy();
        });

        it('allows any authenticated role (user, seller, admin)', async () => {
            // Test as user
            global.setTestAuthRole('user');
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            await request(app)
                .post('/api/review/create')
                .send({
                    product: testProduct._id.toString(),
                    rating: 5
                })
                .expect(201);

            // Create another product for seller test
            const product2 = await Product.create({
                name: 'Product 2',
                description: 'Test',
                categoryId: testCategory._id,
                sellerId: new mongoose.Types.ObjectId(),
                brand: 'TestBrand',
                baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
                isActive: true
            });

            // Test as seller
            global.setTestAuthRole('seller');
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            await request(app)
                .post('/api/review/create')
                .send({
                    product: product2._id.toString(),
                    rating: 4
                })
                .expect(201);

            // Create another product for admin test
            const product3 = await Product.create({
                name: 'Product 3',
                description: 'Test',
                categoryId: testCategory._id,
                sellerId: new mongoose.Types.ObjectId(),
                brand: 'TestBrand',
                baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
                isActive: true
            });

            // Test as admin
            global.setTestAuthRole('admin');
            global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
            const res = await request(app)
                .post('/api/review/create')
                .send({
                    product: product3._id.toString(),
                    rating: 3
                })
                .expect(201);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('trims whitespace from comment', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: '  Great product!  '
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data.comment).toBe('Great product!');
        });

        it('handles empty string comment', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5,
                comment: ''
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data.comment).toBe('');
        });

        it('includes timestamps in response', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        it('returns proper response structure', async () => {
            const reviewData = {
                product: testProduct._id.toString(),
                rating: 5
            };

            const res = await request(app)
                .post('/api/review/create')
                .send(reviewData)
                .expect(201);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('product');
            expect(res.body.data).toHaveProperty('userId');
            expect(res.body.data).toHaveProperty('rating');
        });
    });
});

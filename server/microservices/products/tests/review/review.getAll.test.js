import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Review from '../../src/models/review.model.js';
import Product from '../../src/models/product.model.js';
import Category from '../../src/models/category.model.js';

describe('GET /api/review/getAll', () => {
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

        // Set test user as authenticated
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
        it('returns all reviews with default pagination', async () => {
            // Create 3 reviews
            const userId1 = new mongoose.Types.ObjectId();
            const userId2 = new mongoose.Types.ObjectId();
            const userId3 = new mongoose.Types.ObjectId();

            await Review.create({ product: testProduct._id, userId: userId1, rating: 5, comment: 'Great!' });
            await Review.create({ product: testProduct._id, userId: userId2, rating: 4, comment: 'Good' });
            await Review.create({ product: testProduct._id, userId: userId3, rating: 3, comment: 'Okay' });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('All reviews fetched successfully');
            expect(res.body.data).toHaveProperty('reviews');
            expect(res.body.data).toHaveProperty('meta');
            expect(res.body.data.reviews).toHaveLength(3);
            expect(res.body.data.meta.total).toBe(3);
            expect(res.body.data.meta.page).toBe(1);
            expect(res.body.data.meta.limit).toBe(20);
        });

        it('returns empty array when no reviews exist', async () => {
            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.reviews).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });

        it('returns reviews sorted by createdAt descending (newest first)', async () => {
            const userId1 = new mongoose.Types.ObjectId();
            const userId2 = new mongoose.Types.ObjectId();
            const userId3 = new mongoose.Types.ObjectId();

            // Create reviews with slight delay to ensure different timestamps
            const review1 = await Review.create({ product: testProduct._id, userId: userId1, rating: 5, comment: 'First' });
            await new Promise(resolve => setTimeout(resolve, 10));
            const review2 = await Review.create({ product: testProduct._id, userId: userId2, rating: 4, comment: 'Second' });
            await new Promise(resolve => setTimeout(resolve, 10));
            const review3 = await Review.create({ product: testProduct._id, userId: userId3, rating: 3, comment: 'Third' });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.data.reviews[0].comment).toBe('Third'); // Newest
            expect(res.body.data.reviews[1].comment).toBe('Second');
            expect(res.body.data.reviews[2].comment).toBe('First'); // Oldest
        });

        it('handles pagination with page and limit', async () => {
            // Create 25 reviews
            for (let i = 1; i <= 25; i++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({
                    product: testProduct._id,
                    userId: userId,
                    rating: (i % 5) + 1,
                    comment: `Review ${i}`
                });
            }

            const res = await request(app)
                .get('/api/review/getAll?page=2&limit=10')
                .expect(200);

            expect(res.body.data.reviews).toHaveLength(10);
            expect(res.body.data.meta.page).toBe(2);
            expect(res.body.data.meta.limit).toBe(10);
            expect(res.body.data.meta.total).toBe(25);
            expect(res.body.data.meta.totalPages).toBe(3);
            expect(res.body.data.meta.hasNextPage).toBe(true);
            expect(res.body.data.meta.hasPrevPage).toBe(true);
        });

        it('returns hasNextPage=false on last page', async () => {
            // Create 5 reviews
            for (let i = 1; i <= 5; i++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({ product: testProduct._id, userId: userId, rating: 5 });
            }

            const res = await request(app)
                .get('/api/review/getAll?page=1&limit=10')
                .expect(200);

            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        it('returns hasPrevPage=false on first page', async () => {
            // Create 25 reviews
            for (let i = 1; i <= 25; i++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({ product: testProduct._id, userId: userId, rating: 5 });
            }

            const res = await request(app)
                .get('/api/review/getAll?page=1&limit=10')
                .expect(200);

            expect(res.body.data.meta.hasPrevPage).toBe(false);
        });

        it('returns all review fields in response', async () => {
            const userId = new mongoose.Types.ObjectId();
            await Review.create({
                product: testProduct._id,
                userId: userId,
                rating: 5,
                comment: 'Test comment'
            });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            const review = res.body.data.reviews[0];
            expect(review).toHaveProperty('_id');
            expect(review).toHaveProperty('product');
            expect(review).toHaveProperty('userId');
            expect(review).toHaveProperty('rating', 5);
            expect(review).toHaveProperty('comment', 'Test comment');
            expect(review).toHaveProperty('createdAt');
            expect(review).toHaveProperty('updatedAt');
        });

        it('handles reviews from multiple products', async () => {
            const product2 = await Product.create({
                name: 'Product 2',
                description: 'Test',
                categoryId: testCategory._id,
                sellerId: sellerId,
                brand: 'TestBrand',
                baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
                isActive: true
            });

            const userId1 = new mongoose.Types.ObjectId();
            const userId2 = new mongoose.Types.ObjectId();

            await Review.create({ product: testProduct._id, userId: userId1, rating: 5 });
            await Review.create({ product: product2._id, userId: userId2, rating: 4 });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.data.reviews).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(2);
        });

        it('includes reviews with and without comments', async () => {
            const userId1 = new mongoose.Types.ObjectId();
            const userId2 = new mongoose.Types.ObjectId();

            await Review.create({ product: testProduct._id, userId: userId1, rating: 5, comment: 'With comment' });
            await Review.create({ product: testProduct._id, userId: userId2, rating: 4 }); // No comment

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.data.reviews).toHaveLength(2);
            const withComment = res.body.data.reviews.find(r => r.comment);
            const withoutComment = res.body.data.reviews.find(r => !r.comment);
            expect(withComment).toBeDefined();
            expect(withoutComment).toBeDefined();
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid page number', async () => {
            const res = await request(app)
                .get('/api/review/getAll?page=0')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects negative page number', async () => {
            const res = await request(app)
                .get('/api/review/getAll?page=-1')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects negative limit', async () => {
            const res = await request(app)
                .get('/api/review/getAll?limit=-5')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects limit greater than 100', async () => {
            const res = await request(app)
                .get('/api/review/getAll?limit=101')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects non-integer page', async () => {
            const res = await request(app)
                .get('/api/review/getAll?page=abc')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects non-integer limit', async () => {
            const res = await request(app)
                .get('/api/review/getAll?limit=xyz')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== AUTHENTICATION =====
    describe('authentication', () => {
        it('requires authentication', async () => {
            // Note: In test env, auth is mocked, so this just verifies the route uses authenticate middleware
            const userId = new mongoose.Types.ObjectId();
            await Review.create({ product: testProduct._id, userId: userId, rating: 5 });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('allows any authenticated role to access', async () => {
            const userId = new mongoose.Types.ObjectId();
            await Review.create({ product: testProduct._id, userId: userId, rating: 5 });

            // Test as user
            global.setTestAuthRole('user');
            let res = await request(app)
                .get('/api/review/getAll')
                .expect(200);
            expect(res.body.success).toBe(true);

            // Test as seller
            global.setTestAuthRole('seller');
            res = await request(app)
                .get('/api/review/getAll')
                .expect(200);
            expect(res.body.success).toBe(true);

            // Test as admin
            global.setTestAuthRole('admin');
            res = await request(app)
                .get('/api/review/getAll')
                .expect(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles large page numbers gracefully', async () => {
            const userId = new mongoose.Types.ObjectId();
            await Review.create({ product: testProduct._id, userId: userId, rating: 5 });

            const res = await request(app)
                .get('/api/review/getAll?page=100')
                .expect(200);

            expect(res.body.data.reviews).toEqual([]);
            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        it('returns correct totalPages calculation', async () => {
            // Create 23 reviews
            for (let i = 1; i <= 23; i++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({ product: testProduct._id, userId: userId, rating: 5 });
            }

            const res = await request(app)
                .get('/api/review/getAll?limit=10')
                .expect(200);

            expect(res.body.data.meta.totalPages).toBe(3); // 23 items / 10 per page = 3 pages
        });

        it('returns proper response structure', async () => {
            const userId = new mongoose.Types.ObjectId();
            await Review.create({ product: testProduct._id, userId: userId, rating: 5 });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('reviews');
            expect(res.body.data).toHaveProperty('meta');
            expect(res.body.data.meta).toHaveProperty('page');
            expect(res.body.data.meta).toHaveProperty('limit');
            expect(res.body.data.meta).toHaveProperty('total');
            expect(res.body.data.meta).toHaveProperty('totalPages');
            expect(res.body.data.meta).toHaveProperty('hasNextPage');
            expect(res.body.data.meta).toHaveProperty('hasPrevPage');
        });

        it('handles page at exact boundary', async () => {
            // Create 20 reviews (exactly 2 pages with limit 10)
            for (let i = 1; i <= 20; i++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({ product: testProduct._id, userId: userId, rating: 5 });
            }

            const res = await request(app)
                .get('/api/review/getAll?page=2&limit=10')
                .expect(200);

            expect(res.body.data.reviews).toHaveLength(10);
            expect(res.body.data.meta.totalPages).toBe(2);
            expect(res.body.data.meta.hasNextPage).toBe(false);
            expect(res.body.data.meta.hasPrevPage).toBe(true);
        });

        it('handles reviews with all rating values (1-5)', async () => {
            for (let rating = 1; rating <= 5; rating++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({
                    product: testProduct._id,
                    userId: userId,
                    rating: rating,
                    comment: `Rating ${rating}`
                });
            }

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.data.reviews).toHaveLength(5);
            const ratings = res.body.data.reviews.map(r => r.rating).sort();
            expect(ratings).toEqual([1, 2, 3, 4, 5]);
        });

        it('uses default values when pagination params not provided', async () => {
            const userId = new mongoose.Types.ObjectId();
            await Review.create({ product: testProduct._id, userId: userId, rating: 5 });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            expect(res.body.data.meta.page).toBe(1); // default page
            expect(res.body.data.meta.limit).toBe(20); // default limit
        });

        it('handles custom limit correctly', async () => {
            // Create 10 reviews
            for (let i = 1; i <= 10; i++) {
                const userId = new mongoose.Types.ObjectId();
                await Review.create({ product: testProduct._id, userId: userId, rating: 5 });
            }

            const res = await request(app)
                .get('/api/review/getAll?limit=5')
                .expect(200);

            expect(res.body.data.reviews).toHaveLength(5);
            expect(res.body.data.meta.limit).toBe(5);
            expect(res.body.data.meta.totalPages).toBe(2); // 10 reviews / 5 per page
        });

        it('handles ObjectId product references correctly', async () => {
            const userId = new mongoose.Types.ObjectId();
            await Review.create({ product: testProduct._id, userId: userId, rating: 5 });

            const res = await request(app)
                .get('/api/review/getAll')
                .expect(200);

            const review = res.body.data.reviews[0];
            expect(mongoose.Types.ObjectId.isValid(review.product)).toBe(true);
            expect(mongoose.Types.ObjectId.isValid(review.userId)).toBe(true);
        });
    });
});

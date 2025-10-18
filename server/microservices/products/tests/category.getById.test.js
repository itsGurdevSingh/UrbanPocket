import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';

describe('GET /api/category/:id', () => {
    let testCategory;

    beforeEach(async () => {
        // Create a test category
        testCategory = await Category.create({
            name: 'Electronics',
            description: 'Electronic devices and accessories',
            isActive: true
        });
    });

    afterEach(async () => {
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('fetches a category by valid ID', async () => {
            const res = await request(app)
                .get(`/api/category/${testCategory._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Category fetched successfully');
            expect(res.body.data).toHaveProperty('_id', testCategory._id.toString());
            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.description).toBe('Electronic devices and accessories');
            expect(res.body.data.isActive).toBe(true);
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        it('fetches category with parentCategory', async () => {
            const parent = await Category.create({ name: 'Parent Category' });
            const child = await Category.create({
                name: 'Child Category',
                parentCategory: parent._id
            });

            const res = await request(app)
                .get(`/api/category/${child._id}`)
                .expect(200);

            expect(res.body.data.parentCategory).toBe(parent._id.toString());
        });

        it('fetches category without description', async () => {
            const noDescription = await Category.create({ name: 'No Description Category' });

            const res = await request(app)
                .get(`/api/category/${noDescription._id}`)
                .expect(200);

            expect(res.body.data.description).toBeUndefined();
        });

        it('fetches inactive category', async () => {
            const inactive = await Category.create({
                name: 'Inactive Category',
                isActive: false
            });

            const res = await request(app)
                .get(`/api/category/${inactive._id}`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid ObjectId format', async () => {
            const res = await request(app)
                .get('/api/category/invalid-id')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'id' })
                ])
            );
        });

        it('rejects empty ID', async () => {
            const res = await request(app)
                .get('/api/category/')
                .expect(404); // Route not found

            expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
        });
    });

    // ===== NOT FOUND ERRORS =====
    describe('not found errors', () => {
        it('returns 404 for non-existent category', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/category/${nonExistentId}`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });

        it('returns 404 for deleted category', async () => {
            const categoryId = testCategory._id;
            await Category.findByIdAndDelete(categoryId);

            const res = await request(app)
                .get(`/api/category/${categoryId}`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });
    });

    // ===== NO AUTHENTICATION REQUIRED =====
    describe('no authentication required', () => {
        it('allows access without authentication (public endpoint)', async () => {
            // No auth token needed - endpoint is public per docs
            const res = await request(app)
                .get(`/api/category/${testCategory._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles category with special characters in name', async () => {
            const special = await Category.create({
                name: 'Electronics & Gadgets (2024)'
            });

            const res = await request(app)
                .get(`/api/category/${special._id}`)
                .expect(200);

            expect(res.body.data.name).toBe('Electronics & Gadgets (2024)');
        });

        it('handles category with max length description', async () => {
            const longDesc = 'a'.repeat(500);
            const cat = await Category.create({
                name: 'Long Description',
                description: longDesc
            });

            const res = await request(app)
                .get(`/api/category/${cat._id}`)
                .expect(200);

            expect(res.body.data.description).toBe(longDesc);
        });

        it('handles category with null parentCategory', async () => {
            const cat = await Category.create({
                name: 'Top Level',
                parentCategory: null
            });

            const res = await request(app)
                .get(`/api/category/${cat._id}`)
                .expect(200);

            expect(res.body.data.parentCategory).toBeNull();
        });
    });
});

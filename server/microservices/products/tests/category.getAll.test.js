import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';

describe('GET /api/category/getAll', () => {
    beforeEach(async () => {
        await Category.deleteMany({});
    });

    afterEach(async () => {
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('returns all categories with default pagination', async () => {
            // Create 3 test categories
            await Category.create({ name: 'Electronics' });
            await Category.create({ name: 'Clothing' });
            await Category.create({ name: 'Home & Garden' });

            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Categories fetched successfully');
            expect(res.body.data).toHaveProperty('categories');
            expect(res.body.data).toHaveProperty('meta');
            expect(res.body.data.categories).toHaveLength(3);
            expect(res.body.data.meta.total).toBe(3);
            expect(res.body.data.meta.page).toBe(1);
            expect(res.body.data.meta.limit).toBe(20);
        });

        it('returns empty array when no categories exist', async () => {
            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.categories).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });

        it('filters by isActive=true', async () => {
            await Category.create({ name: 'Active 1', isActive: true });
            await Category.create({ name: 'Active 2', isActive: true });
            await Category.create({ name: 'Inactive', isActive: false });

            const res = await request(app)
                .get('/api/category/getAll?isActive=true')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(2);
        });

        it('filters by isActive=false', async () => {
            await Category.create({ name: 'Active', isActive: true });
            await Category.create({ name: 'Inactive 1', isActive: false });
            await Category.create({ name: 'Inactive 2', isActive: false });

            const res = await request(app)
                .get('/api/category/getAll?isActive=false')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(2);
        });

        it('filters by parentCategory (top-level only)', async () => {
            const parent = await Category.create({ name: 'Parent' });
            await Category.create({ name: 'Child 1', parentCategory: parent._id });
            await Category.create({ name: 'Top Level 1', parentCategory: null });
            await Category.create({ name: 'Top Level 2', parentCategory: null });

            const res = await request(app)
                .get('/api/category/getAll?parentCategory=null')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(3); // Parent + 2 top levels
            expect(res.body.data.meta.total).toBe(3);
        });

        it('filters by specific parentCategory', async () => {
            const parent = await Category.create({ name: 'Parent' });
            await Category.create({ name: 'Child 1', parentCategory: parent._id });
            await Category.create({ name: 'Child 2', parentCategory: parent._id });
            await Category.create({ name: 'Other', parentCategory: null });

            const res = await request(app)
                .get(`/api/category/getAll?parentCategory=${parent._id}`)
                .expect(200);

            expect(res.body.data.categories).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(2);
        });

        it('searches by name using q parameter', async () => {
            await Category.create({ name: 'Electronics' });
            await Category.create({ name: 'Electronic Components' });
            await Category.create({ name: 'Clothing' });

            const res = await request(app)
                .get('/api/category/getAll?q=electr')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(2);
        });

        it('searches by description using q parameter', async () => {
            await Category.create({ name: 'Cat1', description: 'Electronic devices' });
            await Category.create({ name: 'Cat2', description: 'Electronic components' });
            await Category.create({ name: 'Cat3', description: 'Clothing items' });

            const res = await request(app)
                .get('/api/category/getAll?q=electronic')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(2);
            expect(res.body.data.meta.total).toBe(2);
        });

        it('returns sorted by name ascending', async () => {
            await Category.create({ name: 'Zebra' });
            await Category.create({ name: 'Apple' });
            await Category.create({ name: 'Mango' });

            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            expect(res.body.data.categories[0].name).toBe('Apple');
            expect(res.body.data.categories[1].name).toBe('Mango');
            expect(res.body.data.categories[2].name).toBe('Zebra');
        });

        it('handles pagination with page and limit', async () => {
            for (let i = 1; i <= 25; i++) {
                await Category.create({ name: `Category ${i}` });
            }

            const res = await request(app)
                .get('/api/category/getAll?page=2&limit=10')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(10);
            expect(res.body.data.meta.page).toBe(2);
            expect(res.body.data.meta.limit).toBe(10);
            expect(res.body.data.meta.total).toBe(25);
            expect(res.body.data.meta.totalPages).toBe(3);
            expect(res.body.data.meta.hasNextPage).toBe(true);
            expect(res.body.data.meta.hasPrevPage).toBe(true);
        });

        it('returns hasNextPage=false on last page', async () => {
            for (let i = 1; i <= 5; i++) {
                await Category.create({ name: `Category ${i}` });
            }

            const res = await request(app)
                .get('/api/category/getAll?page=1&limit=10')
                .expect(200);

            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        it('returns hasPrevPage=false on first page', async () => {
            for (let i = 1; i <= 25; i++) {
                await Category.create({ name: `Category ${i}` });
            }

            const res = await request(app)
                .get('/api/category/getAll?page=1&limit=10')
                .expect(200);

            expect(res.body.data.meta.hasPrevPage).toBe(false);
        });

        it('combines multiple filters', async () => {
            const parent = await Category.create({ name: 'Parent', isActive: true });
            await Category.create({ name: 'Electronics Active', parentCategory: parent._id, isActive: true });
            await Category.create({ name: 'Electronics Inactive', parentCategory: parent._id, isActive: false });
            await Category.create({ name: 'Other Active', parentCategory: parent._id, isActive: true });

            const res = await request(app)
                .get(`/api/category/getAll?parentCategory=${parent._id}&isActive=true&q=electronic`)
                .expect(200);

            expect(res.body.data.categories).toHaveLength(1);
            expect(res.body.data.categories[0].name).toBe('Electronics Active');
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid page number', async () => {
            const res = await request(app)
                .get('/api/category/getAll?page=0')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects negative limit', async () => {
            const res = await request(app)
                .get('/api/category/getAll?limit=-5')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects limit greater than 100', async () => {
            const res = await request(app)
                .get('/api/category/getAll?limit=101')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects invalid isActive value', async () => {
            const res = await request(app)
                .get('/api/category/getAll?isActive=maybe')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects invalid parentCategory ObjectId', async () => {
            const res = await request(app)
                .get('/api/category/getAll?parentCategory=invalid-id')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== NO AUTHENTICATION REQUIRED =====
    describe('no authentication required', () => {
        it('allows access without authentication (public endpoint)', async () => {
            await Category.create({ name: 'Public Category' });

            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles empty search query', async () => {
            await Category.create({ name: 'Category 1' });

            const res = await request(app)
                .get('/api/category/getAll?q=')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(1);
        });

        it('returns empty array for non-matching search', async () => {
            await Category.create({ name: 'Electronics' });
            await Category.create({ name: 'Clothing' });

            const res = await request(app)
                .get('/api/category/getAll?q=NonExistent')
                .expect(200);

            expect(res.body.data.categories).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });

        it('handles special characters in search', async () => {
            await Category.create({ name: 'Electronics & Gadgets' });
            await Category.create({ name: 'Clothing' });

            const res = await request(app)
                .get('/api/category/getAll?q=Electronics & Gadgets')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(1);
        });

        it('handles large page numbers gracefully', async () => {
            await Category.create({ name: 'Category 1' });

            const res = await request(app)
                .get('/api/category/getAll?page=100')
                .expect(200);

            expect(res.body.data.categories).toEqual([]);
            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        it('handles categories with null parentCategory explicitly', async () => {
            await Category.create({ name: 'Top Level', parentCategory: null });

            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(1);
        });

        it('returns correct totalPages calculation', async () => {
            for (let i = 1; i <= 23; i++) {
                await Category.create({ name: `Category ${i}` });
            }

            const res = await request(app)
                .get('/api/category/getAll?limit=10')
                .expect(200);

            expect(res.body.data.meta.totalPages).toBe(3); // 23 items / 10 per page = 3 pages
        });

        it('handles case-insensitive search', async () => {
            await Category.create({ name: 'Electronics' });
            await Category.create({ name: 'electronic' });
            await Category.create({ name: 'ELECTRONIC' });

            const res = await request(app)
                .get('/api/category/getAll?q=ELECTRONIC')
                .expect(200);

            expect(res.body.data.categories).toHaveLength(3);
        });

        it('returns all fields in category response', async () => {
            await Category.create({
                name: 'Test Category',
                description: 'Test Description',
                isActive: true
            });

            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            const category = res.body.data.categories[0];
            expect(category).toHaveProperty('_id');
            expect(category).toHaveProperty('name');
            expect(category).toHaveProperty('description');
            expect(category).toHaveProperty('isActive');
            expect(category).toHaveProperty('createdAt');
            expect(category).toHaveProperty('updatedAt');
        });

        it('handles filtering with no results', async () => {
            await Category.create({ name: 'Active', isActive: true });

            const res = await request(app)
                .get('/api/category/getAll?isActive=false')
                .expect(200);

            expect(res.body.data.categories).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
            expect(res.body.data.meta.totalPages).toBe(0);
        });

        it('returns proper response structure', async () => {
            await Category.create({ name: 'Test' });

            const res = await request(app)
                .get('/api/category/getAll')
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('categories');
            expect(res.body.data).toHaveProperty('meta');
            expect(res.body.data.meta).toHaveProperty('page');
            expect(res.body.data.meta).toHaveProperty('limit');
            expect(res.body.data.meta).toHaveProperty('total');
            expect(res.body.data.meta).toHaveProperty('totalPages');
            expect(res.body.data.meta).toHaveProperty('hasNextPage');
            expect(res.body.data.meta).toHaveProperty('hasPrevPage');
        });
    });
});

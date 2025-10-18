import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Category from '../../src/models/category.model.js';

const createPayload = (overrides = {}) => ({
    name: 'Test Category',
    description: 'A test category for products',
    ...overrides
});

describe('POST /api/category/create', () => {
    beforeEach(() => {
        // Default to admin role for create tests (only admins can create categories)
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
    });

    afterEach(async () => {
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('creates a category with name only (minimal payload)', async () => {
            const payload = { name: 'Electronics' };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Category created successfully');
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.description).toBe('');
            expect(res.body.data.parentCategory).toBeNull();
            expect(res.body.data.isActive).toBe(true);
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        it('creates a category with name and description', async () => {
            const payload = createPayload({
                name: 'Smartphones',
                description: 'Mobile devices and accessories'
            });
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Smartphones');
            expect(res.body.data.description).toBe('Mobile devices and accessories');
        });

        it('creates a subcategory with parentCategory', async () => {
            // First create parent
            const parent = await Category.create({ name: 'Electronics' });

            const payload = createPayload({
                name: 'Laptops',
                description: 'Portable computers',
                parentCategory: parent._id.toString()
            });
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Laptops');
            expect(res.body.data.parentCategory).toBe(parent._id.toString());
        });

        it('admin can create category', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');
            const payload = createPayload({ name: 'Admin Category' });
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Admin Category');
        });

        it('trims whitespace from name and description', async () => {
            const payload = {
                name: '  Fertilizers  ',
                description: '  Plant nutrients  '
            };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.name).toBe('Fertilizers');
            expect(res.body.data.description).toBe('Plant nutrients');
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects request without name', async () => {
            const payload = { description: 'No name provided' };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'name' })
                ])
            );
        });

        it('rejects empty name', async () => {
            const payload = { name: '' };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects name longer than 50 characters', async () => {
            const payload = { name: 'a'.repeat(51) };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'name' })
                ])
            );
        });

        it('rejects description longer than 500 characters', async () => {
            const payload = {
                name: 'Valid Category',
                description: 'a'.repeat(501)
            };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'description' })
                ])
            );
        });

        it('rejects invalid parentCategory ObjectId', async () => {
            const payload = {
                name: 'Valid Category',
                parentCategory: 'not-a-valid-id'
            };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'parentCategory' })
                ])
            );
        });

        it('accepts valid parentCategory ObjectId', async () => {
            const parentId = new mongoose.Types.ObjectId().toString();
            const payload = {
                name: 'Valid Category',
                parentCategory: parentId
            };
            // Will fail with 201 since parent doesn't exist in DB, but validation passes
            await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);
        });

        it('rejects non-string name', async () => {
            const payload = { name: 12345 };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== BUSINESS LOGIC ERRORS =====
    describe('business logic errors', () => {
        it('rejects duplicate category name (uniqueness check)', async () => {
            const payload = createPayload({ name: 'Electronics' });

            // Create first category
            await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            // Try to create duplicate
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('DUPLICATE_CATEGORY_NAME');
            expect(res.body.error.message).toContain('unique');
        });

        it('allows same name after deleting previous category', async () => {
            const payload = createPayload({ name: 'Reusable Name' });

            // Create and delete
            const first = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            await Category.findByIdAndDelete(first.body.data._id);

            // Should succeed
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
        });

        it('is case-sensitive for category names', async () => {
            await request(app)
                .post('/api/category/create')
                .send({ name: 'electronics' })
                .expect(201);

            const res = await request(app)
                .post('/api/category/create')
                .send({ name: 'Electronics' })
                .expect(201);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== AUTHORIZATION ERRORS =====
    describe('authorization errors', () => {
        it('rejects request from seller role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('seller');
            const payload = createPayload({ name: 'Seller Category' });
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request from user role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');
            const payload = createPayload({ name: 'User Category' });
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request from customer role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');
            const payload = createPayload({ name: 'Customer Category' });
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles name at max length (50 chars)', async () => {
            const payload = { name: 'a'.repeat(50) };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.name).toBe('a'.repeat(50));
        });

        it('handles description at max length (500 chars)', async () => {
            const longDesc = 'a'.repeat(500);
            const payload = {
                name: 'Long Description Category',
                description: longDesc
            };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.description).toBe(longDesc);
        });

        it('handles missing description (optional field)', async () => {
            const payload = { name: 'No Description' };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.description).toBe('');
        });

        it('handles null parentCategory explicitly', async () => {
            const payload = {
                name: 'Top Level',
                parentCategory: null
            };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.parentCategory).toBeNull();
        });

        it('sets isActive to true by default', async () => {
            const payload = { name: 'Active Category' };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.isActive).toBe(true);
        });

        it('creates category with special characters in name', async () => {
            const payload = { name: 'Electronics & Gadgets (2024)' };
            const res = await request(app)
                .post('/api/category/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.name).toBe('Electronics & Gadgets (2024)');
        });

        it('creates multiple categories successfully', async () => {
            const categories = ['Electronics', 'Clothing', 'Food', 'Books'];

            for (const name of categories) {
                const res = await request(app)
                    .post('/api/category/create')
                    .send({ name })
                    .expect(201);

                expect(res.body.data.name).toBe(name);
            }

            const count = await Category.countDocuments();
            expect(count).toBe(4);
        });
    });
});

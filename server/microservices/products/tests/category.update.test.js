import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';

describe('PUT /api/category/:id', () => {
    let testCategory;

    beforeEach(() => {
        // Default to admin role (only admins can update categories)
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
    });

    beforeEach(async () => {
        // Create a test category
        testCategory = await Category.create({
            name: 'Electronics',
            description: 'Electronic devices',
            isActive: true
        });
    });

    afterEach(async () => {
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('updates category name', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Updated Electronics' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Category updated successfully');
            expect(res.body.data.name).toBe('Updated Electronics');
            expect(res.body.data.description).toBe('Electronic devices');
        });

        it('updates category description', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ description: 'New description' })
                .expect(200);

            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.description).toBe('New description');
        });

        it('updates category isActive status', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ isActive: false })
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
        });

        it('updates parentCategory', async () => {
            const parent = await Category.create({ name: 'Parent Category' });

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ parentCategory: parent._id.toString() })
                .expect(200);

            expect(res.body.data.parentCategory).toBe(parent._id.toString());
        });

        it('updates multiple fields at once', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({
                    name: 'Consumer Electronics',
                    description: 'Consumer electronic devices',
                    isActive: false
                })
                .expect(200);

            expect(res.body.data.name).toBe('Consumer Electronics');
            expect(res.body.data.description).toBe('Consumer electronic devices');
            expect(res.body.data.isActive).toBe(false);
        });

        it('sets parentCategory to null', async () => {
            const parent = await Category.create({ name: 'Parent' });
            const child = await Category.create({
                name: 'Child',
                parentCategory: parent._id
            });

            const res = await request(app)
                .put(`/api/category/${child._id}`)
                .send({ parentCategory: null })
                .expect(200);

            expect(res.body.data.parentCategory).toBeNull();
        });

        it('updates only the fields provided (partial update)', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ description: 'Updated description only' })
                .expect(200);

            expect(res.body.data.name).toBe('Electronics'); // unchanged
            expect(res.body.data.description).toBe('Updated description only');
        });

        it('admin can update any category', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Admin Updated' })
                .expect(200);

            expect(res.body.data.name).toBe('Admin Updated');
        });

        it('trims whitespace from name and description', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({
                    name: '  Trimmed Name  ',
                    description: '  Trimmed Description  '
                })
                .expect(200);

            expect(res.body.data.name).toBe('Trimmed Name');
            expect(res.body.data.description).toBe('Trimmed Description');
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid category ID format', async () => {
            const res = await request(app)
                .put('/api/category/invalid-id')
                .send({ name: 'Updated Name' })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'id' })
                ])
            );
        });

        it('rejects name longer than 50 characters', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'a'.repeat(51) })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'name' })
                ])
            );
        });

        it('rejects description longer than 500 characters', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ description: 'a'.repeat(501) })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'description' })
                ])
            );
        });

        it('rejects invalid parentCategory ObjectId', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ parentCategory: 'not-a-valid-id' })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'parentCategory' })
                ])
            );
        });

        it('rejects invalid isActive type', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ isActive: 'not-a-boolean' })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects empty name', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: '' })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('rejects non-string name', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 12345 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== BUSINESS LOGIC ERRORS =====
    describe('business logic errors', () => {
        it('rejects duplicate category name', async () => {
            await Category.create({ name: 'Existing Category' });

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Existing Category' })
                .expect(400);

            expect(res.body.error.code).toBe('DUPLICATE_CATEGORY_NAME');
            expect(res.body.error.message).toContain('unique');
        });

        it('allows updating to same name (no change)', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Electronics' })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('allows same name after another category is deleted', async () => {
            const other = await Category.create({ name: 'Temporary' });
            await Category.findByIdAndDelete(other._id);

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Temporary' })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('is case-sensitive for category names', async () => {
            await Category.create({ name: 'electronics' });

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'electronics' })
                .expect(400);

            expect(res.body.error.code).toBe('DUPLICATE_CATEGORY_NAME');
        });
    });

    // ===== NOT FOUND ERRORS =====
    describe('not found errors', () => {
        it('returns 404 for non-existent category', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .put(`/api/category/${nonExistentId}`)
                .send({ name: 'Updated Name' })
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });

        it('returns 404 for deleted category', async () => {
            const categoryId = testCategory._id;
            await Category.findByIdAndDelete(categoryId);

            const res = await request(app)
                .put(`/api/category/${categoryId}`)
                .send({ name: 'Updated Name' })
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });
    });

    // ===== AUTHORIZATION ERRORS =====
    describe('authorization errors', () => {
        it('rejects request from seller role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('seller');

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Seller Update' })
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request from user role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'User Update' })
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request from customer role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Customer Update' })
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles name at max length (50 chars)', async () => {
            const maxName = 'a'.repeat(50);
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: maxName })
                .expect(200);

            expect(res.body.data.name).toBe(maxName);
        });

        it('handles description at max length (500 chars)', async () => {
            const maxDesc = 'a'.repeat(500);
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ description: maxDesc })
                .expect(200);

            expect(res.body.data.description).toBe(maxDesc);
        });

        it('handles empty update body (no changes)', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({})
                .expect(200);

            expect(res.body.data.name).toBe('Electronics');
        });

        it('handles special characters in name', async () => {
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ name: 'Electronics & Gadgets (2024)' })
                .expect(200);

            expect(res.body.data.name).toBe('Electronics & Gadgets (2024)');
        });

        it('preserves other fields when updating one field', async () => {
            const original = await Category.findById(testCategory._id);
            
            const res = await request(app)
                .put(`/api/category/${testCategory._id}`)
                .send({ description: 'New description' })
                .expect(200);

            expect(res.body.data.name).toBe(original.name);
            expect(res.body.data.isActive).toBe(original.isActive);
        });
    });
});

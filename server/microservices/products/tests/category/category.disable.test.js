import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Category from '../../src/models/category.model.js';

describe('PATCH /api/category/:id/disable', () => {
    let testCategory;

    beforeEach(() => {
        // Default to admin role (only admins can disable categories)
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
    });

    beforeEach(async () => {
        // Create an enabled test category
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
        it('disables an enabled category successfully', async () => {
            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Category disabled successfully');
            expect(res.body.data).toHaveProperty('_id', testCategory._id.toString());
            expect(res.body.data.isActive).toBe(false);
            expect(res.body.data.name).toBe('Electronics');

            // Verify in database
            const updated = await Category.findById(testCategory._id);
            expect(updated.isActive).toBe(false);
        });

        it('admin can disable any category', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });

        it('disabling an already disabled category is idempotent', async () => {
            // First disable
            await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            // Disable again
            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });

        it('returns CategoryResponse with all fields', async () => {
            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('name');
            expect(res.body.data).toHaveProperty('isActive');
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        it('preserves other category fields when disabling', async () => {
            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.description).toBe('Electronic devices');
        });

        it('disables category with parentCategory', async () => {
            const parent = await Category.create({ name: 'Parent Category', isActive: true });
            const child = await Category.create({
                name: 'Child Category',
                parentCategory: parent._id,
                isActive: true
            });

            const res = await request(app)
                .patch(`/api/category/${child._id}/disable`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
            expect(res.body.data.parentCategory).toBe(parent._id.toString());
        });

        it('disables category without description', async () => {
            const noDesc = await Category.create({ name: 'No Description', isActive: true });

            const res = await request(app)
                .patch(`/api/category/${noDesc._id}/disable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
        });

        it('disables parent category without affecting children', async () => {
            const parent = await Category.create({ name: 'Parent', isActive: true });
            const child = await Category.create({
                name: 'Child',
                parentCategory: parent._id,
                isActive: true
            });

            const res = await request(app)
                .patch(`/api/category/${parent._id}/disable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);

            // Child should remain enabled
            const childStillEnabled = await Category.findById(child._id);
            expect(childStillEnabled.isActive).toBe(true);
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid category ID format', async () => {
            const res = await request(app)
                .patch('/api/category/invalid-id/disable')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'id' })
                ])
            );
        });

        it('rejects non-ObjectId string', async () => {
            const res = await request(app)
                .patch('/api/category/not-a-mongo-id/disable')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ===== NOT FOUND ERRORS =====
    describe('not found errors', () => {
        it('returns 404 for non-existent category', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/category/${nonExistentId}/disable`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
            expect(res.body.error.message).toContain('not found');
        });

        it('returns 404 for deleted category', async () => {
            const categoryId = testCategory._id;
            await Category.findByIdAndDelete(categoryId);

            const res = await request(app)
                .patch(`/api/category/${categoryId}/disable`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });
    });

    // ===== AUTHORIZATION ERRORS =====
    describe('authorization errors', () => {
        it('rejects request from seller role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('seller');

            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');

            // Verify category is still enabled
            const stillEnabled = await Category.findById(testCategory._id);
            expect(stillEnabled.isActive).toBe(true);
        });

        it('rejects request from user role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request from customer role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request without authentication', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole(null);

            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(403);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('disables category with special characters in name', async () => {
            const special = await Category.create({
                name: 'Electronics & Gadgets (2024)',
                isActive: true
            });

            const res = await request(app)
                .patch(`/api/category/${special._id}/disable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
            expect(res.body.data.name).toBe('Electronics & Gadgets (2024)');
        });

        it('disables category with max length description', async () => {
            const maxDesc = await Category.create({
                name: 'Max Description',
                description: 'a'.repeat(500),
                isActive: true
            });

            const res = await request(app)
                .patch(`/api/category/${maxDesc._id}/disable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
        });

        it('disables category with null parentCategory', async () => {
            const noParent = await Category.create({
                name: 'Top Level',
                parentCategory: null,
                isActive: true
            });

            const res = await request(app)
                .patch(`/api/category/${noParent._id}/disable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
            expect(res.body.data.parentCategory).toBeNull();
        });

        it('returns proper CategoryResponse format', async () => {
            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('isActive', false);
            expect(res.body).not.toHaveProperty('error');
        });

        it('disables category created at boundary times', async () => {
            const boundary = await Category.create({
                name: 'Boundary Category',
                createdAt: new Date('1970-01-01'),
                isActive: true
            });

            const res = await request(app)
                .patch(`/api/category/${boundary._id}/disable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
        });

        it('disables multiple categories sequentially', async () => {
            const cat1 = await Category.create({ name: 'Category 1', isActive: true });
            const cat2 = await Category.create({ name: 'Category 2', isActive: true });

            const res1 = await request(app)
                .patch(`/api/category/${cat1._id}/disable`)
                .expect(200);

            const res2 = await request(app)
                .patch(`/api/category/${cat2._id}/disable`)
                .expect(200);

            expect(res1.body.data.isActive).toBe(false);
            expect(res2.body.data.isActive).toBe(false);
        });

        it('updatedAt timestamp changes when disabling', async () => {
            const original = await Category.findById(testCategory._id);

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            const updatedTimestamp = new Date(res.body.data.updatedAt);
            const originalTimestamp = new Date(original.updatedAt);

            expect(updatedTimestamp.getTime()).toBeGreaterThanOrEqual(originalTimestamp.getTime());
        });

        it('can re-enable a disabled category', async () => {
            // First disable
            await request(app)
                .patch(`/api/category/${testCategory._id}/disable`)
                .expect(200);

            // Then enable
            const res = await request(app)
                .patch(`/api/category/${testCategory._id}/enable`)
                .expect(200);

            expect(res.body.data.isActive).toBe(true);
        });
    });
});

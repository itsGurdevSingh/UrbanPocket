import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Category from '../../src/models/category.model.js';

describe('DELETE /api/category/:id', () => {
    let testCategory;

    beforeEach(() => {
        // Default to admin role (only admins can delete categories)
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
        it('deletes category successfully', async () => {
            const res = await request(app)
                .delete(`/api/category/${testCategory._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Category deleted successfully');
            expect(res.body.data).toBeNull();

            // Verify category is actually deleted
            const deleted = await Category.findById(testCategory._id);
            expect(deleted).toBeNull();
        });

        it('admin can delete any category', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app)
                .delete(`/api/category/${testCategory._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('deletes category with parentCategory', async () => {
            const parent = await Category.create({ name: 'Parent Category' });
            const child = await Category.create({
                name: 'Child Category',
                parentCategory: parent._id
            });

            const res = await request(app)
                .delete(`/api/category/${child._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);

            // Verify child is deleted
            const deleted = await Category.findById(child._id);
            expect(deleted).toBeNull();

            // Verify parent still exists
            const parentStillExists = await Category.findById(parent._id);
            expect(parentStillExists).not.toBeNull();
        });

        it('deletes inactive category', async () => {
            const inactive = await Category.create({
                name: 'Inactive Category',
                isActive: false
            });

            const res = await request(app)
                .delete(`/api/category/${inactive._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('deletes category without description', async () => {
            const noDesc = await Category.create({ name: 'No Description' });

            const res = await request(app)
                .delete(`/api/category/${noDesc._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid category ID format', async () => {
            const res = await request(app)
                .delete('/api/category/invalid-id')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'id' })
                ])
            );
        });

        it('rejects empty category ID', async () => {
            const res = await request(app)
                .delete('/api/category/')
                .expect(404); // Express returns 404 for unmatched routes

            // This hits the catch-all route handler
        });
    });

    // ===== NOT FOUND ERRORS =====
    describe('not found errors', () => {
        it('returns 404 for non-existent category', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/category/${nonExistentId}`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
            expect(res.body.error.message).toContain('not found');
        });

        it('returns 404 when trying to delete already deleted category', async () => {
            const categoryId = testCategory._id;
            await Category.findByIdAndDelete(categoryId);

            const res = await request(app)
                .delete(`/api/category/${categoryId}`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });
    });

    // ===== AUTHORIZATION ERRORS =====
    describe('authorization errors', () => {
        it('rejects request from seller role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('seller');

            const res = await request(app)
                .delete(`/api/category/${testCategory._id}`)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');

            // Verify category still exists
            const stillExists = await Category.findById(testCategory._id);
            expect(stillExists).not.toBeNull();
        });

        it('rejects request from user role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app)
                .delete(`/api/category/${testCategory._id}`)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });

        it('rejects request from customer role', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const res = await request(app)
                .delete(`/api/category/${testCategory._id}`)
                .expect(403);

            expect(res.body).toHaveProperty('code', 'FORBIDDEN_ROLE');
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('deletes category with special characters in name', async () => {
            const special = await Category.create({
                name: 'Electronics & Gadgets (2024)'
            });

            const res = await request(app)
                .delete(`/api/category/${special._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('deletes category with max length description', async () => {
            const maxDesc = await Category.create({
                name: 'Max Description',
                description: 'a'.repeat(500)
            });

            const res = await request(app)
                .delete(`/api/category/${maxDesc._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('handles deletion with null parentCategory', async () => {
            const noParent = await Category.create({
                name: 'No Parent',
                parentCategory: null
            });

            const res = await request(app)
                .delete(`/api/category/${noParent._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('allows deleting parent category (no cascade check)', async () => {
            const parent = await Category.create({ name: 'Parent' });
            const child = await Category.create({
                name: 'Child',
                parentCategory: parent._id
            });

            const res = await request(app)
                .delete(`/api/category/${parent._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);

            // Child still exists (no cascade delete)
            const childStillExists = await Category.findById(child._id);
            expect(childStillExists).not.toBeNull();
            expect(childStillExists.parentCategory.toString()).toBe(parent._id.toString());
        });

        it('returns proper response format (MessageResponse)', async () => {
            const res = await request(app)
                .delete(`/api/category/${testCategory._id}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data', null);
            expect(res.body).not.toHaveProperty('error');
        });

        it('deletes category created at boundary times', async () => {
            const boundary = await Category.create({
                name: 'Boundary Category',
                createdAt: new Date('1970-01-01')
            });

            const res = await request(app)
                .delete(`/api/category/${boundary._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });
});

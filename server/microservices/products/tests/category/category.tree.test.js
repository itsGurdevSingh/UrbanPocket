import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Category from '../../src/models/category.model.js';

describe('GET /api/category/:id/tree', () => {
    beforeEach(async () => {
        await Category.deleteMany({});
    });

    afterEach(async () => {
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('returns single category without children when no descendants exist', async () => {
            const category = await Category.create({ name: 'Electronics' });

            const res = await request(app)
                .get(`/api/category/${category._id}/tree`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Category tree fetched successfully');
            expect(res.body.data._id.toString()).toBe(category._id.toString());
            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.children).toBeUndefined();
        });

        it('returns category with one level of children', async () => {
            const parent = await Category.create({ name: 'Electronics' });
            const child1 = await Category.create({
                name: 'Phones',
                parentCategory: parent._id,
                ancestors: [parent._id]
            });
            const child2 = await Category.create({
                name: 'Laptops',
                parentCategory: parent._id,
                ancestors: [parent._id]
            });

            const res = await request(app)
                .get(`/api/category/${parent._id}/tree`)
                .expect(200);

            expect(res.body.data._id.toString()).toBe(parent._id.toString());
            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.children).toHaveLength(2);

            const childNames = res.body.data.children.map(c => c.name).sort();
            expect(childNames).toEqual(['Laptops', 'Phones']);
        });

        it('returns category with nested multi-level children', async () => {
            // Level 1: Electronics
            const electronics = await Category.create({ name: 'Electronics' });

            // Level 2: Phones under Electronics
            const phones = await Category.create({
                name: 'Phones',
                parentCategory: electronics._id,
                ancestors: [electronics._id]
            });

            // Level 3: Smartphones under Phones
            const smartphones = await Category.create({
                name: 'Smartphones',
                parentCategory: phones._id,
                ancestors: [electronics._id, phones._id]
            });

            // Level 4: Android under Smartphones
            const android = await Category.create({
                name: 'Android',
                parentCategory: smartphones._id,
                ancestors: [electronics._id, phones._id, smartphones._id]
            });

            const res = await request(app)
                .get(`/api/category/${electronics._id}/tree`)
                .expect(200);

            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.children).toHaveLength(1);
            expect(res.body.data.children[0].name).toBe('Phones');
            expect(res.body.data.children[0].children).toHaveLength(1);
            expect(res.body.data.children[0].children[0].name).toBe('Smartphones');
            expect(res.body.data.children[0].children[0].children).toHaveLength(1);
            expect(res.body.data.children[0].children[0].children[0].name).toBe('Android');
        });

        it('returns category with multiple children at different levels', async () => {
            // Root: Electronics
            const electronics = await Category.create({ name: 'Electronics' });

            // Level 2
            const phones = await Category.create({
                name: 'Phones',
                parentCategory: electronics._id,
                ancestors: [electronics._id]
            });
            const computers = await Category.create({
                name: 'Computers',
                parentCategory: electronics._id,
                ancestors: [electronics._id]
            });

            // Level 3 under Phones
            const smartphones = await Category.create({
                name: 'Smartphones',
                parentCategory: phones._id,
                ancestors: [electronics._id, phones._id]
            });
            const featurePhones = await Category.create({
                name: 'Feature Phones',
                parentCategory: phones._id,
                ancestors: [electronics._id, phones._id]
            });

            // Level 3 under Computers
            const laptops = await Category.create({
                name: 'Laptops',
                parentCategory: computers._id,
                ancestors: [electronics._id, computers._id]
            });

            const res = await request(app)
                .get(`/api/category/${electronics._id}/tree`)
                .expect(200);

            expect(res.body.data.name).toBe('Electronics');
            expect(res.body.data.children).toHaveLength(2);

            const phoneNode = res.body.data.children.find(c => c.name === 'Phones');
            expect(phoneNode.children).toHaveLength(2);
            expect(phoneNode.children.map(c => c.name).sort()).toEqual(['Feature Phones', 'Smartphones']);

            const computerNode = res.body.data.children.find(c => c.name === 'Computers');
            expect(computerNode.children).toHaveLength(1);
            expect(computerNode.children[0].name).toBe('Laptops');
        });

        it('returns sub-category tree (not root)', async () => {
            const electronics = await Category.create({ name: 'Electronics' });
            const phones = await Category.create({
                name: 'Phones',
                parentCategory: electronics._id,
                ancestors: [electronics._id]
            });
            const smartphones = await Category.create({
                name: 'Smartphones',
                parentCategory: phones._id,
                ancestors: [electronics._id, phones._id]
            });

            // Request tree for "Phones" (not the root)
            const res = await request(app)
                .get(`/api/category/${phones._id}/tree`)
                .expect(200);

            expect(res.body.data.name).toBe('Phones');
            expect(res.body.data.parentCategory.toString()).toBe(electronics._id.toString());
            expect(res.body.data.children).toHaveLength(1);
            expect(res.body.data.children[0].name).toBe('Smartphones');
        });

        it('includes all category fields in response', async () => {
            const category = await Category.create({
                name: 'Electronics',
                description: 'Electronic items',
                isActive: true
            });

            const res = await request(app)
                .get(`/api/category/${category._id}/tree`)
                .expect(200);

            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('name', 'Electronics');
            expect(res.body.data).toHaveProperty('description', 'Electronic items');
            expect(res.body.data).toHaveProperty('isActive', true);
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
            expect(res.body.data).toHaveProperty('ancestors');
        });

        it('includes inactive categories in tree', async () => {
            const parent = await Category.create({ name: 'Electronics', isActive: true });
            const child = await Category.create({
                name: 'Phones',
                parentCategory: parent._id,
                ancestors: [parent._id],
                isActive: false
            });

            const res = await request(app)
                .get(`/api/category/${parent._id}/tree`)
                .expect(200);

            expect(res.body.data.children).toHaveLength(1);
            expect(res.body.data.children[0].name).toBe('Phones');
            expect(res.body.data.children[0].isActive).toBe(false);
        });

        it('handles complex tree with 5 levels deep', async () => {
            const level1 = await Category.create({ name: 'Level 1' });
            const level2 = await Category.create({
                name: 'Level 2',
                parentCategory: level1._id,
                ancestors: [level1._id]
            });
            const level3 = await Category.create({
                name: 'Level 3',
                parentCategory: level2._id,
                ancestors: [level1._id, level2._id]
            });
            const level4 = await Category.create({
                name: 'Level 4',
                parentCategory: level3._id,
                ancestors: [level1._id, level2._id, level3._id]
            });
            const level5 = await Category.create({
                name: 'Level 5',
                parentCategory: level4._id,
                ancestors: [level1._id, level2._id, level3._id, level4._id]
            });

            const res = await request(app)
                .get(`/api/category/${level1._id}/tree`)
                .expect(200);

            let current = res.body.data;
            expect(current.name).toBe('Level 1');

            current = current.children[0];
            expect(current.name).toBe('Level 2');

            current = current.children[0];
            expect(current.name).toBe('Level 3');

            current = current.children[0];
            expect(current.name).toBe('Level 4');

            current = current.children[0];
            expect(current.name).toBe('Level 5');
            expect(current.children).toBeUndefined();
        });
    });

    // ===== VALIDATION ERRORS =====
    describe('validation errors', () => {
        it('rejects invalid category ID format', async () => {
            const res = await request(app)
                .get('/api/category/invalid-id/tree')
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('returns 404 for non-existent category', async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .get(`/api/category/${fakeId}/tree`)
                .expect(404);

            expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
        });
    });

    // ===== NO AUTHENTICATION REQUIRED =====
    describe('no authentication required', () => {
        it('allows access without authentication (public endpoint)', async () => {
            const category = await Category.create({ name: 'Public Category' });

            const res = await request(app)
                .get(`/api/category/${category._id}/tree`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles category with siblings correctly (only returns requested subtree)', async () => {
            const parent = await Category.create({ name: 'Parent' });

            const child1 = await Category.create({
                name: 'Child 1',
                parentCategory: parent._id,
                ancestors: [parent._id]
            });
            const child2 = await Category.create({
                name: 'Child 2',
                parentCategory: parent._id,
                ancestors: [parent._id]
            });

            const grandchild1 = await Category.create({
                name: 'Grandchild 1',
                parentCategory: child1._id,
                ancestors: [parent._id, child1._id]
            });

            // Request tree for child1 only
            const res = await request(app)
                .get(`/api/category/${child1._id}/tree`)
                .expect(200);

            expect(res.body.data.name).toBe('Child 1');
            expect(res.body.data.children).toHaveLength(1);
            expect(res.body.data.children[0].name).toBe('Grandchild 1');

            // Should not include Child 2 (sibling)
            const allNames = JSON.stringify(res.body.data);
            expect(allNames).not.toContain('Child 2');
        });

        it('returns proper response structure', async () => {
            const category = await Category.create({ name: 'Test' });

            const res = await request(app)
                .get(`/api/category/${category._id}/tree`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('name');
        });

        it('handles top-level category with null parentCategory', async () => {
            const category = await Category.create({
                name: 'Top Level',
                parentCategory: null
            });

            const res = await request(app)
                .get(`/api/category/${category._id}/tree`)
                .expect(200);

            expect(res.body.data.parentCategory).toBeNull();
        });

        it('handles wide tree (many children at same level)', async () => {
            const parent = await Category.create({ name: 'Parent' });

            // Create 10 children
            const children = [];
            for (let i = 1; i <= 10; i++) {
                const child = await Category.create({
                    name: `Child ${i}`,
                    parentCategory: parent._id,
                    ancestors: [parent._id]
                });
                children.push(child);
            }

            const res = await request(app)
                .get(`/api/category/${parent._id}/tree`)
                .expect(200);

            expect(res.body.data.children).toHaveLength(10);
            const childNames = res.body.data.children.map(c => c.name).sort();
            expect(childNames).toEqual([
                'Child 1', 'Child 10', 'Child 2', 'Child 3', 'Child 4',
                'Child 5', 'Child 6', 'Child 7', 'Child 8', 'Child 9'
            ]);
        });

        it('preserves all nested fields in deeply nested structure', async () => {
            const level1 = await Category.create({
                name: 'L1',
                description: 'Level 1 desc',
                isActive: true
            });
            const level2 = await Category.create({
                name: 'L2',
                description: 'Level 2 desc',
                parentCategory: level1._id,
                ancestors: [level1._id],
                isActive: false
            });

            const res = await request(app)
                .get(`/api/category/${level1._id}/tree`)
                .expect(200);

            expect(res.body.data.description).toBe('Level 1 desc');
            expect(res.body.data.isActive).toBe(true);
            expect(res.body.data.children[0].description).toBe('Level 2 desc');
            expect(res.body.data.children[0].isActive).toBe(false);
        });
    });
});

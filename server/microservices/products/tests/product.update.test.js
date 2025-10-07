import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/product.model.js';
import productRepository from '../src/repositories/product.repository.js';

// Helper to build a product
const buildProduct = (overrides = {}) => ({
    name: `Upd-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Update test product',
    sellerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(),
    attributes: ['Size'],
    baseImages: [{ url: 'http://example.com/img.jpg' }],
    brand: 'BrandX',
    ...overrides
});

// Helper to issue multipart update request (simulate optional new images)
const sendUpdate = (id, fields = {}, images = []) => {
    let req = request(app).put(`/api/product/${id}`);
    Object.entries(fields).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            req = req.field(k, JSON.stringify(v));
        } else {
            req = req.field(k, v);
        }
    });
    images.forEach((img, idx) => {
        req = req.attach('images', Buffer.from(`fake-update-${idx}`), img);
    });
    return req;
};

describe('PUT /api/product/:id', () => {
    beforeEach(async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        await Product.deleteMany({});
    });
    afterEach(async () => {
        await Product.deleteMany({});
        jest.restoreAllMocks();
    });

    it('returns 400 for invalid id', async () => {
        const res = await request(app).put('/api/product/not-valid').expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when product not found', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const res = await sendUpdate(id, { name: 'New Name' }).expect(404);
        expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('updates product basic fields (name, description, brand)', async () => {
        // Since ownership check compares sellerId to currentUser.id ('test-user' in mock), set product sellerId to arbitrary (mismatch) will cause 403.
        // So we create as admin to bypass or set role to admin.
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const doc = await Product.create(buildProduct());
        const res = await sendUpdate(doc._id.toString(), { name: 'Updated Name', description: 'Updated Description', brand: 'BrandY' }).expect(200);
        expect(res.body).toHaveProperty('product');
        expect(res.body.product).toHaveProperty('name', 'Updated Name');
        expect(res.body.product).toHaveProperty('brand', 'BrandY');
    });

    it('prevents duplicate product name', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const p1 = await Product.create(buildProduct({ name: 'DupName' }));
        const p2 = await Product.create(buildProduct({ name: 'OtherName' }));
        const res = await sendUpdate(p2._id.toString(), { name: 'DupName' }).expect(400);
        expect(res.body.code).toBe('DUPLICATE_PRODUCT_NAME');
    });

    it('returns 403 when seller updates another seller\'s product', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        const foreignSellerId = new mongoose.Types.ObjectId();
        const doc = await Product.create(buildProduct({ sellerId: foreignSellerId }));
        const res = await sendUpdate(doc._id.toString(), { name: 'Hack Attempt' }).expect(403);
        expect(res.body.code).toBe('UNAUTHORIZED_PRODUCT_UPDATE');
    });

    it('appends new images when provided', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const doc = await Product.create(buildProduct());
        const res = await sendUpdate(doc._id.toString(), { name: 'Img Append' }, ['new1.png', 'new2.png']).expect(200);
        expect(res.body.product.baseImages.length).toBeGreaterThanOrEqual(3); // original + 2 new (mock upload returns +2)
    });

    it('returns 500 on repository error', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const doc = await Product.create(buildProduct());
        jest.spyOn(productRepository, 'updateById').mockRejectedValue(new Error('Simulated repo failure'));
        const res = await sendUpdate(doc._id.toString(), { name: 'Trigger Error' }).expect(500);
        expect(['UPDATE_PRODUCT_FAILED', 'UPDATE_PRODUCT_ERROR']).toContain(res.body.code);
    });
});

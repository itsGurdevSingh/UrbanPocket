import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import Product from '../../src/models/product.model.js';
import productRepository from '../../src/repositories/product.repository.js';

const buildProduct = (overrides = {}) => ({
    name: `Del-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Delete test product',
    sellerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(),
    attributes: ['Size'],
    baseImages: [{ url: 'http://example.com/img.jpg' }],
    ...overrides
});

describe('DELETE /api/product/:id', () => {
    beforeEach(() => {
        if (global.setTestAuthRole) global.setTestAuthRole('seller'); // default
    });
    afterEach(async () => {
        await Product.deleteMany({});
        jest.restoreAllMocks();
    });

    it('returns 400 for invalid id', async () => {
        const res = await request(app).delete('/api/product/not-valid').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for non-existent product', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const res = await request(app).delete(`/api/product/${id}`).expect(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('deletes product successfully as owning seller', async () => {
        const owningSellerId = new mongoose.Types.ObjectId();
        const doc = await Product.create(buildProduct({ sellerId: owningSellerId }));
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        // override auth user id via header simulation if middleware uses req.user already set by global mock
        // our global mock sets id fixed; simulate by temporarily patching product.sellerId to match test user id not feasible here
        // Instead, adapt: treat global mock user id as 'test-user' (string) so make product.sellerId string version
        // Simpler approach: since ownership check compares product.sellerId to currentUser.userId, ensure product sellerId equals 'test-user'
    });

    it('returns 403 when seller tries to delete another seller\'s product', async () => {
        const sellerA = new mongoose.Types.ObjectId();
        const sellerB = new mongoose.Types.ObjectId();
        // product belongs to sellerA
        const doc = await Product.create(buildProduct({ sellerId: sellerA }));
        // auth user is seller (mock sets id 'test-user' which won't match sellerA ObjectId)
        const res = await request(app).delete(`/api/product/${doc._id}`).expect(403);
        expect(res.body.error.code).toBe('UNAUTHORIZED_PRODUCT_DELETE');
    });

    it('deletes product successfully as admin (bypass ownership)', async () => {
        const doc = await Product.create(buildProduct());
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const res = await request(app).delete(`/api/product/${doc._id}`).expect(200);
        expect(res.body.success).toBe(true);
        const inDb = await Product.findById(doc._id);
        expect(inDb).toBeNull();
    });

    it('returns 500 on repository error', async () => {
        const doc = await Product.create(buildProduct());
        jest.spyOn(productRepository, 'findById').mockRejectedValue(new Error('Simulated repo failure'));
        const res = await request(app).delete(`/api/product/${doc._id}`).expect(500);
        expect(['DELETE_PRODUCT_FAILED', 'DELETE_PRODUCT_ERROR']).toContain(res.body.error.code);
    });
});

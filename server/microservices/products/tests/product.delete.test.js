import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/product.model.js';
import productRepository from '../src/repositories/product.repository.js';

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
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
    });
    afterEach(async () => {
        await Product.deleteMany({});
        jest.restoreAllMocks();
    });

    it('returns 400 for invalid id', async () => {
        const res = await request(app).delete('/api/product/not-valid').expect(400);
        expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('returns 404 for non-existent product', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const res = await request(app).delete(`/api/product/${id}`).expect(404);
        expect(res.body).toHaveProperty('code', 'PRODUCT_NOT_FOUND');
    });

    it('deletes product successfully', async () => {
        const doc = await Product.create(buildProduct());
        const res = await request(app).delete(`/api/product/${doc._id}`).expect(200);
        expect(res.body).toHaveProperty('status', 'success');
        expect(res.body).toHaveProperty('message', 'Product deleted successfully');
        const inDb = await Product.findById(doc._id);
        expect(inDb).toBeNull();
    });

    it('returns 500 on repository error', async () => {
        const doc = await Product.create(buildProduct());
        jest.spyOn(productRepository, 'findById').mockRejectedValue(new Error('Simulated repo failure'));
        const res = await request(app).delete(`/api/product/${doc._id}`).expect(500);
        expect(['DELETE_PRODUCT_FAILED', 'DELETE_PRODUCT_ERROR']).toContain(res.body.code);
    });
});

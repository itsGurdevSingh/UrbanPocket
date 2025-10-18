import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import Product from '../../src/models/product.model.js';
import productRepository from '../../src/repositories/product.repository.js';

const buildProduct = (overrides = {}) => ({
    name: `Prod-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Sample description for product',
    sellerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(),
    attributes: ['Size'],
    baseImages: [{ url: 'http://example.com/base.jpg' }],
    ...overrides
});

describe('GET /api/product/:id', () => {
    afterEach(async () => {
        await Product.deleteMany({});
        jest.restoreAllMocks();
    });

    it('returns 400 for invalid ObjectId', async () => {
        const res = await request(app).get('/api/product/not-a-valid-id').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when product not found', async () => {
        const validId = new mongoose.Types.ObjectId().toString();
        const res = await request(app).get(`/api/product/${validId}`).expect(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('returns product when found', async () => {
        const doc = await Product.create(buildProduct());
        const res = await request(app).get(`/api/product/${doc._id.toString()}`).expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('_id', doc._id.toString());
        expect(res.body.data).toHaveProperty('name', doc.name);
    });

    it('handles repository/service errors (500)', async () => {
        const doc = await Product.create(buildProduct());
        jest.spyOn(productRepository, 'findById').mockRejectedValue(new Error('Simulated downstream failure'));
        const res = await request(app).get(`/api/product/${doc._id.toString()}`).expect(500);
        expect(['FETCH_PRODUCT_FAILED', 'FETCH_PRODUCT_ERROR', 'INTERNAL_ERROR']).toContain(res.body.error.code);
    });
});

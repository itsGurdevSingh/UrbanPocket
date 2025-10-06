import request from 'supertest';
import mongoose from 'mongoose';

// Mock MUST be declared before importing app/router
jest.mock('../src/middlewares/authenticateUser.js', () => ({
    __esModule: true,
    authenticate: (req, res, next) => { req.user = { id: 'u1', role: 'user' }; next(); },
    default: () => (req, res, next) => { req.user = { id: 'u1', role: 'user' }; next(); }
}));

import app from '../src/app.js';
import Product from '../src/models/product.model.js';
import productRepository from '../src/repositories/product.repository.js';

describe('GET /api/product/getAll', () => {
    afterEach(async () => {
        await Product.deleteMany({});
        jest.restoreAllMocks();
    });

    it('returns empty array when no products', async () => {
        const res = await request(app).get('/api/product/getAll').expect(200);
        expect(res.body).toHaveProperty('status', 'success');
        expect(Array.isArray(res.body.products)).toBe(true);
        expect(res.body.products.length).toBe(0);
    });

    it('returns list of products when present', async () => {
        await Product.insertMany([
            { name: 'Prod A', description: 'Desc A', sellerId: new mongoose.Types.ObjectId(), categoryId: new mongoose.Types.ObjectId(), attributes: ['Size'], baseImages: [{ url: 'http://example.com/a.jpg' }] },
            { name: 'Prod B', description: 'Desc B', sellerId: new mongoose.Types.ObjectId(), categoryId: new mongoose.Types.ObjectId(), attributes: ['Color'], baseImages: [{ url: 'http://example.com/b.jpg' }] }
        ]);
        const res = await request(app).get('/api/product/getAll').expect(200);
        expect(res.body.products.length).toBe(2);
        const names = res.body.products.map(p => p.name).sort();
        expect(names).toEqual(['Prod A', 'Prod B']);
    });

    it('handles repository/service errors gracefully', async () => {
        jest.spyOn(productRepository, 'findAll').mockRejectedValue(new Error('Simulated DB failure'));
        const res = await request(app).get('/api/product/getAll').expect(500);
        expect(res.body).toHaveProperty('status', 'error');
        expect(['FETCH_PRODUCTS_FAILED', 'FETCH_PRODUCTS_ERROR']).toContain(res.body.code);
    });
});

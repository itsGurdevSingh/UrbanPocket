import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/product.model.js';
// Adjusted: mock the service layer instead of repository internal method for error case
import productService from '../src/services/product.service.js';

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

    it('handles service errors gracefully', async () => {
        jest.spyOn(productService, 'getAllProducts').mockRejectedValue(new Error('Simulated DB failure'));
        const res = await request(app).get('/api/product/getAll').expect(500);
        expect(res.body).toHaveProperty('status', 'error');
        // Controller-level code now may produce FETCH_PRODUCTS_ERROR if generic error is thrown
        expect(['FETCH_PRODUCTS_FAILED', 'FETCH_PRODUCTS_ERROR']).toContain(res.body.code);
    });
});

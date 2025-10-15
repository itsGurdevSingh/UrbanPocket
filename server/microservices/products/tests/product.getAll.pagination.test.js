import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/product.model.js';

/** Helper to build a product */
const build = (overrides = {}) => ({
    name: `Pag-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Sample desc for pagination tests',
    sellerId: new mongoose.Types.ObjectId(),
    categoryId: new mongoose.Types.ObjectId(),
    attributes: ['Size'],
    baseImages: [{ url: 'http://example.com/a.jpg' }],
    brand: 'BrandX',
    ...overrides
});

let seeded = [];

beforeEach(async () => {
    if (global.setTestAuthRole) global.setTestAuthRole('user');
    if (mongoose.connection.readyState !== 1) {
        await new Promise(resolve => mongoose.connection.once('open', resolve));
    }
    if (Product.schema && Product.schema.paths.name?.options?.text) {
        try { await Product.collection.createIndex({ name: 'text', description: 'text', brand: 'text' }); } catch (e) { /* ignore */ }
    }
    const now = new Date();
    const docs = [];
    const ts = Date.now();
    for (let i = 0; i < 18; i++) {
        docs.push(build({
            name: `Pag-${i}-${ts}-${Math.random().toString(16).slice(2, 8)}`,
            brand: i % 2 === 0 ? 'EvenBrand' : 'OddBrand',
            isActive: i % 3 !== 0,
            createdAt: new Date(now.getTime() - i * 3600_000),
            updatedAt: new Date(now.getTime() - i * 1800_000)
        }));
    }
    docs.push(build({ name: 'UniqueAlphaProduct', description: 'Special searchable phrase', brand: 'SearchBrand', isActive: true }));
    seeded = await Product.insertMany(docs, { ordered: false });
    expect(seeded.length).toBeGreaterThanOrEqual(10); // sanity
});

describe('GET /api/product/getAll pagination & filtering', () => {
    test('returns default first page with meta', async () => {
        const res = await request(app).get('/api/product/getAll').expect(200);
        expect(res.body.data).toHaveProperty('meta');
        expect(res.body.data.meta.page).toBe(1);
        expect(res.body.data.meta.limit).toBe(20);
        expect(res.body.data.meta.total).toBeGreaterThanOrEqual(10); // flexible lower bound due to potential unique collisions
        expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    test('respects limit and page', async () => {
        const res = await request(app).get('/api/product/getAll?limit=5&page=2').expect(200);
        expect(res.body.data.products.length).toBeLessThanOrEqual(5);
        expect(res.body.data.meta.page).toBe(2);
        expect(res.body.data.meta.limit).toBe(5);
    });

    test('filters by brand', async () => {
        const res = await request(app).get('/api/product/getAll?brand=EvenBrand').expect(200);
        expect(res.body.data.products.every(p => p.brand === 'EvenBrand')).toBe(true);
    });

    test('filters by isActive=false', async () => {
        const res = await request(app).get('/api/product/getAll?isActive=false&limit=50').expect(200);
        expect(res.body.data.products.length).toBeGreaterThan(0);
        expect(res.body.data.products.every(p => p.isActive === false)).toBe(true);
    });

    test('filters by ids list', async () => {
        // Create two deterministic products just for this test
        const p1 = await Product.create(build({ name: `IDS-A-${Date.now()}` }));
        const p2 = await Product.create(build({ name: `IDS-B-${Date.now()}` }));
        const subset = `${p1._id.toString()},${p2._id.toString()}`;
        const res = await request(app).get(`/api/product/getAll?ids=${subset}&limit=10`).expect(200);
        const returnedIds = new Set(res.body.data.products.map(p => p._id.toString()));
        expect(returnedIds.has(p1._id.toString())).toBe(true);
        expect(returnedIds.has(p2._id.toString())).toBe(true);
    });

    test('field selection works', async () => {
        const res = await request(app).get('/api/product/getAll?fields=name,brand').expect(200);
        expect(res.body.data.products.length).toBeGreaterThan(0);
        res.body.data.products.forEach(p => {
            expect(p).toHaveProperty('name');
            expect(p).toHaveProperty('brand');
            // ensure other fields like sellerId not present
            expect(p.sellerId).toBeUndefined();
        });
    });

    test('text search (q) returns matching product', async () => {
        const res = await request(app).get('/api/product/getAll?q=UniqueAlphaProduct&fields=name').expect(200);
        expect(res.body.data.products.some(p => p.name === 'UniqueAlphaProduct')).toBe(true);
    });

    test('sort by name ascending', async () => {
        const res = await request(app).get('/api/product/getAll?sort=name&limit=50').expect(200);
        const names = res.body.data.products.map(p => p.name);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
    });

    test('page beyond last returns empty array', async () => {
        const res = await request(app).get('/api/product/getAll?limit=5&page=999').expect(200);
        expect(res.body.data.products.length).toBe(0);
        expect(res.body.data.meta.hasNextPage).toBe(false);
    });

    test('invalid ids param rejected', async () => {
        const res = await request(app).get('/api/product/getAll?ids=badid123').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});

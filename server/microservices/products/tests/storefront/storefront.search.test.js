import request from 'supertest';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

import app from '../../src/app.js';
import Product from '../../src/models/product.model.js';
import ProductVariant from '../../src/models/variant.model.js';
import InventoryItem from '../../src/models/inventory.model.js';
import Category from '../../src/models/category.model.js';

// ---------- Helpers (DRY) ----------
const OID = (v) => new mongoose.Types.ObjectId(v);
const asDate = (v) => new Date(v);

const reviveSpecials = (input) => {
    if (Array.isArray(input)) return input.map(reviveSpecials);
    if (input && typeof input === 'object') {
        // $oid wrapper
        if (Object.keys(input).length === 1 && '$oid' in input) return OID(input.$oid);
        // $date wrapper
        if (Object.keys(input).length === 1 && '$date' in input) return asDate(input.$date);
        const out = {};
        for (const [k, v] of Object.entries(input)) out[k] = reviveSpecials(v);
        return out;
    }
    return input;
};

const readSeed = (file) => {
    // seed folder is in tests/seed relative to project root (process.cwd())
    const p = path.resolve(process.cwd(), 'tests', 'seed', file);
    const raw = fs.readFileSync(p, 'utf8');
    return reviveSpecials(JSON.parse(raw));
};

const ensureTextIndex = async () => {
    // Ensure text index exists for relevance sort/search
    try {
        await Product.collection.createIndex({ name: 'text', brand: 'text', description: 'text' }, {
            weights: { name: 10, brand: 5, description: 3 },
        });
    } catch (_e) {
        // ignore; index likely exists
    }
};

const seedAll = async () => {
    const categories = readSeed('CategorySeedData.json');
    const products = readSeed('productSeedData.json');
    const variants = readSeed('variantSeedData.json');
    const inventory = readSeed('inventorySeedData.json');

    await Category.insertMany(categories, { ordered: false });
    await Product.insertMany(products, { ordered: false });
    await ProductVariant.insertMany(variants, { ordered: false });
    await InventoryItem.insertMany(inventory, { ordered: false });
};

// ---------- Suite ----------
describe('Storefront Search API - GET /api/storefront/search', () => {
    beforeAll(async () => {
        // Wait for mongoose connection from global setup
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve) => mongoose.connection.once('open', resolve));
        }
        await ensureTextIndex();
    });

    beforeEach(async () => {
        await seedAll();
    });

    // Happy path: basic search by text with relevance
    test('text search with relevance returns matching products', async () => {
        const res = await request(app)
            .get('/api/storefront/search')
            .query({ search: 'iPhone Samsung Galaxy', sortBy: 'relevance' })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.products)).toBe(true);
        // Should include Samsung Galaxy S25 Ultra when in stock and active
        const names = res.body.data.products.map((p) => p.name);
        expect(names.some((n) => /Galaxy S25 Ultra/i.test(n))).toBe(true);
        // iPhone 17 Pro has 0 stock in inventory; should be excluded
        expect(names.some((n) => /iPhone 17 Pro/i.test(n))).toBe(false);

        const { meta } = res.body.data;
        expect(meta).toMatchObject({ currentPage: 1, totalProducts: expect.any(Number) });
    });

    // Filter: category (comma-separated) and brand combination
    test('filters by multiple categories and brands', async () => {
        // Smartphones and Laptops categories
        const catSmartphones = '6724b334a1a8c3a5e8a71b18';
        const catLaptops = '6724b334a1a8c3a5e8a71b17';
        const res = await request(app)
            .get('/api/storefront/search')
            .query({ category: `${catSmartphones},${catLaptops}`, brand: 'Apple,Samsung', limit: 50 })
            .expect(200);

        const allowedCats = new Set([catSmartphones, catLaptops]);
        expect(res.body.data.products.length).toBeGreaterThan(0);
        res.body.data.products.forEach((p) => {
            expect(allowedCats.has(p.categoryId.toString())).toBe(true);
            expect(['Apple', 'Samsung']).toContain(p.brand);
        });
    });

    // Filter: seller, minRating, price range
    test('filters by sellerId, minRating and price range together', async () => {
        const sellerId = '6724c444a1a8c3a5e8a71c02'; // Apple seller
        const res = await request(app)
            .get('/api/storefront/search')
            .query({ sellerId, minRating: 4.7, minPrice: 100000, maxPrice: 300000, limit: 50 })
            .expect(200);

        res.body.data.products.forEach((p) => {
            expect(p.sellerId.toString()).toBe(sellerId);
            expect(p.rating?.average ?? 0).toBeGreaterThanOrEqual(4.7);
            // price range enforced by pipeline
            expect(p.price.amount).toBeGreaterThanOrEqual(100000);
            expect(p.price.amount).toBeLessThanOrEqual(300000);
        });
    });

    // Dynamic variant option filters
    test('supports dynamic option filters (Size, Color etc.)', async () => {
        // T-Shirt: Color=Black, Size=M should match
        const res = await request(app)
            .get('/api/storefront/search')
            .query({ 'option_Color': 'Black', 'option_Size': 'M', limit: 50 })
            .expect(200);

        expect(res.body.data.products.length).toBeGreaterThan(0);
        res.body.data.products.forEach((p) => {
            expect(p.options.Color).toBe('Black');
            expect(p.options.Size).toBe('M');
            // stock must be > 0 per pipeline
            expect(p.stock).toBeGreaterThan(0);
        });
    });

    // Sorting by price ASC and DESC
    test('sort by price ascending', async () => {
        const res = await request(app)
            .get('/api/storefront/search')
            .query({ sortBy: 'price', sortOrder: 'asc', limit: 20 })
            .expect(200);
        const prices = res.body.data.products.map((p) => p.price.amount);
        const sorted = [...prices].sort((a, b) => a - b);
        expect(prices).toEqual(sorted);
    });

    test('sort by price descending', async () => {
        const res = await request(app)
            .get('/api/storefront/search')
            .query({ sortBy: 'price', sortOrder: 'desc', limit: 20 })
            .expect(200);
        const prices = res.body.data.products.map((p) => p.price.amount);
        const sorted = [...prices].sort((a, b) => b - a);
        expect(prices).toEqual(sorted);
    });

    // Pagination
    test('paginates with meta fields present', async () => {
        const res1 = await request(app).get('/api/storefront/search?limit=2&page=1').expect(200);
        const res2 = await request(app).get('/api/storefront/search?limit=2&page=2').expect(200);

        expect(res1.body.data.meta).toEqual(expect.objectContaining({ currentPage: 1, hasNextPage: true }));
        expect(res2.body.data.meta.currentPage).toBe(2);
        // Different pages should not be identical sets
        const ids1 = new Set(res1.body.data.products.map((p) => p._id.toString()));
        const ids2 = new Set(res2.body.data.products.map((p) => p._id.toString()));
        let overlap = false;
        ids1.forEach((id) => { if (ids2.has(id)) overlap = true; });
        expect(overlap).toBe(false);
    });

    test('page beyond last returns empty products with correct meta', async () => {
        const first = await request(app).get('/api/storefront/search?limit=5&page=1').expect(200);
        const total = first.body.data.meta.totalProducts;
        const totalPages = Math.ceil(total / 5) || 1;
        const beyond = await request(app).get(`/api/storefront/search?limit=5&page=${totalPages + 1}`).expect(200);
        expect(beyond.body.data.products.length).toBe(0);
        expect(beyond.body.data.meta.hasNextPage).toBe(false);
    });

    // Validation errors
    test('rejects invalid sellerId', async () => {
        const res = await request(app).get('/api/storefront/search?sellerId=bad-id').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects category with only invalid IDs', async () => {
        const res = await request(app).get('/api/storefront/search?category=bad1,bad2').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('accepts mixed category list and keeps only valid IDs', async () => {
        const res = await request(app)
            .get('/api/storefront/search?category=bad,6724b334a1a8c3a5e8a71b18,also-bad')
            .expect(200);
        expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    test('rejects invalid sortBy', async () => {
        const res = await request(app).get('/api/storefront/search?sortBy=popularity').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid sortOrder', async () => {
        const res = await request(app).get('/api/storefront/search?sortOrder=UP').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects minPrice > maxPrice', async () => {
        const res = await request(app).get('/api/storefront/search?minPrice=100&maxPrice=50').expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid dynamic option name/value', async () => {
        const res1 = await request(app).get('/api/storefront/search?option_-Bad=Value').expect(400);
        expect(res1.body.error.code).toBe('VALIDATION_ERROR');
        const res2 = await request(app).get('/api/storefront/search?option_Size=').expect(400);
        expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    });
});

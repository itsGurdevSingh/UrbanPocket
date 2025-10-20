import request from 'supertest';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import InventoryItem from '../../src/models/inventory.model.js';
import ProductVariant from '../../src/models/variant.model.js';
import Product from '../../src/models/product.model.js';
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
    const p = path.resolve(process.cwd(), 'tests', 'seed', file);
    const raw = fs.readFileSync(p, 'utf8');
    return reviveSpecials(JSON.parse(raw));
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

// ---------- Test Suite ----------
describe('GET /api/inventory-item/getAll - Get All Inventory Items', () => {
    beforeAll(async () => {
        // Wait for mongoose connection from global setup
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve) => mongoose.connection.once('open', resolve));
        }
    });

    beforeEach(async () => {
        await seedAll();
        // Set default auth role
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
    });

    // ==================== AUTHENTICATION & AUTHORIZATION ====================
    describe('Authentication & Authorization', () => {
        test('should return 200 for admin role', async () => {
            global.setTestAuthRole('admin');
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('should return 200 for seller role', async () => {
            global.setTestAuthRole('seller');
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('should return 200 for user role', async () => {
            global.setTestAuthRole('user');
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('should return 403 for customer role', async () => {
            global.setTestAuthRole('customer');
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(403);
        });
    });

    // ==================== BASIC FUNCTIONALITY ====================
    describe('Basic Functionality', () => {
        test('should return all inventory items with default pagination', async () => {
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.items).toBeDefined();
            expect(Array.isArray(res.body.data.items)).toBe(true);
            expect(res.body.data.items.length).toBeGreaterThan(0);
            expect(res.body.data.meta).toBeDefined();
            expect(res.body.data.meta.total).toBeGreaterThan(0);
            expect(res.body.data.meta.page).toBe(1);
            expect(res.body.data.meta.limit).toBe(10);
        });

        test('should include variant and product info in response', async () => {
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            const item = res.body.data.items[0];

            // Check inventory fields
            expect(item._id).toBeDefined();
            expect(item.variantId).toBeDefined();
            expect(item.stock).toBeDefined();
            expect(item.price).toBeDefined();

            // Check variant info
            expect(item.variant).toBeDefined();
            expect(item.variant._id).toBeDefined();
            expect(item.variant.sku).toBeDefined();
            expect(item.variant.options).toBeDefined();

            // Check product info
            expect(item.product).toBeDefined();
            expect(item.product._id).toBeDefined();
            expect(item.product.name).toBeDefined();
            expect(item.product.brand).toBeDefined();
        });

        test('should return empty array when no inventory items exist', async () => {
            await InventoryItem.deleteMany({});
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            expect(res.body.data.items).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });
    });

    // ==================== PAGINATION ====================
    describe('Pagination', () => {
        test('should paginate results with custom page and limit', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ page: 1, limit: 5 });

            expect(res.status).toBe(200);
            expect(res.body.data.items.length).toBeLessThanOrEqual(5);
            expect(res.body.data.meta.page).toBe(1);
            expect(res.body.data.meta.limit).toBe(5);
            expect(res.body.data.meta.totalPages).toBeGreaterThanOrEqual(1);
        });

        test('should return second page correctly', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ page: 2, limit: 5 });

            expect(res.status).toBe(200);
            expect(res.body.data.meta.page).toBe(2);
            if (res.body.data.meta.total > 5) {
                expect(res.body.data.meta.hasPrevPage).toBe(true);
            }
        });

        test('should reject invalid page number (0)', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ page: 0 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('should reject invalid limit (too high)', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ limit: 101 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ==================== FILTERING ====================
    describe('Filtering', () => {
        test('should filter by variantId', async () => {
            // Use a known variant ID from seed data
            const variantId = '6724d111a1a8c3a5e8a71d01';
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ variantId });

            expect(res.status).toBe(200);
            if (res.body.data.items.length > 0) {
                res.body.data.items.forEach(item => {
                    expect(item.variantId).toBe(variantId);
                });
            }
        });

        test('should filter by batchNumber (partial match)', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ batchNumber: 'BATCH-S25U' });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.batchNumber).toMatch(/BATCH-S25U/i);
            });
        });

        test('should filter by isActive=true', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ isActive: 'true' });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.isActive).toBe(true);
            });
        });

        test('should filter by inStock=true', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ inStock: 'true' });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.stock).toBeGreaterThan(0);
            });
        });

        test('should filter by minPrice', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ minPrice: 100000 });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.price.amount).toBeGreaterThanOrEqual(100000);
            });
        });

        test('should filter by maxPrice', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ maxPrice: 1000 });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.price.amount).toBeLessThanOrEqual(1000);
            });
        });

        test('should filter by price range (minPrice and maxPrice)', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ minPrice: 100000, maxPrice: 200000 });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.price.amount).toBeGreaterThanOrEqual(100000);
                expect(item.price.amount).toBeLessThanOrEqual(200000);
            });
        });

        test('should filter by productName (partial match)', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ productName: 'Galaxy' });

            expect(res.status).toBe(200);
            if (res.body.data.items.length > 0) {
                res.body.data.items.forEach(item => {
                    expect(item.product.name).toMatch(/Galaxy/i);
                });
            }
        });

        test('should filter by SKU', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ sku: 'S25U' });

            expect(res.status).toBe(200);
            if (res.body.data.items.length > 0) {
                res.body.data.items.forEach(item => {
                    expect(item.variant.sku).toMatch(/S25U/i);
                });
            }
        });

        test('should combine multiple filters', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({
                    isActive: 'true',
                    inStock: 'true',
                    minPrice: 10000
                });

            expect(res.status).toBe(200);
            res.body.data.items.forEach(item => {
                expect(item.isActive).toBe(true);
                expect(item.stock).toBeGreaterThan(0);
                expect(item.price.amount).toBeGreaterThanOrEqual(10000);
            });
        });
    });

    // ==================== SORTING ====================
    describe('Sorting', () => {
        test('should sort by price ascending', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ sortBy: 'price', sortOrder: 'asc' });

            expect(res.status).toBe(200);
            const prices = res.body.data.items.map(item => item.price.amount);
            for (let i = 1; i < prices.length; i++) {
                expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
            }
        });

        test('should sort by price descending', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ sortBy: 'price', sortOrder: 'desc' });

            expect(res.status).toBe(200);
            const prices = res.body.data.items.map(item => item.price.amount);
            for (let i = 1; i < prices.length; i++) {
                expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
            }
        });

        test('should sort by stock ascending', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ sortBy: 'stock', sortOrder: 'asc' });

            expect(res.status).toBe(200);
            const stocks = res.body.data.items.map(item => item.stock);
            for (let i = 1; i < stocks.length; i++) {
                expect(stocks[i]).toBeGreaterThanOrEqual(stocks[i - 1]);
            }
        });

        test('should sort by createdAt descending by default', async () => {
            const res = await request(app).get('/api/inventory-item/getAll');

            expect(res.status).toBe(200);
            const dates = res.body.data.items.map(item => new Date(item.createdAt).getTime());
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
            }
        });

        test('should reject invalid sortBy field', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ sortBy: 'invalidField' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ==================== VALIDATION ====================
    describe('Validation', () => {
        test('should reject invalid variantId', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ variantId: 'invalid-id' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('should reject negative minPrice', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ minPrice: -10 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ==================== EDGE CASES ====================
    describe('Edge Cases', () => {
        test('should handle query with no matching results', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ batchNumber: 'NON-EXISTENT-BATCH-XYZ' });

            expect(res.status).toBe(200);
            expect(res.body.data.items).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });

        test('should handle page beyond total pages', async () => {
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ page: 1000, limit: 10 });

            expect(res.status).toBe(200);
            expect(res.body.data.items).toEqual([]);
            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        test('should handle variantId with no inventory', async () => {
            const nonExistentVariantId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get('/api/inventory-item/getAll')
                .query({ variantId: nonExistentVariantId.toString() });

            expect(res.status).toBe(200);
            expect(res.body.data.items).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });
    });
});

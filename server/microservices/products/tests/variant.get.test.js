import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import productModel from '../src/models/product.model.js';
import variantModel from '../src/models/variant.model.js';

async function createProductForSeller(sellerId, overrides = {}) {
    const base = {
        name: `Product-${Math.random().toString(36).slice(2, 8)}`,
        description: 'Variant parent product',
        brand: 'BrandX',
        sellerId,
        categoryId: new mongoose.Types.ObjectId(),
        attributes: ['Color', 'Size'],
        baseImages: [
            { fileId: 'p-base-1', url: 'https://cdn.example.com/p-base-1.jpg', name: 'p1.jpg' }
        ],
        isActive: true,
    };
    return productModel.create({ ...base, ...overrides });
}

async function createVariant(productId, overrides = {}) {
    const base = {
        productId,
        sku: 'SKU-ONE',
        options: { Color: 'Red', Size: 'M' },
        price: { amount: 100, currency: 'INR' },
        stock: 5,
        baseUnit: 'unit',
        variantImages: [
            { url: 'https://cdn.example.com/variant-a.jpg', fileId: 'ik-old-a' },
        ],
        isActive: true
    };
    return variantModel.create({ ...base, ...overrides });
}

describe('GET /api/variant/:id and /api/variant/product/:productId', () => {
    test('get by id: success returns variant object', async () => {
        const sellerId = new mongoose.Types.ObjectId();
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        const res = await request(app).get(`/api/variant/${variant._id}`);
        expect(res.status).toBe(200);
        expect(res.body.variant).toBeDefined();
        expect(res.body.variant._id).toBe(String(variant._id));
    });

    test('get by id: invalid id returns 400 VALIDATION_ERROR', async () => {
        const res = await request(app).get(`/api/variant/not-a-valid-id`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('get by id: not found returns 404 VARIANT_NOT_FOUND', async () => {
        const res = await request(app).get(`/api/variant/${new mongoose.Types.ObjectId()}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('VARIANT_NOT_FOUND');
    });

    test('get by product id: success returns variants array', async () => {
        const sellerId = new mongoose.Types.ObjectId();
        const product = await createProductForSeller(sellerId);
        await createVariant(product._id, { sku: 'SKU-ONE' });
        await createVariant(product._id, { sku: 'SKU-TWO', options: { Color: 'Blue', Size: 'L' } });
        const res = await request(app).get(`/api/variant/product/${product._id}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.variants)).toBe(true);
        expect(res.body.variants.length).toBe(2);
    });

    test('get by product id: invalid id returns 400 VALIDATION_ERROR', async () => {
        const res = await request(app).get(`/api/variant/product/not-a-valid-id`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('get by product id: zero results returns empty array', async () => {
        const res = await request(app).get(`/api/variant/product/${new mongoose.Types.ObjectId()}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.variants)).toBe(true);
        expect(res.body.variants.length).toBe(0);
    });
});

import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import productModel from '../../src/models/product.model.js';
import variantModel from '../../src/models/variant.model.js';

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
        sku: 'SKU-ORIG',
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

describe('PATCH /api/variant/:id/disable and /enable', () => {
    let sellerId;
    beforeEach(async () => {
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
    });

    describe('disable', () => {
        test('success: seller owner disables variant', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const res = await request(app).patch(`/api/variant/${variant._id}/disable`);
            expect(res.status).toBe(200);
            expect(res.body.data.isActive).toBe(false);
        });

        test('success: admin disables variant', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            if (global.setTestAuthRole) global.setTestAuthRole('admin');
            const res = await request(app).patch(`/api/variant/${variant._id}/disable`);
            expect(res.status).toBe(200);
            expect(res.body.data.isActive).toBe(false);
        });

        test('idempotent: disabling already disabled returns 200 and remains false', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id, { isActive: false });
            const res = await request(app).patch(`/api/variant/${variant._id}/disable`);
            expect(res.status).toBe(200);
            expect(res.body.data.isActive).toBe(false);
        });

        test('error: seller not owner', async () => {
            const otherSeller = new mongoose.Types.ObjectId();
            const product = await createProductForSeller(otherSeller);
            const variant = await createVariant(product._id);
            const res = await request(app).patch(`/api/variant/${variant._id}/disable`);
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN_NOT_OWNER');
        });

        test('error: product inactive cannot disable variant', async () => {
            const product = await createProductForSeller(sellerId, { isActive: false });
            const variant = await createVariant(product._id);
            const res = await request(app).patch(`/api/variant/${variant._id}/disable`);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('PRODUCT_INACTIVE');
        });

        test('validation: invalid id', async () => {
            const res = await request(app).patch(`/api/variant/not-a-valid-id/disable`);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('enable', () => {
        test('success: seller owner enables variant', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id, { isActive: false });
            const res = await request(app).patch(`/api/variant/${variant._id}/enable`);
            expect(res.status).toBe(200);
            expect(res.body.data.isActive).toBe(true);
        });

        test('success: admin enables variant', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id, { isActive: false });
            if (global.setTestAuthRole) global.setTestAuthRole('admin');
            const res = await request(app).patch(`/api/variant/${variant._id}/enable`);
            expect(res.status).toBe(200);
            expect(res.body.data.isActive).toBe(true);
        });

        test('idempotent: enabling already enabled returns 200 and remains true', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id, { isActive: true });
            const res = await request(app).patch(`/api/variant/${variant._id}/enable`);
            expect(res.status).toBe(200);
            expect(res.body.data.isActive).toBe(true);
        });

        test('error: seller not owner', async () => {
            const otherSeller = new mongoose.Types.ObjectId();
            const product = await createProductForSeller(otherSeller);
            const variant = await createVariant(product._id, { isActive: false });
            const res = await request(app).patch(`/api/variant/${variant._id}/enable`);
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN_NOT_OWNER');
        });

        test('validation: invalid id', async () => {
            const res = await request(app).patch(`/api/variant/not-a-valid-id/enable`);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
});

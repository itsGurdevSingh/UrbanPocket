import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';

// Helper to create a product directly in DB
const createProduct = async (overrides = {}) => {
    const base = {
        name: `Activation Test Product ${Date.now()}-${Math.random()}`,
        description: 'Activation route test product',
        brand: 'BrandAct',
        sellerId: new mongoose.Types.ObjectId(),
        categoryId: new mongoose.Types.ObjectId(),
        attributes: ['attrA'],
        baseImages: [
            { fileId: 'file-a', url: 'https://cdn.example.com/a.jpg', name: 'a.jpg' },
        ],
        isActive: true,
    };
    return Product.create({ ...base, ...overrides });
};

describe('PATCH /api/product/:id/(disable|enable)', () => {
    let product;

    beforeEach(async () => {
        // default seller context
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        const sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
        product = await createProduct({ sellerId });
    });

    afterEach(async () => {
        await Product.deleteMany({});
    });

    // DISABLE tests
    test('seller disables own product successfully', async () => {
        const res = await request(app)
            .patch(`/api/product/${product._id}/disable`)
            .expect(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Product disabled successfully');
        const updated = await Product.findById(product._id);
        expect(updated.isActive).toBe(false);
    });

    test('seller cannot disable product they do not own', async () => {
        // change auth to another seller
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
        const res = await request(app)
            .patch(`/api/product/${product._id}/disable`)
            .expect(403);
        expect(res.body.error.code).toBe('UNAUTHORIZED_PRODUCT_DISABLE');
    });

    test('admin can disable any product', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const res = await request(app)
            .patch(`/api/product/${product._id}/disable`)
            .expect(200);
        expect(res.body.message).toBe('Product disabled successfully');
    });

    test('disable non-existent product returns 404', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .patch(`/api/product/${fakeId}/disable`)
            .expect(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    test('disable validation failure for invalid id', async () => {
        const res = await request(app)
            .patch('/api/product/not-valid-id/disable')
            .expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    // ENABLE tests
    test('seller enables own previously disabled product', async () => {
        // First disable directly (simulate already disabled state)
        product.isActive = false;
        await product.save();
        const res = await request(app)
            .patch(`/api/product/${product._id}/enable`)
            .expect(200);
        expect(res.body.message).toBe('Product enabled successfully');
        const updated = await Product.findById(product._id);
        expect(updated.isActive).toBe(true);
    });

    test('seller cannot enable product they do not own', async () => {
        product.isActive = false; await product.save();
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
        const res = await request(app)
            .patch(`/api/product/${product._id}/enable`)
            .expect(403);
        expect(res.body.error.code).toBe('UNAUTHORIZED_PRODUCT_ENABLE');
    });

    test('admin can enable any product', async () => {
        product.isActive = false; await product.save();
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const res = await request(app)
            .patch(`/api/product/${product._id}/enable`)
            .expect(200);
        expect(res.body.message).toBe('Product enabled successfully');
    });

    test('enable non-existent product returns 404', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .patch(`/api/product/${fakeId}/enable`)
            .expect(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    test('enable validation failure for invalid id', async () => {
        const res = await request(app)
            .patch('/api/product/not-valid-id/enable')
            .expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('enabling already active product still returns success', async () => {
        const res = await request(app)
            .patch(`/api/product/${product._id}/enable`)
            .expect(200);
        expect(res.body.message).toBe('Product enabled successfully');
    });
});

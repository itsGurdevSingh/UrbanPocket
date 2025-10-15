import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import productModel from '../src/models/product.model.js';
import variantModel from '../src/models/variant.model.js';

// Mock upload service to avoid real ImageKit interactions
jest.mock('../src/services/upload.service.js', () => ({
    __esModule: true,
    default: {
        uploadImagesToCloud: jest.fn(async (files) => files.map((f, idx) => ({
            fileId: `var-file-${Date.now()}-${idx}`,
            url: `https://cdn.example.com/variant-upd-${idx}.jpg`,
            altText: f.originalname || 'image.jpg'
        }))),
        executeWithUploadRollback: jest.fn(async (images, action) => action(images)),
        deleteImages: jest.fn(async () => true)
    }
}));

// Helper to create an image buffer
const createImageBuffer = (label = 'img') => Buffer.from(`fake-image-${label}`);

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
        variantImages: [{ url: 'https://cdn.example.com/variant-orig.jpg', fileId: 'file-orig' }],
        isActive: true
    };
    return variantModel.create({ ...base, ...overrides });
}

function putVariant(id, data, files = []) {
    const req = request(app).put(`/api/variant/${id}`);
    files.forEach(label => {
        req.attach('images', createImageBuffer(label), `${label}.jpg`);
    });
    Object.entries(data || {}).forEach(([k, v]) => {
        if (typeof v === 'object') req.field(k, JSON.stringify(v));
        else if (v !== undefined) req.field(k, String(v));
    });
    return req;
}

describe('PUT /api/variant/:id - update variant', () => {
    let sellerId;
    beforeEach(async () => {
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
    });

    test('success: update price and add image (keeps existing)', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);

        const res = await putVariant(variant._id, { price: { amount: 150 } }, ['new']);
        expect(res.status).toBe(200);
        expect(res.body.data.price.amount).toBe(150);
        expect(res.body.data.variantImages.length).toBe(2);
    });

    test('success: admin updates currency (auto uppercase)', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        if (global.setTestAuthRole) global.setTestAuthRole('admin');

        const res = await putVariant(variant._id, { price: { currency: 'usd' } });
        expect(res.status).toBe(200);
        expect(res.body.data.price.currency).toBe('USD');
    });

    test('error: seller not owner of product', async () => {
        const otherSeller = new mongoose.Types.ObjectId();
        const product = await createProductForSeller(otherSeller);
        const variant = await createVariant(product._id);

        const res = await putVariant(variant._id, { price: { amount: 120 } });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_NOT_OWNER');
    });

    test('error: product inactive cannot update', async () => {
        const product = await createProductForSeller(sellerId, { isActive: false });
        const variant = await createVariant(product._id);

        const res = await putVariant(variant._id, { price: { amount: 120 } });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('PRODUCT_INACTIVE');
    });

    test('error: duplicate SKU within product on update', async () => {
        const product = await createProductForSeller(sellerId);
        const v1 = await createVariant(product._id, { sku: 'SKU-1' });
        const v2 = await createVariant(product._id, { sku: 'SKU-2', options: { Color: 'Blue', Size: 'L' } });

        const res = await putVariant(v2._id, { sku: 'SKU-1' });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('DUPLICATE_VARIANT_SKU');
    });

    test('validation: bad id format', async () => {
        const res = await putVariant('bad-id', { price: { amount: 120 } });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('validation: negative price rejected', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        const res = await putVariant(variant._id, { price: { amount: -10 } });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('validation: options must be object', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        const res = await putVariant(variant._id, { options: [] });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('error: cannot remove all images (no files and no variantImages, existing still present -> allowed)', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        const res = await putVariant(variant._id, { price: { amount: 130 } });
        expect(res.status).toBe(200);
        expect(res.body.data.variantImages.length).toBeGreaterThan(0);
    });

    test('error: no images at all if starting variant had none and none provided', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id, { variantImages: [] });
        const res = await putVariant(variant._id, { price: { amount: 130 } });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('NO_IMAGES');
    });
});

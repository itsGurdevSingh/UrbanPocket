import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import productModel from '../src/models/product.model.js';

// Mock upload service similar to product tests
jest.mock('../src/services/upload.service.js', () => ({
    __esModule: true,
    default: {
        uploadImagesToCloud: jest.fn(async (files) => files.map((f, idx) => ({
            fileId: `var-file-${Date.now()}-${idx}`,
            url: `https://cdn.example.com/variant-${idx}.jpg`,
            altText: f.originalname || 'image.jpg'
        }))),
        executeWithUploadRollback: jest.fn(async (images, action) => action(images)),
        deleteImages: jest.fn(async () => true)
    }
}));

// --- Test auth harness ----------------------------------------------------
// We simulate the authentication middleware by providing global hooks set by existing product tests infrastructure.
// Assuming global.setTestAuthRole & global.setTestAuthUserId are available (same pattern as product tests).

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

// Helper to perform variant create request (multipart)
function postVariant(data, files = ['v1']) {
    const req = request(app).post('/api/variant/create');
    files.forEach(label => {
        req.attach('images', createImageBuffer(label), `${label}.jpg`);
    });
    Object.entries(data).forEach(([k, v]) => {
        if (typeof v === 'object') {
            req.field(k, JSON.stringify(v));
        } else if (v !== undefined) {
            req.field(k, String(v));
        }
    });
    return req;
}

describe('POST /api/variant/create - create variant', () => {
    let sellerId;
    beforeEach(async () => {
        // Establish authenticated seller by default
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
    });

    test('success: seller creates variant for owned active product (default INR)', async () => {
        const product = await createProductForSeller(sellerId);
        const res = await postVariant({
            productId: product._id.toString(),
            options: { Color: 'Red', Size: 'M' },
            price: 499.5,
            stock: 10,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(201);
        expect(res.body.variant).toBeDefined();
        expect(res.body.variant.productId).toBe(String(product._id));
        expect(res.body.variant.currency).toBe('INR');
        expect(res.body.variant.variantImages.length).toBe(1);
    });

    test('success: admin creates variant with custom lowercase currency (auto uppercase)', async () => {
        const product = await createProductForSeller(sellerId);
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const res = await postVariant({
            productId: product._id.toString(),
            options: { Color: 'Blue', Size: 'L' },
            price: 899.99,
            currency: 'usd',
            stock: 5,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(201);
        expect(res.body.variant.currency).toBe('USD');
    });

    test('error: unauthorized seller creating variant for product they do not own', async () => {
        const otherSeller = new mongoose.Types.ObjectId();
        const product = await createProductForSeller(otherSeller);
        const res = await postVariant({
            productId: product._id.toString(),
            options: { Color: 'Green', Size: 'S' },
            price: 100,
            stock: 2,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_NOT_OWNER');
    });

    test('error: inactive product', async () => {
        const product = await createProductForSeller(sellerId, { isActive: false });
        const res = await postVariant({
            productId: product._id.toString(),
            options: { Color: 'Black', Size: 'L' },
            price: 150,
            stock: 1,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PRODUCT_INACTIVE');
    });

    test('error: duplicate SKU within product', async () => {
        const product = await createProductForSeller(sellerId);
        // First variant
        await postVariant({
            productId: product._id.toString(),
            sku: 'SKU-RED-M',
            options: { Color: 'Red', Size: 'M' },
            price: 200,
            stock: 3,
            baseUnit: 'unit'
        });
        // Second with same SKU
        const res = await postVariant({
            productId: product._id.toString(),
            sku: 'SKU-RED-M',
            options: { Color: 'Red', Size: 'L' },
            price: 210,
            stock: 2,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DUPLICATE_VARIANT_SKU');
    });

    test('validation: invalid productId', async () => {
        const res = await postVariant({
            productId: 'bad-id',
            options: { Color: 'Red', Size: 'M' },
            price: 100,
            stock: 2,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('validation: negative price', async () => {
        const product = await createProductForSeller(sellerId);
        const res = await postVariant({
            productId: product._id.toString(),
            options: { Color: 'Red', Size: 'M' },
            price: -10,
            stock: 2,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('validation: missing images (no files, no variantImages array)', async () => {
        const product = await createProductForSeller(sellerId);
        // send request without attaching images
        const req = request(app).post('/api/variant/create');
        const res = await req
            .field('productId', product._id.toString())
            .field('options', JSON.stringify({ Color: 'Red', Size: 'M' }))
            .field('price', '100')
            .field('stock', '2')
            .field('baseUnit', 'unit');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('NO_IMAGES');
    });

    test('validation: options not object', async () => {
        const product = await createProductForSeller(sellerId);
        const req = request(app).post('/api/variant/create');
        const res = await req
            .attach('images', createImageBuffer('one'), 'one.jpg')
            .field('productId', product._id.toString())
            .field('options', '[]') // array instead of object
            .field('price', '100')
            .field('stock', '2')
            .field('baseUnit', 'unit');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('validation: bad currency code', async () => {
        const product = await createProductForSeller(sellerId);
        const res = await postVariant({
            productId: product._id.toString(),
            options: { Color: 'Red', Size: 'M' },
            price: 100,
            currency: 'RUPEE',
            stock: 2,
            baseUnit: 'unit'
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});

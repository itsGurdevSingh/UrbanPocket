import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import productModel from '../src/models/product.model.js';
import variantModel from '../src/models/variant.model.js';

// Mock upload service to avoid real ImageKit
jest.mock('../src/services/upload.service.js', () => ({
    __esModule: true,
    default: {
        uploadImagesToCloud: jest.fn(async (files) => files.map((f, idx) => ({
            fileId: `ik-file-${Date.now()}-${idx}`,
            url: `https://cdn.example.com/ik-updated-${idx}.jpg`,
            altText: f.originalname || 'image.jpg'
        }))),
        executeWithUploadRollback: jest.fn(async (images, action) => action(images)),
        deleteImages: jest.fn(async () => true)
    }
}));

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
        price: 100,
        currency: 'INR',
        stock: 5,
        baseUnit: 'unit',
        variantImages: [
            { url: 'https://cdn.example.com/variant-a.jpg', fileId: 'ik-old-a' },
            { url: 'https://cdn.example.com/variant-b.jpg', fileId: 'ik-old-b' },
        ],
        isActive: true
    };
    return variantModel.create({ ...base, ...overrides });
}

function putVariantImage(variantId, fileId, imgLabel = 'new') {
    return request(app)
        .put(`/api/variant/${variantId}/${fileId}`)
        .attach('image', createImageBuffer(imgLabel), `${imgLabel}.jpg`);
}

describe('PUT /api/variant/:id/:fileId - update a single variant image', () => {
    let sellerId;
    beforeEach(async () => {
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
    });

    test('success: replace specific image and return updated image object', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);

        const res = await putVariantImage(variant._id, 'ik-old-b', 'repl');
        expect(res.status).toBe(200);
        expect(res.body.updatedImage).toBeDefined();
        expect(res.body.updatedImage.fileId).toContain('ik-file-');
        expect(res.body.updatedImage.url).toContain('ik-updated-');
    });

    test('error: missing file returns 400 NO_FILE', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        const res = await request(app).put(`/api/variant/${variant._id}/ik-old-a`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('NO_FILE');
    });

    test('error: variant image not found (bad fileId)', async () => {
        const product = await createProductForSeller(sellerId);
        const variant = await createVariant(product._id);
        const res = await putVariantImage(variant._id, 'non-exist', 'new');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('VARIANT_IMAGE_NOT_FOUND');
    });

    test('error: product inactive', async () => {
        const product = await createProductForSeller(sellerId, { isActive: false });
        const variant = await createVariant(product._id);
        const res = await putVariantImage(variant._id, 'ik-old-a', 'new');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PRODUCT_INACTIVE');
    });

    test('error: seller not owner', async () => {
        const otherSeller = new mongoose.Types.ObjectId();
        const product = await createProductForSeller(otherSeller);
        const variant = await createVariant(product._id);
        const res = await putVariantImage(variant._id, 'ik-old-a', 'new');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_NOT_OWNER');
    });

    test('validation: invalid variant id or fileId', async () => {
        const res1 = await request(app)
            .put(`/api/variant/bad-id/ik-old-a`)
            .attach('image', createImageBuffer('x'), 'x.jpg');
        expect(res1.status).toBe(400);
        expect(res1.body.code).toBe('VALIDATION_ERROR');

        const sellerId2 = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId2.toString());
    });
});

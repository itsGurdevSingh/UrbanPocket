import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import uploadService from '../src/services/upload.service.js';

// Mock upload service uploadProductImages to control responses and avoid real external calls
jest.mock('../src/services/upload.service.js', () => ({
    __esModule: true,
    default: {
        uploadProductImages: jest.fn(async (files) => files.map((f, idx) => ({
            fileId: `new-file-${Date.now()}-${idx}`,
            url: `https://cdn.example.com/new-file-${idx}.jpg`,
            name: f.originalname || 'image.jpg'
        }))),
        deleteImages: jest.fn(async () => true),
    }
}));

const createImageBuffer = (label = 'img') => Buffer.from(`fake-image-${label}`);

const createProduct = async (overrides = {}) => {
    const base = {
        name: 'Test Product',
        description: 'A product for testing',
        brand: 'BrandX',
        sellerId: new mongoose.Types.ObjectId(),
        categoryId: new mongoose.Types.ObjectId(),
        attributes: ['attr1'],
        baseImages: [
            { fileId: 'old-file-1', url: 'https://cdn.example.com/old1.jpg', name: 'old1.jpg' },
            { fileId: 'old-file-2', url: 'https://cdn.example.com/old2.jpg', name: 'old2.jpg' },
        ],
    };
    return Product.create({ ...base, ...overrides });
};

describe('PUT /api/product/:id/:fileId/ - update single product image', () => {
    let product;
    beforeEach(async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        // create a consistent ObjectId for the seller and set mock user id to that
        const sellerObjectId = new mongoose.Types.ObjectId();
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerObjectId.toString());
        product = await createProduct({ sellerId: sellerObjectId });
    });

    test('success: replaces image for owning seller (returns only updated image)', async () => {
        const targetFileId = product.baseImages[0].fileId;
        const res = await request(app)
            .put(`/api/product/${product._id}/${targetFileId}/`)
            .attach('image', createImageBuffer('new1'), 'new1.jpg');
        expect(res.status).toBe(200);
        // API now returns the updated image object in product field
        expect(res.body.product).toBeDefined();
        expect(res.body.product.fileId).toBeDefined();
        expect(res.body.product.fileId).not.toBe(targetFileId);
        expect(res.body.product.url).toMatch(/^https:\/\//);
    });

    test('success: admin can replace image of any product (returns updated image only)', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const targetFileId = product.baseImages[1].fileId;
        const res = await request(app)
            .put(`/api/product/${product._id}/${targetFileId}/`)
            .attach('image', createImageBuffer('admin'), 'admin.jpg');
        expect(res.status).toBe(200);
        expect(res.body.product).toBeDefined();
        expect(res.body.product.fileId).not.toBe(targetFileId);
    });

    test('validation: invalid product id', async () => {
        const res = await request(app)
            .put(`/api/product/123/${product.baseImages[0].fileId}/`)
            .attach('image', createImageBuffer(), 'file.jpg');
        expect(res.status).toBe(400); // validation error
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('not found: product does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/product/${fakeId}/${product.baseImages[0].fileId}/`)
            .attach('image', createImageBuffer(), 'file.jpg');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
    });

    test('not found: image fileId not in product', async () => {
        const res = await request(app)
            .put(`/api/product/${product._id}/missing-file-id/`)
            .attach('image', createImageBuffer(), 'file.jpg');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('PRODUCT_IMAGE_NOT_FOUND');
    });

    test('unauthorized: seller not owner', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        // set mock user id to a different seller id to trigger unauthorized
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
        const res = await request(app)
            .put(`/api/product/${product._id}/${product.baseImages[0].fileId}/`)
            .attach('image', createImageBuffer(), 'file.jpg');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('UNAUTHORIZED_PRODUCT_UPDATE');
    });

    test('validation: missing file upload', async () => {
        const res = await request(app)
            .put(`/api/product/${product._id}/${product.baseImages[0].fileId}/`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('upload failure: simulate upload service error', async () => {
        // force upload to throw
        uploadService.uploadProductImages.mockImplementationOnce(async () => { throw new Error('upload fail'); });
        const res = await request(app)
            .put(`/api/product/${product._id}/${product.baseImages[0].fileId}/`)
            .attach('image', createImageBuffer(), 'file.jpg');
        expect(res.status).toBe(500);
        expect(res.body.code).toBe('UPDATE_PRODUCT_IMAGE_FAILED');
    });
});

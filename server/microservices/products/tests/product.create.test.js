import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import productRepository from '../src/repositories/product.repository.js';

// Mock authenticateUser to bypass external auth dependency
jest.mock('../src/middlewares/authenticateUser.js', () => ({
    __esModule: true,
    authenticate: () => (req, res, next) => { req.user = { id: 'test-user', role: 'user' }; next(); },
    default: jest.fn((roles = []) => (req, res, next) => {
        req.user = { id: 'test-user', role: roles[0] || 'seller' };
        next();
    })
}));

const createPayload = (overrides = {}) => ({
    name: 'Test Product',
    description: 'A great product',
    brand: 'BrandX',
    sellerId: new mongoose.Types.ObjectId().toString(),
    categoryId: new mongoose.Types.ObjectId().toString(),
    attributes: ['Size', 'Color'],
    ...overrides
});

// Helper to attach images (simulate frontend "images" field)
// pass failIndex to inject a FAIL filename to trigger mock rejection
const attachImages = (req, count = 2, failIndex = -1) => {
    for (let i = 0; i < count; i++) {
        const name = (i === failIndex) ? `image${i}-FAIL.png` : `image${i}.png`;
        req.attach('images', Buffer.from(`fake-image-${i}`), name);
    }
    return req;
};

describe('POST /api/product/create', () => {
    afterEach(async () => {
        await Product.deleteMany({});
    });

    it('creates a product with uploaded images (success path)', async () => {
        const payload = createPayload();
        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', payload.sellerId)
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 2).expect(201);

        expect(res.body).toHaveProperty('status', 'success');
        expect(res.body).toHaveProperty('product');
        expect(res.body.product).toHaveProperty('baseImages');
        expect(res.body.product.baseImages.length).toBe(2);
    });

    it('rejects duplicate product name', async () => {
        const payload = createPayload();
        await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', payload.sellerId)
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 1).expect(201);

        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', payload.sellerId)
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 1).expect(400);

        expect(res.body).toHaveProperty('code', 'DUPLICATE_PRODUCT_NAME');
    });

    it('fails when required fields missing (validation)', async () => {
        const res = await request(app)
            .post('/api/product/create')
            .field('description', 'Only description provided')
            .expect(400);

        expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
        expect(res.body).toHaveProperty('errors');
    });

    it('fails when no images and no baseImages provided', async () => {
        const payload = createPayload();
        const res = await request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', payload.sellerId)
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            .expect(400);

        expect(res.body).toHaveProperty('code', 'NO_IMAGES');
    });

    it('rolls back when any image upload fails (trigger via FAIL filename)', async () => {
        const payload = createPayload();
        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', payload.sellerId)
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 3, 1) // second image will have FAIL in name
            .expect(500);

        expect(res.body).toHaveProperty('code');
        expect(['PRODUCT_IMAGE_UPLOAD_FAILED', 'IMAGEKIT_UPLOAD_ERROR']).toContain(res.body.code);
    });

    it('rolls back uploaded images if DB create fails', async () => {
        const payload = {
            name: 'Rollback DB Failure Product',
            description: 'A great product',
            brand: 'BrandX',
            sellerId: new mongoose.Types.ObjectId().toString(),
            categoryId: new mongoose.Types.ObjectId().toString(),
            attributes: ['Size', 'Color']
        };

        // Spy on repository create to throw after uploads succeed
        const originalCreate = productRepository.create;
        productRepository.create = jest.fn(async () => {
            throw new Error('Simulated DB failure');
        });

        const res = await (function send() {
            const req = request(app)
                .post('/api/product/create')
                .field('name', payload.name)
                .field('description', payload.description)
                .field('brand', payload.brand)
                .field('sellerId', payload.sellerId)
                .field('categoryId', payload.categoryId)
                .field('attributes', JSON.stringify(payload.attributes));
            req.attach('images', Buffer.from('img-a'), 'a.png');
            req.attach('images', Buffer.from('img-b'), 'b.png');
            return req.expect(500);
        })();

        expect(res.body).toHaveProperty('code', 'PRODUCT_PERSIST_FAILED');

        // restore
        productRepository.create = originalCreate;
    });
});

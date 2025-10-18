import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import Product from '../../src/models/product.model.js';
import productRepository from '../../src/repositories/product.repository.js';

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
    beforeEach(() => {
        // Ensure role appropriate for creation (seller) and provide valid ObjectId for seller override
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(new mongoose.Types.ObjectId().toString());
    });
    afterEach(async () => {
        await Product.deleteMany({});
    });

    it('creates a product with uploaded images (seller ownership enforced)', async () => {
        // Auth mock set seller role in beforeEach; override user id to known value
        const authSellerId = new mongoose.Types.ObjectId().toString();
        if (global.setTestAuthUserId) global.setTestAuthUserId(authSellerId);
        const payload = createPayload({ sellerId: new mongoose.Types.ObjectId().toString() }); // will be ignored
        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', payload.sellerId) // should be overridden
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 2).expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('sellerId');
        expect(res.body.data.sellerId).toBe(authSellerId); // enforced ownership
        expect(res.body.data.baseImages.length).toBe(2);
    });

    it('rejects duplicate product name for the same seller', async () => {
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

        expect(res.body.error.code).toBe('DUPLICATE_PRODUCT_NAME');
    });

    it('allows same product name for different sellers', async () => {
        // as admin we can set seller ids
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const commonName = 'SameName';
        const sellerA = new mongoose.Types.ObjectId().toString();
        const sellerB = new mongoose.Types.ObjectId().toString();

        // create for seller A
        await attachImages(request(app)
            .post('/api/product/create')
            .field('name', commonName)
            .field('description', 'valid desc')
            .field('brand', 'BrandX')
            .field('sellerId', sellerA)
            .field('categoryId', new mongoose.Types.ObjectId().toString())
            .field('attributes', JSON.stringify(['Size']))
            , 1).expect(201);

        // create for seller B with same name
        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', commonName)
            .field('description', 'another valid desc')
            .field('brand', 'BrandY')
            .field('sellerId', sellerB)
            .field('categoryId', new mongoose.Types.ObjectId().toString())
            .field('attributes', JSON.stringify(['Size']))
            , 1).expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe(commonName);
        expect(res.body.data.sellerId).toBe(sellerB);
    });

    it('fails when required fields missing (validation)', async () => {
        const res = await request(app)
            .post('/api/product/create')
            .field('description', 'Only description provided')
            .expect(400);

        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body).toHaveProperty('error.details');
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

        expect(res.body.error.code).toBe('NO_IMAGES');
    });

    it('admin creation requires sellerId (missing -> error)', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const payload = createPayload();
        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            // intentionally omit sellerId
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 1).expect(400);
        expect(res.body.error.code).toBe('SELLER_ID_REQUIRED');
    });

    it('admin can create product for specified sellerId', async () => {
        if (global.setTestAuthRole) global.setTestAuthRole('admin');
        const sellerForProduct = new mongoose.Types.ObjectId().toString();
        const payload = createPayload({ sellerId: sellerForProduct });
        const res = await attachImages(request(app)
            .post('/api/product/create')
            .field('name', payload.name)
            .field('description', payload.description)
            .field('brand', payload.brand)
            .field('sellerId', sellerForProduct)
            .field('categoryId', payload.categoryId)
            .field('attributes', JSON.stringify(payload.attributes))
            , 1).expect(201);
        expect(res.body.data.sellerId).toBe(sellerForProduct);
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

        expect(['PRODUCT_IMAGE_UPLOAD_FAILED', 'IMAGEKIT_UPLOAD_ERROR']).toContain(res.body.error.code);
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

        expect(res.body.error.code).toBe('PRODUCT_PERSIST_FAILED');

        // restore
        productRepository.create = originalCreate;
    });
});

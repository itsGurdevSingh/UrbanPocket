import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import InventoryItem from '../../src/models/inventory.model.js';
import ProductVariant from '../../src/models/variant.model.js';
import Product from '../../src/models/product.model.js';

// Helper to create test product
async function createTestProduct(sellerId) {
    return Product.create({
        name: `Product-${Math.random().toString(36).slice(2, 8)}`,
        description: 'Test product for inventory',
        brand: 'TestBrand',
        sellerId,
        categoryId: new mongoose.Types.ObjectId(),
        attributes: ['Color', 'Size'],
        baseImages: [
            { fileId: 'img-1', url: 'https://cdn.example.com/img1.jpg', name: 'img1.jpg' }
        ],
        isActive: true,
    });
}

// Helper to create test variant
async function createTestVariant(productId, overrides = {}) {
    return ProductVariant.create({
        productId,
        sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
        options: { Color: 'Red', Size: 'M' },
        price: { amount: 500, currency: 'INR' },
        stock: 10,
        baseUnit: 'kg',
        variantImages: [
            { fileId: 'var-img-1', url: 'https://cdn.example.com/var1.jpg', name: 'var1.jpg' }
        ],
        isActive: true,
        ...overrides
    });
}

// Helper to create valid inventory payload
const createInventoryPayload = (variantId, overrides = {}) => ({
    variantId: variantId.toString(),
    batchNumber: `BATCH-${Date.now()}`,
    stock: 100,
    price: {
        amount: 120.5,
        currency: 'INR'
    },
    manufacturingDetails: {
        mfgDate: '2024-01-01',
        expDate: '2025-01-01'
    },
    hsnCode: '310210',
    gstPercentage: 18,
    isActive: true,
    ...overrides
});

describe('POST /api/inventory-item/create - Create Inventory Item', () => {
    let sellerId;
    let product;
    let variant;

    beforeEach(async () => {
        // Setup authenticated seller
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());

        // Create test product and variant
        product = await createTestProduct(sellerId);
        variant = await createTestVariant(product._id);
    });

    afterEach(async () => {
        await InventoryItem.deleteMany({});
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
    });

    describe('Success Cases', () => {
        test('seller creates inventory item with all fields', async () => {
            const payload = createInventoryPayload(variant._id);

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Inventory item created successfully');
            expect(res.body.data).toMatchObject({
                variantId: variant._id.toString(),
                batchNumber: payload.batchNumber,
                stock: 100,
                hsnCode: '310210',
                gstPercentage: 18,
                isActive: true
            });
            expect(res.body.data.price.amount).toBe(120.5);
            expect(res.body.data.price.currency).toBe('INR');
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        test('admin creates inventory item', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const payload = createInventoryPayload(variant._id);

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.variantId).toBe(variant._id.toString());
        });

        test('creates inventory with minimal required fields', async () => {
            const payload = {
                variantId: variant._id.toString(),
                stock: 50,
                price: {
                    amount: 100,
                    currency: 'INR'
                }
            };

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(50);
            expect(res.body.data.price.amount).toBe(100);
            // Check defaults
            expect(res.body.data.gstPercentage).toBe(18);
            expect(res.body.data.isActive).toBe(true);
        });

        test('creates inventory with zero stock', async () => {
            const payload = createInventoryPayload(variant._id, { stock: 0 });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(0);
        });

        test('creates inventory without optional batchNumber', async () => {
            const payload = createInventoryPayload(variant._id);
            delete payload.batchNumber;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data).not.toHaveProperty('batchNumber');
        });

        test('creates inventory without manufacturing details', async () => {
            const payload = createInventoryPayload(variant._id);
            delete payload.manufacturingDetails;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
        });

        test('creates inventory with different currency codes', async () => {
            const currencies = ['INR', 'USD', 'EUR', 'GBP'];

            for (const currency of currencies) {
                const newVariant = await createTestVariant(product._id);
                const payload = createInventoryPayload(newVariant._id, {
                    batchNumber: `BATCH-${currency}-${Date.now()}`,
                    price: { amount: 100, currency }
                });

                const res = await request(app)
                    .post('/api/inventory-item/create')
                    .send(payload)
                    .expect(201);

                expect(res.body.data.price.currency).toBe(currency);
            }
        });

        test('creates multiple inventory items for same variant with different batches', async () => {
            const payload1 = createInventoryPayload(variant._id, { batchNumber: 'BATCH-001' });
            const payload2 = createInventoryPayload(variant._id, { batchNumber: 'BATCH-002' });

            const res1 = await request(app)
                .post('/api/inventory-item/create')
                .send(payload1)
                .expect(201);

            const res2 = await request(app)
                .post('/api/inventory-item/create')
                .send(payload2)
                .expect(201);

            expect(res1.body.data.batchNumber).toBe('BATCH-001');
            expect(res2.body.data.batchNumber).toBe('BATCH-002');
        });
    });

    describe('Validation Errors', () => {
        test('fails when variantId is missing', async () => {
            const payload = createInventoryPayload(variant._id);
            delete payload.variantId;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'variantId',
                        message: 'variantId is required'
                    })
                ])
            );
        });

        test('fails when variantId is invalid ObjectId', async () => {
            const payload = createInventoryPayload(variant._id, { variantId: 'invalid-id' });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'variantId',
                        message: 'variantId must be a valid Mongo ID'
                    })
                ])
            );
        });

        test('fails when stock is missing', async () => {
            const payload = createInventoryPayload(variant._id);
            delete payload.stock;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'stock',
                        message: 'stock is required'
                    })
                ])
            );
        });

        test('fails when stock is negative', async () => {
            const payload = createInventoryPayload(variant._id, { stock: -10 });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'stock',
                        message: 'stock must be a non-negative number'
                    })
                ])
            );
        });

        test('fails when price.amount is missing', async () => {
            const payload = createInventoryPayload(variant._id);
            delete payload.price.amount;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'price.amount',
                        message: 'price.amount is required'
                    })
                ])
            );
        });

        test('fails when price.amount is negative', async () => {
            const payload = createInventoryPayload(variant._id);
            payload.price.amount = -50;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'price.amount',
                        message: 'price.amount must be a non-negative number'
                    })
                ])
            );
        });

        test('fails when price.currency is missing', async () => {
            const payload = createInventoryPayload(variant._id);
            delete payload.price.currency;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'price.currency',
                        message: 'price.currency is required'
                    })
                ])
            );
        });

        test('fails when currency code is not 3 letters', async () => {
            const payload = createInventoryPayload(variant._id);
            payload.price.currency = 'IN';

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'price.currency',
                        message: 'price.currency must be a 3-letter currency code'
                    })
                ])
            );
        });

        test('fails when gstPercentage is greater than 100', async () => {
            const payload = createInventoryPayload(variant._id, { gstPercentage: 150 });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'gstPercentage',
                        message: 'gstPercentage must be between 0 and 100'
                    })
                ])
            );
        });

        test('fails when gstPercentage is negative', async () => {
            const payload = createInventoryPayload(variant._id, { gstPercentage: -5 });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('fails when batchNumber exceeds max length', async () => {
            const payload = createInventoryPayload(variant._id, {
                batchNumber: 'A'.repeat(101)
            });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'batchNumber',
                        message: 'batchNumber must be at most 100 characters'
                    })
                ])
            );
        });

        test('fails when hsnCode exceeds max length', async () => {
            const payload = createInventoryPayload(variant._id, {
                hsnCode: '1'.repeat(21)
            });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'hsnCode',
                        message: 'hsnCode must be at most 20 characters'
                    })
                ])
            );
        });

        test('fails when manufacturingDetails.mfgDate is invalid', async () => {
            const payload = createInventoryPayload(variant._id);
            payload.manufacturingDetails.mfgDate = 'invalid-date';

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'manufacturingDetails.mfgDate',
                        message: 'manufacturingDetails.mfgDate must be a valid date'
                    })
                ])
            );
        });

        test('fails when manufacturingDetails.expDate is invalid', async () => {
            const payload = createInventoryPayload(variant._id);
            payload.manufacturingDetails.expDate = 'not-a-date';

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'manufacturingDetails.expDate',
                        message: 'manufacturingDetails.expDate must be a valid date'
                    })
                ])
            );
        });
    });

    describe('Business Logic Errors', () => {
        test('fails when variant does not exist', async () => {
            const nonExistentVariantId = new mongoose.Types.ObjectId();
            const payload = createInventoryPayload(nonExistentVariantId);

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(404);

            expect(res.body.error.code).toBe('VARIANT_NOT_FOUND');
            expect(res.body.error.message).toBe('Variant not found');
        });

        test('fails when duplicate batch for same variant', async () => {
            const payload = createInventoryPayload(variant._id, { batchNumber: 'BATCH-UNIQUE' });

            // Create first inventory item
            await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            // Try to create duplicate
            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(409);

            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBe('DB_DUPLICATE');
        });
    });

    describe('Authorization Tests', () => {
        test('fails when user is not authenticated', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const payload = createInventoryPayload(variant._id);

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(403);

            expect(res.body.code).toBe('FORBIDDEN_ROLE');
        });

        test('fails when role is customer', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const payload = createInventoryPayload(variant._id);

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(403);

            expect(res.body.code).toBe('FORBIDDEN_ROLE');
        });
    });

    describe('Edge Cases', () => {
        test('creates inventory with very large stock', async () => {
            const payload = createInventoryPayload(variant._id, {
                stock: 999999999
            });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.stock).toBe(999999999);
        });

        test('creates inventory with very small price', async () => {
            const payload = createInventoryPayload(variant._id);
            payload.price.amount = 0.01;

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.price.amount).toBe(0.01);
        });

        test('creates inventory with decimal stock value', async () => {
            const payload = createInventoryPayload(variant._id, {
                stock: 45.75
            });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.stock).toBe(45.75);
        });

        test('creates inventory with isActive false', async () => {
            const payload = createInventoryPayload(variant._id, { isActive: false });

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.data.isActive).toBe(false);
        });

        test('creates inventory with future manufacturing date', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const payload = createInventoryPayload(variant._id);
            payload.manufacturingDetails.mfgDate = futureDate.toISOString().split('T')[0];

            const res = await request(app)
                .post('/api/inventory-item/create')
                .send(payload)
                .expect(201);

            expect(res.body.success).toBe(true);
        });
    });
});

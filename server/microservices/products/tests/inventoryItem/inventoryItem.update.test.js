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

// Helper to create test inventory item
async function createTestInventoryItem(variantId, overrides = {}) {
    return InventoryItem.create({
        variantId,
        batchNumber: `BATCH-${Date.now()}`,
        stock: 100,
        price: {
            amount: 120.5,
            currency: 'INR'
        },
        manufacturingDetails: {
            mfgDate: new Date('2024-01-01'),
            expDate: new Date('2025-01-01')
        },
        hsnCode: '310210',
        gstPercentage: 18,
        isActive: true,
        ...overrides
    });
}

describe('PUT /api/inventory-item/:id - Update Inventory Item', () => {
    let sellerId;
    let product;
    let variant;
    let inventoryItem;

    beforeEach(async () => {
        // Setup authenticated seller
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());

        // Create test product, variant, and inventory item
        product = await createTestProduct(sellerId);
        variant = await createTestVariant(product._id);
        inventoryItem = await createTestInventoryItem(variant._id);
    });

    afterEach(async () => {
        await InventoryItem.deleteMany({});
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
    });

    describe('Success Cases', () => {
        test('seller updates inventory item with all fields', async () => {
            const updatePayload = {
                batchNumber: 'BATCH-UPDATED',
                stock: 200,
                price: {
                    amount: 150.75,
                    currency: 'USD'
                },
                manufacturingDetails: {
                    mfgDate: '2024-06-01',
                    expDate: '2025-06-01'
                },
                hsnCode: '310220',
                gstPercentage: 12,
                isActive: false
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Inventory item updated successfully');
            expect(res.body.data).toMatchObject({
                _id: inventoryItem._id.toString(),
                variantId: variant._id.toString(),
                batchNumber: 'BATCH-UPDATED',
                stock: 200,
                hsnCode: '310220',
                gstPercentage: 12,
                isActive: false
            });
            expect(res.body.data.price.amount).toBe(150.75);
            expect(res.body.data.price.currency).toBe('USD');
        });

        test('admin updates inventory item', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const updatePayload = {
                stock: 300,
                gstPercentage: 5
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(300);
            expect(res.body.data.gstPercentage).toBe(5);
        });

        test('updates only stock quantity', async () => {
            const updatePayload = {
                stock: 50
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(50);
            // Other fields remain unchanged
            expect(res.body.data.batchNumber).toBe(inventoryItem.batchNumber);
        });

        test('updates only price', async () => {
            const updatePayload = {
                price: {
                    amount: 99.99,
                    currency: 'EUR'
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.price.amount).toBe(99.99);
            expect(res.body.data.price.currency).toBe('EUR');
        });

        test('updates manufacturing details', async () => {
            const updatePayload = {
                manufacturingDetails: {
                    mfgDate: '2024-10-01',
                    expDate: '2025-10-01'
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            const mfgDate = new Date(res.body.data.manufacturingDetails.mfgDate);
            const expDate = new Date(res.body.data.manufacturingDetails.expDate);
            expect(mfgDate.toISOString().split('T')[0]).toBe('2024-10-01');
            expect(expDate.toISOString().split('T')[0]).toBe('2025-10-01');
        });

        test('updates GST percentage', async () => {
            const updatePayload = {
                gstPercentage: 28
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.gstPercentage).toBe(28);
        });

        test('updates HSN code', async () => {
            const updatePayload = {
                hsnCode: '999999'
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.hsnCode).toBe('999999');
        });

        test('updates isActive status', async () => {
            const updatePayload = {
                isActive: false
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });

        test('updates batch number', async () => {
            const updatePayload = {
                batchNumber: 'NEW-BATCH-2024'
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.batchNumber).toBe('NEW-BATCH-2024');
        });

        test('updates stock to zero', async () => {
            const updatePayload = {
                stock: 0
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(0);
        });

        test('updates with decimal stock value', async () => {
            const updatePayload = {
                stock: 75.5
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(75.5);
        });

        test('updates with empty body returns unchanged item', async () => {
            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send({})
                .expect(200);

            expect(res.body.success).toBe(true);
            // Item should remain unchanged
            expect(res.body.data.stock).toBe(inventoryItem.stock);
        });
    });

    describe('Validation Errors', () => {
        test('fails when inventory item ID is invalid ObjectId', async () => {
            const res = await request(app)
                .put('/api/inventory-item/invalid-id')
                .send({ stock: 100 })
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'id',
                        message: 'Inventory item ID must be a valid Mongo ID'
                    })
                ])
            );
        });

        test('fails when stock is negative', async () => {
            const updatePayload = {
                stock: -50
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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

        test('fails when price.amount is negative', async () => {
            const updatePayload = {
                price: {
                    amount: -100
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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

        test('fails when currency code is not 3 letters', async () => {
            const updatePayload = {
                price: {
                    currency: 'US'
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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
            const updatePayload = {
                gstPercentage: 150
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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
            const updatePayload = {
                gstPercentage: -5
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('fails when batchNumber exceeds max length', async () => {
            const updatePayload = {
                batchNumber: 'A'.repeat(101)
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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
            const updatePayload = {
                hsnCode: '1'.repeat(21)
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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
            const updatePayload = {
                manufacturingDetails: {
                    mfgDate: 'invalid-date'
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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
            const updatePayload = {
                manufacturingDetails: {
                    expDate: 'not-a-date'
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
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

        test('fails when isActive is not boolean', async () => {
            const updatePayload = {
                isActive: 'yes'
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(400);

            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'isActive',
                        message: 'isActive must be boolean'
                    })
                ])
            );
        });
    });

    describe('Business Logic Errors', () => {
        test('fails when inventory item does not exist', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const updatePayload = {
                stock: 200
            };

            const res = await request(app)
                .put(`/api/inventory-item/${nonExistentId}`)
                .send(updatePayload)
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
            expect(res.body.error.message).toBe('Inventory item not found');
        });

        test('fails when trying to update to duplicate batch number', async () => {
            // Create another inventory item with a specific batch for the same variant
            const anotherInventory = await createTestInventoryItem(variant._id, {
                batchNumber: 'EXISTING-BATCH-UNIQUE'
            });

            // Try to update our inventory item to have the same batch
            const updatePayload = {
                batchNumber: 'EXISTING-BATCH-UNIQUE'
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload);

            // Should fail with either 409 (duplicate) or 500 (mongo error)
            // MongoDB duplicate key error might be wrapped
            expect([409, 500]).toContain(res.status);
            if (res.status === 409) {
                expect(res.body.error.code).toBe('DB_DUPLICATE');
            }
        });
    });

    describe('Authorization Tests', () => {
        test('fails when user is not authenticated', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const updatePayload = {
                stock: 200
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(403);

            expect(res.body.code).toBe('FORBIDDEN_ROLE');
        });

        test('fails when role is customer', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const updatePayload = {
                stock: 200
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(403);

            expect(res.body.code).toBe('FORBIDDEN_ROLE');
        });
    });

    describe('Edge Cases', () => {
        test('updates with very large stock', async () => {
            const updatePayload = {
                stock: 999999999
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.data.stock).toBe(999999999);
        });

        test('updates with very small price', async () => {
            const updatePayload = {
                price: {
                    amount: 0.01
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.data.price.amount).toBe(0.01);
        });

        test('updates price to zero', async () => {
            const updatePayload = {
                price: {
                    amount: 0
                }
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.data.price.amount).toBe(0);
        });

        test('updates GST to 0%', async () => {
            const updatePayload = {
                gstPercentage: 0
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.data.gstPercentage).toBe(0);
        });

        test('updates GST to 100%', async () => {
            const updatePayload = {
                gstPercentage: 100
            };

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send(updatePayload)
                .expect(200);

            expect(res.body.data.gstPercentage).toBe(100);
        });

        test('multiple sequential updates work correctly', async () => {
            // First update
            await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send({ stock: 50 })
                .expect(200);

            // Second update
            await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send({ price: { amount: 200 } })
                .expect(200);

            // Third update
            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send({ gstPercentage: 5 })
                .expect(200);

            expect(res.body.data.stock).toBe(50);
            expect(res.body.data.price.amount).toBe(200);
            expect(res.body.data.gstPercentage).toBe(5);
        });

        test('updates preserve timestamps correctly', async () => {
            const originalCreatedAt = inventoryItem.createdAt;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 100));

            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send({ stock: 150 })
                .expect(200);

            // createdAt should remain the same
            expect(new Date(res.body.data.createdAt).getTime())
                .toBe(new Date(originalCreatedAt).getTime());

            // updatedAt should be different
            expect(new Date(res.body.data.updatedAt).getTime())
                .toBeGreaterThan(new Date(originalCreatedAt).getTime());
        });
    });
});

import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import InventoryItem from '../src/models/inventory.model.js';
import ProductVariant from '../src/models/variant.model.js';
import Product from '../src/models/product.model.js';

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
        batchNumber: `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
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

describe('GET /api/inventory-item/:id - Get Inventory Item by ID', () => {
    let sellerId;
    let product;
    let variant;
    let inventoryItem;

    beforeEach(async () => {
        // Setup authenticated user
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
        test('seller successfully retrieves inventory item by ID', async () => {
            const res = await request(app)
                .get(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Inventory item fetched successfully');
            expect(res.body.data).toMatchObject({
                _id: inventoryItem._id.toString(),
                variantId: variant._id.toString(),
                batchNumber: inventoryItem.batchNumber,
                stock: 100,
                hsnCode: '310210',
                gstPercentage: 18,
                isActive: true
            });
            expect(res.body.data.price.amount).toBe(120.5);
            expect(res.body.data.price.currency).toBe('INR');
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('updatedAt');
        });

        test('admin successfully retrieves inventory item by ID', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app)
                .get(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data._id).toBe(inventoryItem._id.toString());
        });

        test('regular user successfully retrieves inventory item by ID', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app)
                .get(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data._id).toBe(inventoryItem._id.toString());
        });

        test('retrieves inventory item with all fields populated', async () => {
            const res = await request(app)
                .get(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            const item = res.body.data;
            expect(item).toHaveProperty('_id');
            expect(item).toHaveProperty('variantId');
            expect(item).toHaveProperty('batchNumber');
            expect(item).toHaveProperty('stock');
            expect(item).toHaveProperty('price');
            expect(item.price).toHaveProperty('amount');
            expect(item.price).toHaveProperty('currency');
            expect(item).toHaveProperty('manufacturingDetails');
            expect(item).toHaveProperty('hsnCode');
            expect(item).toHaveProperty('gstPercentage');
            expect(item).toHaveProperty('isActive');
            expect(item).toHaveProperty('createdAt');
            expect(item).toHaveProperty('updatedAt');
        });

        test('retrieves inactive inventory item', async () => {
            const inactiveItem = await createTestInventoryItem(variant._id, { isActive: false });

            const res = await request(app)
                .get(`/api/inventory-item/${inactiveItem._id}`)
                .expect(200);

            expect(res.body.data.isActive).toBe(false);
        });
    });

    describe('Validation Errors', () => {
        test('fails when inventory item ID is invalid ObjectId', async () => {
            const res = await request(app)
                .get('/api/inventory-item/invalid-id')
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

        test('fails when inventory item ID is empty', async () => {
            const res = await request(app)
                .get('/api/inventory-item/ ')
                .expect(404); // Route not found

            expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
        });
    });

    describe('Business Logic Errors', () => {
        test('fails when inventory item does not exist', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .get(`/api/inventory-item/${nonExistentId}`)
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
            expect(res.body.error.message).toBe('Inventory item not found');
        });

        test('fails when fetching deleted inventory item', async () => {
            // Delete the item first
            await InventoryItem.findByIdAndDelete(inventoryItem._id);

            const res = await request(app)
                .get(`/api/inventory-item/${inventoryItem._id}`)
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
        });
    });

    describe('Edge Cases', () => {
        test('retrieves inventory item with zero stock', async () => {
            const zeroStockItem = await createTestInventoryItem(variant._id, { stock: 0 });

            const res = await request(app)
                .get(`/api/inventory-item/${zeroStockItem._id}`)
                .expect(200);

            expect(res.body.data.stock).toBe(0);
        });

        test('retrieves inventory item with decimal stock', async () => {
            const decimalStockItem = await createTestInventoryItem(variant._id, { stock: 45.75 });

            const res = await request(app)
                .get(`/api/inventory-item/${decimalStockItem._id}`)
                .expect(200);

            expect(res.body.data.stock).toBe(45.75);
        });

        test('retrieves inventory item with no batch number', async () => {
            const noBatchItem = await InventoryItem.create({
                variantId: variant._id,
                stock: 50,
                price: { amount: 100, currency: 'INR' }
            });

            const res = await request(app)
                .get(`/api/inventory-item/${noBatchItem._id}`)
                .expect(200);

            expect(res.body.data.stock).toBe(50);
        });

        test('retrieves multiple inventory items sequentially', async () => {
            const item1 = await createTestInventoryItem(variant._id);
            const item2 = await createTestInventoryItem(variant._id);

            const res1 = await request(app)
                .get(`/api/inventory-item/${item1._id}`)
                .expect(200);

            const res2 = await request(app)
                .get(`/api/inventory-item/${item2._id}`)
                .expect(200);

            expect(res1.body.data._id).toBe(item1._id.toString());
            expect(res2.body.data._id).toBe(item2._id.toString());
        });
    });
});

describe('DELETE /api/inventory-item/:id - Delete Inventory Item', () => {
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
        test('seller successfully deletes inventory item', async () => {
            const res = await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Inventory item deleted successfully');
            expect(res.body.data).toBeNull();

            // Verify item is actually deleted from database
            const deletedItem = await InventoryItem.findById(inventoryItem._id);
            expect(deletedItem).toBeNull();
        });

        test('admin successfully deletes inventory item', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);

            // Verify deletion
            const deletedItem = await InventoryItem.findById(inventoryItem._id);
            expect(deletedItem).toBeNull();
        });

        test('deletes inventory item and returns null data', async () => {
            const res = await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            expect(res.body.data).toBeNull();
        });

        test('deletes one of multiple inventory items for same variant', async () => {
            const item1 = await createTestInventoryItem(variant._id);
            const item2 = await createTestInventoryItem(variant._id);

            await request(app)
                .delete(`/api/inventory-item/${item1._id}`)
                .expect(200);

            // Verify only item1 is deleted
            const deletedItem1 = await InventoryItem.findById(item1._id);
            const existingItem2 = await InventoryItem.findById(item2._id);

            expect(deletedItem1).toBeNull();
            expect(existingItem2).not.toBeNull();
        });

        test('deletes inactive inventory item', async () => {
            const inactiveItem = await createTestInventoryItem(variant._id, { isActive: false });

            const res = await request(app)
                .delete(`/api/inventory-item/${inactiveItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);

            // Verify deletion
            const deletedItem = await InventoryItem.findById(inactiveItem._id);
            expect(deletedItem).toBeNull();
        });

        test('deletes inventory item with zero stock', async () => {
            const zeroStockItem = await createTestInventoryItem(variant._id, { stock: 0 });

            const res = await request(app)
                .delete(`/api/inventory-item/${zeroStockItem._id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });
    });

    describe('Validation Errors', () => {
        test('fails when inventory item ID is invalid ObjectId', async () => {
            const res = await request(app)
                .delete('/api/inventory-item/invalid-id')
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

        test('fails when inventory item ID is empty', async () => {
            const res = await request(app)
                .delete('/api/inventory-item/ ')
                .expect(404); // Route not found

            expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
        });
    });

    describe('Business Logic Errors', () => {
        test('fails when inventory item does not exist', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/api/inventory-item/${nonExistentId}`)
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
            expect(res.body.error.message).toBe('Inventory item not found');
        });

        test('fails when trying to delete already deleted item', async () => {
            // Delete the item first
            await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            // Try to delete again
            const res = await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
        });
    });

    describe('Authorization Tests', () => {
        test('fails when user is not authenticated (regular user)', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(403);

            expect(res.body.code).toBe('FORBIDDEN_ROLE');

            // Verify item is NOT deleted
            const existingItem = await InventoryItem.findById(inventoryItem._id);
            expect(existingItem).not.toBeNull();
        });

        test('fails when role is customer', async () => {
            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const res = await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(403);

            expect(res.body.code).toBe('FORBIDDEN_ROLE');

            // Verify item is NOT deleted
            const existingItem = await InventoryItem.findById(inventoryItem._id);
            expect(existingItem).not.toBeNull();
        });
    });

    describe('Edge Cases', () => {
        test('cannot retrieve deleted inventory item', async () => {
            // Delete the item
            await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            // Try to retrieve it
            const res = await request(app)
                .get(`/api/inventory-item/${inventoryItem._id}`)
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
        });

        test('cannot update deleted inventory item', async () => {
            // Delete the item
            await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            // Try to update it
            const res = await request(app)
                .put(`/api/inventory-item/${inventoryItem._id}`)
                .send({ stock: 200 })
                .expect(404);

            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
        });

        test('deletes multiple items sequentially', async () => {
            const item1 = await createTestInventoryItem(variant._id);
            const item2 = await createTestInventoryItem(variant._id);
            const item3 = await createTestInventoryItem(variant._id);

            await request(app).delete(`/api/inventory-item/${item1._id}`).expect(200);
            await request(app).delete(`/api/inventory-item/${item2._id}`).expect(200);
            await request(app).delete(`/api/inventory-item/${item3._id}`).expect(200);

            // Verify all are deleted
            const count = await InventoryItem.countDocuments({
                _id: { $in: [item1._id, item2._id, item3._id] }
            });
            expect(count).toBe(0);
        });

        test('delete does not affect other variants inventory', async () => {
            // Create another variant and its inventory
            const variant2 = await createTestVariant(product._id);
            const otherInventory = await createTestInventoryItem(variant2._id);

            // Delete original inventory
            await request(app)
                .delete(`/api/inventory-item/${inventoryItem._id}`)
                .expect(200);

            // Verify other inventory still exists
            const existingItem = await InventoryItem.findById(otherInventory._id);
            expect(existingItem).not.toBeNull();
        });
    });
});

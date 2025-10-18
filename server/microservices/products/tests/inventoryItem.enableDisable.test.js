import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import productModel from '../src/models/product.model.js';
import variantModel from '../src/models/variant.model.js';
import inventoryModel from '../src/models/inventory.model.js';

async function createProductForSeller(sellerId, overrides = {}) {
    const base = {
        name: `Product-${Math.random().toString(36).slice(2, 8)}`,
        description: 'Inventory parent product',
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
        sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
        options: { Color: 'Red', Size: 'M' },
        price: { amount: 100, currency: 'INR' },
        stock: 5,
        baseUnit: 'unit',
        variantImages: [
            { url: 'https://cdn.example.com/variant-a.jpg', fileId: 'ik-old-a' },
        ],
        isActive: true
    };
    return variantModel.create({ ...base, ...overrides });
}

async function createInventoryItem(variantId, overrides = {}) {
    const base = {
        variantId,
        batchNumber: `BATCH-${Math.random().toString(36).slice(2, 8)}`,
        stockInBaseUnits: 100,
        pricePerBaseUnit: { amount: 50, currency: 'INR' },
        status: 'Sealed',
        manufacturingDetails: {
            mfgDate: new Date('2024-01-01'),
            expDate: new Date('2025-12-31')
        },
        hsnCode: '1234',
        gstPercentage: 18,
        isActive: true
    };
    return inventoryModel.create({ ...base, ...overrides });
}

describe('PATCH /api/inventory-item/:id/disable and /enable', () => {
    let sellerId;

    beforeEach(async () => {
        sellerId = new mongoose.Types.ObjectId();
        if (global.setTestAuthRole) global.setTestAuthRole('seller');
        if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
    });

    describe('disable', () => {
        test('success: seller owner disables inventory item', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
            expect(res.body.message).toBe('Inventory item disabled successfully');
        });

        test('success: admin disables inventory item', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });

        test('idempotent: disabling already disabled returns 200 and remains false', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });

        test('error: seller not owner', async () => {
            const otherSeller = new mongoose.Types.ObjectId();
            const product = await createProductForSeller(otherSeller);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('FORBIDDEN_NOT_OWNER');
        });

        test('error: user role cannot disable', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(403);
        });

        test('error: customer role cannot disable', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(403);
        });

        test('error: inventory item not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app).patch(`/api/inventory-item/${nonExistentId}/disable`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
        });

        test('validation: invalid id format', async () => {
            const res = await request(app).patch(`/api/inventory-item/not-a-valid-id/disable`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('error: variant not found', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            // Delete the variant to simulate orphaned inventory
            await variantModel.findByIdAndDelete(variant._id);

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VARIANT_NOT_FOUND');
        });

        test('error: product not found', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            // Delete the product to simulate orphaned variant/inventory
            await productModel.findByIdAndDelete(product._id);

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });
    });

    describe('enable', () => {
        test('success: seller owner enables inventory item', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(true);
            expect(res.body.message).toBe('Inventory item enabled successfully');
        });

        test('success: admin enables inventory item', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            if (global.setTestAuthRole) global.setTestAuthRole('admin');

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(true);
        });

        test('idempotent: enabling already enabled returns 200 and remains true', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: true });

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(true);
        });

        test('error: seller not owner', async () => {
            const otherSeller = new mongoose.Types.ObjectId();
            const product = await createProductForSeller(otherSeller);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('FORBIDDEN_NOT_OWNER');
        });

        test('error: user role cannot enable', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            if (global.setTestAuthRole) global.setTestAuthRole('user');

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(403);
        });

        test('error: customer role cannot enable', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            if (global.setTestAuthRole) global.setTestAuthRole('customer');

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(403);
        });

        test('error: inventory item not found', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app).patch(`/api/inventory-item/${nonExistentId}/enable`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('INVENTORY_ITEM_NOT_FOUND');
        });

        test('validation: invalid id format', async () => {
            const res = await request(app).patch(`/api/inventory-item/not-a-valid-id/enable`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('error: variant not found', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            // Delete the variant to simulate orphaned inventory
            await variantModel.findByIdAndDelete(variant._id);

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VARIANT_NOT_FOUND');
        });

        test('error: product not found', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id, { isActive: false });

            // Delete the product to simulate orphaned variant/inventory
            await productModel.findByIdAndDelete(product._id);

            const res = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });
    });

    describe('integration: disable then enable', () => {
        test('should successfully disable and then re-enable inventory item', async () => {
            const product = await createProductForSeller(sellerId);
            const variant = await createVariant(product._id);
            const inventory = await createInventoryItem(variant._id);

            // Disable
            const disableRes = await request(app).patch(`/api/inventory-item/${inventory._id}/disable`);
            expect(disableRes.status).toBe(200);
            expect(disableRes.body.data.isActive).toBe(false);

            // Enable
            const enableRes = await request(app).patch(`/api/inventory-item/${inventory._id}/enable`);
            expect(enableRes.status).toBe(200);
            expect(enableRes.body.data.isActive).toBe(true);
        });
    });
});

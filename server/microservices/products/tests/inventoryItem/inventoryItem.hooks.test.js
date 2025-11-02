import mongoose from 'mongoose';
import InventoryItem from '../../src/models/inventory.model.js';
import ProductVariant from '../../src/models/variant.model.js';
import Product from '../../src/models/product.model.js';

describe('InventoryItem Hooks - Variant Stock Update', () => {
    let testProduct;
    let testVariant;

    // Helper to create test product
    async function createTestProduct() {
        return Product.create({
            name: `Product-${Math.random().toString(36).slice(2, 8)}`,
            description: 'Test product for inventory hooks',
            brand: 'TestBrand',
            sellerId: new mongoose.Types.ObjectId(),
            categoryId: new mongoose.Types.ObjectId(),
            attributes: ['Color', 'Size'],
            baseImages: [
                { fileId: 'img-1', url: 'https://cdn.example.com/img1.jpg', name: 'img1.jpg' }
            ],
            isActive: true,
        });
    }

    // Helper to create test variant
    async function createTestVariant(productId, initialStock = 0) {
        return ProductVariant.create({
            productId,
            sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
            options: new Map([['Color', 'Red'], ['Size', 'M']]),
            price: { amount: 500, currency: 'INR' },
            stock: initialStock,
            baseUnit: 'kg',
            variantImages: [
                { fileId: 'var-img-1', url: 'https://cdn.example.com/var1.jpg', name: 'var1.jpg' }
            ],
            isActive: true
        });
    }

    // Helper to create inventory item
    async function createInventoryItem(variantId, stock = 100, isActive = true) {
        return InventoryItem.create({
            variantId,
            batchNumber: `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            stock,
            price: { amount: 120.5, currency: 'INR' },
            manufacturingDetails: {
                mfgDate: new Date('2024-01-01'),
                expDate: new Date('2025-12-31')
            },
            hsnCode: '310210',
            gstPercentage: 18,
            isActive
        });
    }

    beforeEach(async () => {
        await InventoryItem.deleteMany({});
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});

        // Create test product and variant
        testProduct = await createTestProduct();
        testVariant = await createTestVariant(testProduct._id, 0);
    });

    afterEach(async () => {
        await InventoryItem.deleteMany({});
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
    });

    // ===== HOOK 1: POST SAVE (CREATE) =====
    describe('post save hook - inventory item creation', () => {
        it('updates variant stock when single inventory item is created', async () => {
            // Create inventory item with stock 100
            await createInventoryItem(testVariant._id, 100);

            // Check variant stock was updated
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(100);
        });

        it('updates variant stock when multiple inventory items are created', async () => {
            // Create first inventory item
            await createInventoryItem(testVariant._id, 50);

            // Create second inventory item
            await createInventoryItem(testVariant._id, 75);

            // Check variant stock is sum of all items
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(125); // 50 + 75
        });

        it('updates variant stock with three inventory items', async () => {
            await createInventoryItem(testVariant._id, 100);
            await createInventoryItem(testVariant._id, 200);
            await createInventoryItem(testVariant._id, 150);

            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(450); // 100 + 200 + 150
        });

        it('ignores inactive inventory items when calculating stock', async () => {
            // Create active inventory
            await createInventoryItem(testVariant._id, 100, true);

            // Create inactive inventory
            await createInventoryItem(testVariant._id, 50, false);

            // Only active inventory should be counted
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(100);
        });

        it('handles zero stock inventory items', async () => {
            await createInventoryItem(testVariant._id, 0);

            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(0);
        });

        it('handles decimal stock values', async () => {
            await createInventoryItem(testVariant._id, 25.5);
            await createInventoryItem(testVariant._id, 30.75);

            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(56.25); // 25.5 + 30.75
        });

        it('updates stock immediately after creation', async () => {
            const inventoryItem = await createInventoryItem(testVariant._id, 200);

            // Check stock updated immediately
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(200);

            // Verify the inventory item was created
            expect(inventoryItem.stock).toBe(200);
        });

        it('handles large stock numbers', async () => {
            await createInventoryItem(testVariant._id, 999999);

            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(999999);
        });
    });

    // ===== HOOK 2: POST FINDONEANDUPDATE (UPDATE) =====
    describe('post findOneAndUpdate hook - inventory item update', () => {
        it('updates variant stock when inventory stock is increased', async () => {
            // Create initial inventory
            const inventoryItem = await createInventoryItem(testVariant._id, 100);

            // Update stock to 200
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 200 });

            // Check variant stock updated
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(200);
        });

        it('updates variant stock when inventory stock is decreased', async () => {
            // Create initial inventory
            const inventoryItem = await createInventoryItem(testVariant._id, 100);

            // Decrease stock to 50
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 50 });

            // Check variant stock updated
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(50);
        });

        it('updates variant stock when inventory stock is set to zero', async () => {
            const inventoryItem = await createInventoryItem(testVariant._id, 100);

            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 0 });

            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(0);
        });

        it('updates variant stock correctly with multiple inventory items', async () => {
            // Create two inventory items
            const item1 = await createInventoryItem(testVariant._id, 100);
            const item2 = await createInventoryItem(testVariant._id, 50);

            // Initial total: 150
            let updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(150);

            // Update first item stock to 200
            await InventoryItem.findByIdAndUpdate(item1._id, { stock: 200 });

            // Total should now be 250 (200 + 50)
            updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(250);
        });

        it('recalculates stock when inventory is deactivated', async () => {
            // Create two active inventory items
            const item1 = await createInventoryItem(testVariant._id, 100, true);
            await createInventoryItem(testVariant._id, 50, true);

            // Initial total: 150
            let updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(150);

            // Deactivate first item
            await InventoryItem.findByIdAndUpdate(item1._id, { isActive: false });

            // Total should now be 50 (only active items counted)
            updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(50);
        });

        it('recalculates stock when inventory is reactivated', async () => {
            // Create one active and one inactive inventory item
            const item1 = await createInventoryItem(testVariant._id, 100, false);
            await createInventoryItem(testVariant._id, 50, true);

            // Initial total: 50 (only active)
            let updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(50);

            // Reactivate first item
            await InventoryItem.findByIdAndUpdate(item1._id, { isActive: true });

            // Total should now be 150 (both active)
            updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(150);
        });

        it('handles multiple sequential updates', async () => {
            const inventoryItem = await createInventoryItem(testVariant._id, 100);

            // First update
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 150 });
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(150);

            // Second update
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 75 });
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(75);

            // Third update
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 200 });
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(200);
        });

        it('updates variant stock when non-stock fields are modified', async () => {
            const inventoryItem = await createInventoryItem(testVariant._id, 100);

            // Update non-stock field (price)
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, {
                price: { amount: 200, currency: 'USD' }
            });

            // Stock should remain same
            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(100);
        });

        it('handles decimal stock updates', async () => {
            const inventoryItem = await createInventoryItem(testVariant._id, 50.5);

            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 75.25 });

            const updatedVariant = await ProductVariant.findById(testVariant._id);
            expect(updatedVariant.stock).toBe(75.25);
        });
    });

    // ===== HOOK 3 & 4: PRE/POST FINDONEANDDELETE (DELETE) =====
    describe('pre/post findOneAndDelete hooks - inventory item deletion', () => {
        it('updates variant stock when inventory item is deleted', async () => {
            // Create inventory item
            const inventoryItem = await createInventoryItem(testVariant._id, 100);

            // Verify stock is 100
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(100);

            // Delete inventory item
            await InventoryItem.findByIdAndDelete(inventoryItem._id);

            // Stock should be 0 now
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(0);
        });

        it('recalculates stock correctly when one of multiple items is deleted', async () => {
            // Create three inventory items
            const item1 = await createInventoryItem(testVariant._id, 100);
            const item2 = await createInventoryItem(testVariant._id, 50);
            const item3 = await createInventoryItem(testVariant._id, 75);

            // Total stock: 225
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(225);

            // Delete second item (50)
            await InventoryItem.findByIdAndDelete(item2._id);

            // Total should now be 175 (100 + 75)
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(175);
        });

        it('sets variant stock to zero when last inventory item is deleted', async () => {
            // Create single inventory item
            const inventoryItem = await createInventoryItem(testVariant._id, 200);

            // Delete it
            await InventoryItem.findByIdAndDelete(inventoryItem._id);

            // Stock should be 0
            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(0);
        });

        it('deletes multiple items and updates stock correctly', async () => {
            // Create four inventory items
            const item1 = await createInventoryItem(testVariant._id, 100);
            const item2 = await createInventoryItem(testVariant._id, 50);
            const item3 = await createInventoryItem(testVariant._id, 75);
            const item4 = await createInventoryItem(testVariant._id, 25);

            // Total: 250
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(250);

            // Delete first item
            await InventoryItem.findByIdAndDelete(item1._id);
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(150); // 50 + 75 + 25

            // Delete third item
            await InventoryItem.findByIdAndDelete(item3._id);
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(75); // 50 + 25

            // Delete remaining items
            await InventoryItem.findByIdAndDelete(item2._id);
            await InventoryItem.findByIdAndDelete(item4._id);
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(0);
        });

        it('only counts active items after deletion', async () => {
            // Create active and inactive items
            const activeItem1 = await createInventoryItem(testVariant._id, 100, true);
            const inactiveItem = await createInventoryItem(testVariant._id, 50, false);
            const activeItem2 = await createInventoryItem(testVariant._id, 75, true);

            // Total: 175 (only active)
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(175);

            // Delete one active item
            await InventoryItem.findByIdAndDelete(activeItem1._id);

            // Total should be 75 (only remaining active item)
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(75);
        });

        it('handles deletion of inactive inventory item', async () => {
            // Create active and inactive items
            const activeItem = await createInventoryItem(testVariant._id, 100, true);
            const inactiveItem = await createInventoryItem(testVariant._id, 50, false);

            // Total: 100 (only active)
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(100);

            // Delete inactive item
            await InventoryItem.findByIdAndDelete(inactiveItem._id);

            // Total should still be 100
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(100);
        });
    });

    // ===== COMBINED OPERATIONS =====
    describe('combined operations - create, update, delete', () => {
        it('handles complete lifecycle: create -> update -> delete', async () => {
            // Create inventory item
            const inventoryItem = await createInventoryItem(testVariant._id, 100);
            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(100);

            // Update stock
            await InventoryItem.findByIdAndUpdate(inventoryItem._id, { stock: 200 });
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(200);

            // Delete item
            await InventoryItem.findByIdAndDelete(inventoryItem._id);
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(0);
        });

        it('handles complex scenario with multiple operations', async () => {
            // Create three items
            const item1 = await createInventoryItem(testVariant._id, 100);
            const item2 = await createInventoryItem(testVariant._id, 50);
            const item3 = await createInventoryItem(testVariant._id, 75);

            let variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(225);

            // Update item1
            await InventoryItem.findByIdAndUpdate(item1._id, { stock: 150 });
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(275); // 150 + 50 + 75

            // Delete item2
            await InventoryItem.findByIdAndDelete(item2._id);
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(225); // 150 + 75

            // Create new item
            await createInventoryItem(testVariant._id, 100);
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(325); // 150 + 75 + 100

            // Deactivate item3
            await InventoryItem.findByIdAndUpdate(item3._id, { isActive: false });
            variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(250); // 150 + 100
        });

        it('maintains accurate stock across rapid successive operations', async () => {
            const item = await createInventoryItem(testVariant._id, 50);

            // Rapid updates
            await InventoryItem.findByIdAndUpdate(item._id, { stock: 100 });
            await InventoryItem.findByIdAndUpdate(item._id, { stock: 75 });
            await InventoryItem.findByIdAndUpdate(item._id, { stock: 150 });
            await InventoryItem.findByIdAndUpdate(item._id, { stock: 25 });

            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(25);
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles variant with no inventory items (stock should be 0)', async () => {
            // Don't create any inventory items
            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(0);
        });

        it('handles all inactive inventory items (stock should be 0)', async () => {
            await createInventoryItem(testVariant._id, 100, false);
            await createInventoryItem(testVariant._id, 50, false);

            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(0);
        });

        it('handles very large stock numbers', async () => {
            await createInventoryItem(testVariant._id, 1000000);
            await createInventoryItem(testVariant._id, 500000);

            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(1500000);
        });

        it('handles fractional stock precision', async () => {
            await createInventoryItem(testVariant._id, 10.123);
            await createInventoryItem(testVariant._id, 20.456);

            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBeCloseTo(30.579, 3);
        });

        it('maintains stock accuracy with many inventory items', async () => {
            // Create 10 inventory items
            for (let i = 0; i < 10; i++) {
                await createInventoryItem(testVariant._id, 10);
            }

            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(100);
        });

        it('handles update with same stock value (no change)', async () => {
            const item = await createInventoryItem(testVariant._id, 100);

            // Update with same value
            await InventoryItem.findByIdAndUpdate(item._id, { stock: 100 });

            const variant = await ProductVariant.findById(testVariant._id);
            expect(variant.stock).toBe(100);
        });

        it('handles inventory items across different variants independently', async () => {
            // Create second variant
            const variant2 = await createTestVariant(testProduct._id, 0);

            // Create inventory for first variant
            await createInventoryItem(testVariant._id, 100);

            // Create inventory for second variant
            await createInventoryItem(variant2._id, 200);

            // Check both variants have correct independent stock
            const updatedVariant1 = await ProductVariant.findById(testVariant._id);
            const updatedVariant2 = await ProductVariant.findById(variant2._id);

            expect(updatedVariant1.stock).toBe(100);
            expect(updatedVariant2.stock).toBe(200);
        });
    });
});

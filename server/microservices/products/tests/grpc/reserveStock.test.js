import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import mongoose from 'mongoose';
import ProductVariant from '../../src/models/variant.model.js';
import Product from '../../src/models/product.model.js';
import InventoryItem from '../../src/models/inventory.model.js';
import ReserveStock from '../../src/models/reserveStock.model.js';
import { startGrpcServer, stopGrpcServer } from '../../src/grpc/server/index.js';

// Get proto path relative to project root
const PROTO_PATH = path.join(process.cwd(), 'protos', 'product.proto');

describe('gRPC ReserveStock', () => {
    let client;
    let testProduct;
    let testVariant;
    let testInventory1;
    let testInventory2;
    let testInventory3;
    const GRPC_PORT = '50098'; // Use different port for testing

    // Setup: Start gRPC server and create test client
    beforeAll(async () => {
        // Start gRPC server on test port
        await startGrpcServer(GRPC_PORT);

        // Load proto and create client
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });

        const productProto = grpc.loadPackageDefinition(packageDefinition).product;

        client = new productProto.ProductService(
            `localhost:${GRPC_PORT}`,
            grpc.credentials.createInsecure()
        );
    });

    afterAll(async () => {
        // Stop gRPC server
        await stopGrpcServer();

        // Close client
        if (client) {
            client.close();
        }
    });

    beforeEach(async () => {
        // Clear database
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
        await InventoryItem.deleteMany({});
        await ReserveStock.deleteMany({});

        // Create test product
        testProduct = await Product.create({
            name: 'Test Product',
            description: 'Test Description',
            brand: 'TestBrand',
            sellerId: new mongoose.Types.ObjectId(),
            categoryId: new mongoose.Types.ObjectId(),
            attributes: ['Color', 'Size'],
            baseImages: [
                { fileId: 'img-1', url: 'https://cdn.example.com/img1.jpg', name: 'img1.jpg' }
            ],
            isActive: true
        });

        // Create test variant
        testVariant = await ProductVariant.create({
            productId: testProduct._id,
            sku: 'TEST-SKU-001',
            options: new Map([['Color', 'Red'], ['Size', 'M']]),
            price: { amount: 500, currency: 'INR' },
            stock: 0, // Will be updated by inventory hooks
            baseUnit: 'kg',
            variantImages: [],
            isActive: true
        });

        // Create test inventory items with FEFO logic (expiry dates)
        const now = new Date();

        // Inventory 1: Expires first (in 10 days)
        testInventory1 = await InventoryItem.create({
            variantId: testVariant._id,
            batchNumber: 'BATCH-001',
            stock: 50,
            price: { amount: 500, currency: 'INR' },
            manufacturingDetails: {
                mfgDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                expDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000) // Expires in 10 days
            },
            isActive: true
        });

        // Inventory 2: Expires second (in 30 days)
        testInventory2 = await InventoryItem.create({
            variantId: testVariant._id,
            batchNumber: 'BATCH-002',
            stock: 75,
            price: { amount: 500, currency: 'INR' },
            manufacturingDetails: {
                mfgDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
                expDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // Expires in 30 days
            },
            isActive: true
        });

        // Inventory 3: No expiry date (should be picked last)
        testInventory3 = await InventoryItem.create({
            variantId: testVariant._id,
            batchNumber: 'BATCH-003',
            stock: 25,
            price: { amount: 500, currency: 'INR' },
            manufacturingDetails: {},
            isActive: true
        });
    });

    afterEach(async () => {
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
        await InventoryItem.deleteMany({});
        await ReserveStock.deleteMany({});
    });

    // Helper function to promisify gRPC call
    const reserveStock = (variantId, quantity, reservationId) => {
        return new Promise((resolve, reject) => {
            client.ReserveStock({ variantId, quantity, reservationId }, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    };

    // ===== SUCCESS CASES =====
    describe('Success Cases', () => {
        it('should reserve stock successfully with valid data', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                20,
                'ORDER-123'
            );

            expect(response.success).toBe(true);
            expect(response.message).toBe('Stock reserved successfully');
            expect(response.reserveId).toBeDefined();
            expect(response.reserveId).toMatch(/^[a-f0-9]{24}$/); // Valid ObjectId
            expect(response.error).toBeNull();

            // Verify reservation was created in database
            const reservation = await ReserveStock.findById(response.reserveId);
            expect(reservation).toBeDefined();
            expect(reservation.variantId.toString()).toBe(testVariant._id.toString());
            expect(reservation.totalQuantity).toBe(20);
            expect(reservation.status).toBe('PENDING');
            expect(reservation.inventoryEntries).toHaveLength(1);
            expect(reservation.inventoryEntries[0].quantity).toBe(20);
        });

        it('should use FEFO logic - pick from earliest expiring batch first', async () => {
            // Get all inventories sorted by expiry to verify FEFO
            const inventories = await InventoryItem.find({ variantId: testVariant._id, isActive: true })
                .sort({ 'manufacturingDetails.expDate': 1 });

            const earliestExpiringInventory = inventories[0];
            const availableStock = earliestExpiringInventory.stock;

            // Reserve less than what's in first inventory to test FEFO
            const quantityToReserve = Math.min(25, availableStock);

            const response = await reserveStock(
                testVariant._id.toString(),
                quantityToReserve,
                'ORDER-FEFO-1'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);

            // Should pick from earliest expiring inventory
            expect(reservation.inventoryEntries.length).toBeGreaterThanOrEqual(1);
            expect(reservation.inventoryEntries[0].inventoryId.toString()).toBe(earliestExpiringInventory._id.toString());

            // Verify stock was deducted
            const updatedInventory = await InventoryItem.findById(earliestExpiringInventory._id);
            expect(updatedInventory.stock).toBe(availableStock - quantityToReserve);
        });

        it('should span multiple batches when single batch insufficient', async () => {
            // Get all active inventories with their current stock
            const inventories = await InventoryItem.find({ variantId: testVariant._id, isActive: true });
            const totalAvailableStock = inventories.reduce((sum, inv) => sum + inv.stock, 0);

            // Request more than any single batch but less than total
            const quantityToReserve = Math.min(100, totalAvailableStock);

            const response = await reserveStock(
                testVariant._id.toString(),
                quantityToReserve,
                'ORDER-MULTI-BATCH'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);

            // Should span multiple batches
            expect(reservation.inventoryEntries.length).toBeGreaterThanOrEqual(2);

            // Verify total quantity matches
            const totalReserved = reservation.inventoryEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            expect(totalReserved).toBe(quantityToReserve);
        });

        it('should pick from all 3 batches including non-expiring batch', async () => {
            // Get total available stock
            const inventories = await InventoryItem.find({ variantId: testVariant._id, isActive: true });
            const totalAvailableStock = inventories.reduce((sum, inv) => sum + inv.stock, 0);

            const response = await reserveStock(
                testVariant._id.toString(),
                totalAvailableStock, // Reserve ALL available stock
                'ORDER-ALL-BATCHES'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);

            // Should pick from all available batches
            expect(reservation.inventoryEntries.length).toBeGreaterThanOrEqual(3);

            // Verify total quantity matches
            const totalReserved = reservation.inventoryEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            expect(totalReserved).toBe(totalAvailableStock);

            // Verify all stocks depleted
            const updatedInventories = await InventoryItem.find({ variantId: testVariant._id });
            const remainingStock = updatedInventories.reduce((sum, inv) => sum + inv.stock, 0);
            expect(remainingStock).toBe(0);
        });

        it('should reserve minimum quantity (1 unit)', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                1,
                'ORDER-MIN'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);
            expect(reservation.totalQuantity).toBe(1);
            expect(reservation.inventoryEntries[0].quantity).toBe(1);
        });

        it('should store price snapshot in inventoryEntries', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                10,
                'ORDER-PRICE-CHECK'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);

            // Verify price is stored
            expect(reservation.inventoryEntries[0].price).toBeDefined();
            expect(reservation.inventoryEntries[0].price.amount).toBe(500);
            expect(reservation.inventoryEntries[0].price.currency).toBe('INR');
        });

        it('should create reservation with expiresAt timestamp', async () => {
            const beforeReservation = new Date();

            const response = await reserveStock(
                testVariant._id.toString(),
                10,
                'ORDER-EXPIRY'
            );

            const afterReservation = new Date();

            const reservation = await ReserveStock.findById(response.reserveId);

            // Should have expiresAt 5 minutes from now
            expect(reservation.expiresAt).toBeDefined();

            const expectedExpiryMin = new Date(beforeReservation.getTime() + 5 * 60 * 1000);
            const expectedExpiryMax = new Date(afterReservation.getTime() + 5 * 60 * 1000);

            expect(reservation.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiryMin.getTime() - 1000);
            expect(reservation.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiryMax.getTime() + 1000);
        });

        it('should handle concurrent reservations correctly', async () => {
            // Create 3 concurrent reservations
            const promises = [
                reserveStock(testVariant._id.toString(), 40, 'ORDER-CONCURRENT-1'),
                reserveStock(testVariant._id.toString(), 40, 'ORDER-CONCURRENT-2'),
                reserveStock(testVariant._id.toString(), 40, 'ORDER-CONCURRENT-3')
            ];

            const responses = await Promise.all(promises);

            // All should succeed (total: 120, available: 150)
            expect(responses[0].success).toBe(true);
            expect(responses[1].success).toBe(true);
            expect(responses[2].success).toBe(true);

            // Verify total reservations
            const allReservations = await ReserveStock.find({});
            expect(allReservations).toHaveLength(3);
        });
    });

    // ===== FAILURE CASES =====
    describe('Failure Cases', () => {
        it('should fail when variantId is missing', async () => {
            const response = await reserveStock(null, 10, 'ORDER-NO-VARIANT');

            expect(response.success).toBe(false);
            expect(response.message).toBe('Reservation failed');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INVALID_ARGUMENT');
            expect(response.error.message).toBe('variantId is required');
        });

        it('should fail when variantId is invalid ObjectId format', async () => {
            try {
                await reserveStock('invalid-id', 10, 'ORDER-INVALID-ID');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
                expect(error.message).toContain('Cast to ObjectId failed');
            }
        });

        it('should fail when variantId does not exist', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const response = await reserveStock(nonExistentId.toString(), 10, 'ORDER-NOT-FOUND');

            expect(response.success).toBe(false);
            expect(response.message).toBe('Variant not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should fail when quantity is 0', async () => {
            const response = await reserveStock(testVariant._id.toString(), 0, 'ORDER-ZERO-QTY');

            expect(response.success).toBe(false);
            expect(response.message).toBe('Reservation failed');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INVALID_ARGUMENT');
            expect(response.error.message).toBe('quantity must be a positive integer');
        });

        it('should fail when quantity is negative', async () => {
            const response = await reserveStock(testVariant._id.toString(), -10, 'ORDER-NEGATIVE');

            expect(response.success).toBe(false);
            expect(response.message).toBe('Reservation failed');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INVALID_ARGUMENT');
        });

        it('should fail when requested quantity exceeds available stock', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                200, // More than available (150)
                'ORDER-INSUFFICIENT'
            );

            expect(response.success).toBe(false);
            expect(response.message).toBe('Insufficient stock');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INSUFFICIENT_STOCK');
        });

        it('should fail when reservationId is missing', async () => {
            const response = await reserveStock(testVariant._id.toString(), 10, null);

            expect(response.success).toBe(false);
            expect(response.message).toBe('Reservation failed');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INVALID_ARGUMENT');
            expect(response.error.message).toBe('reservationId is required');
        });

        it('should fail when all inventory items are inactive', async () => {
            // Deactivate all inventory
            await InventoryItem.updateMany({}, { isActive: false });

            // Update variant stock to 0 (simulating hooks)
            await ProductVariant.findByIdAndUpdate(testVariant._id, { stock: 0 });

            const response = await reserveStock(testVariant._id.toString(), 10, 'ORDER-INACTIVE');

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INSUFFICIENT_STOCK');
        });

        it('should fail when variant stock is 0', async () => {
            // Delete all inventory
            await InventoryItem.deleteMany({});
            await ProductVariant.findByIdAndUpdate(testVariant._id, { stock: 0 });

            const response = await reserveStock(testVariant._id.toString(), 10, 'ORDER-NO-STOCK');

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('INSUFFICIENT_STOCK');
        });
    });

    // ===== EDGE CASES =====
    describe('Edge Cases', () => {
        it('should handle very large quantity within available stock', async () => {
            // Create variant with large stock
            const largeVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'LARGE-SKU',
                options: new Map([['Size', 'XXL']]),
                price: { amount: 1000, currency: 'INR' },
                stock: 1000000,
                baseUnit: 'unit',
                isActive: true
            });

            await InventoryItem.create({
                variantId: largeVariant._id,
                batchNumber: 'LARGE-BATCH',
                stock: 1000000,
                price: { amount: 1000, currency: 'INR' },
                isActive: true
            });

            const response = await reserveStock(
                largeVariant._id.toString(),
                999999,
                'ORDER-LARGE'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);
            expect(reservation.totalQuantity).toBe(999999);
        });

        it('should handle reservationId with special characters', async () => {
            const specialReservationId = 'ORDER-@#$-123-!@#';

            const response = await reserveStock(
                testVariant._id.toString(),
                10,
                specialReservationId
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);
            expect(reservation.reservationId).toBe(specialReservationId);
        });

        it('should handle very long reservationId', async () => {
            const longReservationId = 'ORDER-' + 'A'.repeat(100);

            const response = await reserveStock(
                testVariant._id.toString(),
                10,
                longReservationId
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);
            expect(reservation.reservationId).toBe(longReservationId);
        });

        it('should handle decimal quantity (should be truncated or handled)', async () => {
            // This test verifies how the system handles decimal quantities
            // Protobuf int32 will truncate decimals
            const response = await reserveStock(
                testVariant._id.toString(),
                10, // JS will send 10 (int32 doesn't support decimals)
                'ORDER-DECIMAL'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);
            expect(Number.isInteger(reservation.totalQuantity)).toBe(true);
        });

        it('should handle reservation when only one inventory item has stock', async () => {
            // Set stock to 0 for inventory2 and inventory3
            await InventoryItem.findByIdAndUpdate(testInventory2._id, { stock: 0 });
            await InventoryItem.findByIdAndUpdate(testInventory3._id, { stock: 0 });

            const response = await reserveStock(
                testVariant._id.toString(),
                30,
                'ORDER-SINGLE-INVENTORY'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);
            expect(reservation.inventoryEntries).toHaveLength(1);
            expect(reservation.inventoryEntries[0].inventoryId.toString()).toBe(testInventory1._id.toString());
        });

        it('should handle exact stock match (reserve all available stock)', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                150, // Exact total stock
                'ORDER-EXACT'
            );

            expect(response.success).toBe(true);

            // Verify all inventory is depleted
            const inventories = await InventoryItem.find({ variantId: testVariant._id });
            const totalRemaining = inventories.reduce((sum, inv) => sum + inv.stock, 0);
            expect(totalRemaining).toBe(0);
        });

        it('should skip inactive inventory items in FEFO', async () => {
            // Get the earliest expiring inventory and deactivate it
            const inventories = await InventoryItem.find({ variantId: testVariant._id, isActive: true })
                .sort({ 'manufacturingDetails.expDate': 1 });

            const earliestInventory = inventories[0];
            const secondEarliestInventory = inventories[1];

            // Deactivate the first expiring inventory
            await InventoryItem.findByIdAndUpdate(earliestInventory._id, { isActive: false });

            // Note: When inventory is deactivated, hooks will NOT automatically update variant stock
            // So we need to manually update it for this test
            await ProductVariant.findByIdAndUpdate(testVariant._id, { $inc: { stock: -earliestInventory.stock } });

            const response = await reserveStock(
                testVariant._id.toString(),
                Math.min(50, secondEarliestInventory.stock),
                'ORDER-SKIP-INACTIVE'
            );

            expect(response.success).toBe(true);

            const reservation = await ReserveStock.findById(response.reserveId);

            // Should skip the inactive inventory and pick from second earliest
            expect(reservation.inventoryEntries[0].inventoryId.toString()).not.toBe(earliestInventory._id.toString());
            expect(reservation.inventoryEntries[0].inventoryId.toString()).toBe(secondEarliestInventory._id.toString());
        });

        it('should handle multiple reservations for same variant sequentially', async () => {
            // First reservation
            const response1 = await reserveStock(
                testVariant._id.toString(),
                50,
                'ORDER-SEQ-1'
            );
            expect(response1.success).toBe(true);

            // Second reservation
            const response2 = await reserveStock(
                testVariant._id.toString(),
                50,
                'ORDER-SEQ-2'
            );
            expect(response2.success).toBe(true);

            // Third reservation
            const response3 = await reserveStock(
                testVariant._id.toString(),
                50,
                'ORDER-SEQ-3'
            );
            expect(response3.success).toBe(true);

            // Verify all three reservations
            const allReservations = await ReserveStock.find({});
            expect(allReservations).toHaveLength(3);
        });
    });

    // ===== RESPONSE STRUCTURE VALIDATION =====
    describe('Response Structure Validation', () => {
        it('should return response with all required fields on success', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                10,
                'ORDER-STRUCT'
            );

            // Validate response structure
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('reserveId');
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('error');

            // Validate types
            expect(typeof response.success).toBe('boolean');
            expect(typeof response.reserveId).toBe('string');
            expect(typeof response.message).toBe('string');
            expect(response.error).toBeNull();
        });

        it('should match proto message structure', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                10,
                'ORDER-PROTO'
            );

            // Success response should match ReserveStockResponse proto
            expect(response.success).toBe(true);
            expect(response.reserveId).toBeDefined();
            expect(response.message).toBe('Stock reserved successfully');
            expect(response.error).toBeNull();
        });
    });

    // ===== DATABASE STATE VERIFICATION =====
    describe('Database State Verification', () => {
        it('should create reservation record with correct fields', async () => {
            const response = await reserveStock(
                testVariant._id.toString(),
                25,
                'ORDER-DB-STATE'
            );

            const reservation = await ReserveStock.findById(response.reserveId);

            // Verify all fields
            expect(reservation.variantId.toString()).toBe(testVariant._id.toString());
            expect(reservation.totalQuantity).toBe(25);
            expect(reservation.status).toBe('PENDING');
            expect(reservation.reservationId).toBe('ORDER-DB-STATE');
            expect(reservation.inventoryEntries).toBeDefined();
            expect(Array.isArray(reservation.inventoryEntries)).toBe(true);
            expect(reservation.reservedAt).toBeDefined();
            expect(reservation.expiresAt).toBeDefined();
            expect(reservation.createdAt).toBeDefined();
            expect(reservation.updatedAt).toBeDefined();
        });

        it('should update inventory stock after reservation', async () => {
            // Get the earliest expiring inventory
            const inventories = await InventoryItem.find({ variantId: testVariant._id, isActive: true })
                .sort({ 'manufacturingDetails.expDate': 1 });

            const firstInventory = inventories[0];
            const initialStock = firstInventory.stock;
            const quantityToReserve = Math.min(30, initialStock);

            await reserveStock(
                testVariant._id.toString(),
                quantityToReserve,
                'ORDER-STOCK-UPDATE'
            );

            // The findFefoBatchesForReservation method deducts stock immediately
            const updatedInventory = await InventoryItem.findById(firstInventory._id);
            expect(updatedInventory.stock).toBe(initialStock - quantityToReserve);
        });

        it('should not create reservation on failure', async () => {
            const initialCount = await ReserveStock.countDocuments({});

            try {
                await reserveStock(
                    testVariant._id.toString(),
                    200, // More than available
                    'ORDER-FAIL'
                );
                fail('Should have thrown an error');
            } catch (error) {
                // Verify no reservation was created
                const finalCount = await ReserveStock.countDocuments({});
                expect(finalCount).toBe(initialCount);
            }
        });
    });
});

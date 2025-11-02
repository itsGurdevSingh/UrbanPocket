import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import mongoose from 'mongoose';
import ProductVariant from '../../src/models/variant.model.js';
import Product from '../../src/models/product.model.js';
import { startGrpcServer, stopGrpcServer } from '../../src/grpc/server/index.js';

// Get proto path relative to project root
const PROTO_PATH = path.join(process.cwd(), 'protos', 'product.proto');

describe('gRPC GetVariantDetails', () => {
    let client;
    let testProduct;
    let testVariant;
    const GRPC_PORT = '50099'; // Use different port for testing

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
            stock: 100,
            baseUnit: 'kg',
            variantImages: [
                {
                    fileId: 'var-img-1',
                    url: 'https://cdn.example.com/variant1.jpg',
                    altText: 'Red variant',
                    name: 'variant1.jpg'
                }
            ],
            isActive: true
        });
    });

    afterEach(async () => {
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
    });

    // Helper function to promisify gRPC call
    const getVariantDetails = (variantId) => {
        return new Promise((resolve, reject) => {
            client.GetVariantDetails({ variantId }, (error, response) => {
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
        it('should retrieve variant details successfully with valid variantId', async () => {
            const response = await getVariantDetails(testVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.message).toBe('Variant retrieved successfully');
            expect(response.variant).toBeDefined();
            expect(response.variant.id).toBe(testVariant._id.toString());
            expect(response.variant.productId).toBe(testProduct._id.toString());
            expect(response.variant.sku).toBe('TEST-SKU-001');
            expect(response.variant.options).toEqual({ Color: 'Red', Size: 'M' });
            expect(response.variant.price.amount).toBe(500);
            expect(response.variant.price.currency).toBe('INR');
            expect(response.variant.stock).toBe(100);
            expect(response.variant.baseUnit).toBe('kg');
            expect(response.variant.isActive).toBe(true);
            expect(response.variant.variantImages).toHaveLength(1);
            expect(response.variant.variantImages[0].url).toBe('https://cdn.example.com/variant1.jpg');
            expect(response.error).toBeNull();
        });

        it('should retrieve variant with multiple images', async () => {
            // Create variant with multiple images
            const variantWithImages = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'TEST-SKU-002',
                options: new Map([['Color', 'Blue']]),
                price: { amount: 600, currency: 'USD' },
                stock: 50,
                baseUnit: 'unit',
                variantImages: [
                    { fileId: 'img-1', url: 'https://cdn.example.com/img1.jpg', altText: 'Front view' },
                    { fileId: 'img-2', url: 'https://cdn.example.com/img2.jpg', altText: 'Back view' },
                    { fileId: 'img-3', url: 'https://cdn.example.com/img3.jpg', altText: 'Side view' }
                ],
                isActive: true
            });

            const response = await getVariantDetails(variantWithImages._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.variantImages).toHaveLength(3);
            expect(response.variant.variantImages[0].altText).toBe('Front view');
            expect(response.variant.variantImages[1].altText).toBe('Back view');
            expect(response.variant.variantImages[2].altText).toBe('Side view');
        });

        it('should retrieve variant with no images', async () => {
            // Create variant without images
            const variantNoImages = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'TEST-SKU-003',
                options: new Map([['Size', 'L']]),
                price: { amount: 700, currency: 'EUR' },
                stock: 25,
                baseUnit: 'piece',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(variantNoImages._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.variantImages).toHaveLength(0);
        });

        it('should retrieve inactive variant', async () => {
            // Create inactive variant
            const inactiveVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'TEST-SKU-INACTIVE',
                options: new Map([['Status', 'Inactive']]),
                price: { amount: 100, currency: 'INR' },
                stock: 0,
                baseUnit: 'kg',
                variantImages: [],
                isActive: false
            });

            const response = await getVariantDetails(inactiveVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.isActive).toBe(false);
        });

        it('should retrieve variant with zero stock', async () => {
            // Create variant with zero stock
            const zeroStockVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'TEST-SKU-ZERO',
                options: new Map([['Stock', 'Zero']]),
                price: { amount: 200, currency: 'INR' },
                stock: 0,
                baseUnit: 'unit',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(zeroStockVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.stock).toBe(0);
        });

        it('should retrieve variant with decimal price', async () => {
            // Create variant with decimal price
            const decimalPriceVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'TEST-SKU-DECIMAL',
                options: new Map([['Price', 'Decimal']]),
                price: { amount: 99.99, currency: 'USD' },
                stock: 15,
                baseUnit: 'kg',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(decimalPriceVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.price.amount).toBe(99.99);
        });

        it('should retrieve variant with complex options', async () => {
            // Create variant with multiple options
            const complexVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'TEST-SKU-COMPLEX',
                options: new Map([
                    ['Color', 'Red'],
                    ['Size', 'XL'],
                    ['Material', 'Cotton'],
                    ['Style', 'Casual']
                ]),
                price: { amount: 1500, currency: 'INR' },
                stock: 50,
                baseUnit: 'piece',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(complexVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.options).toEqual({
                Color: 'Red',
                Size: 'XL',
                Material: 'Cotton',
                Style: 'Casual'
            });
        });
    });

    // ===== FAILURE CASES =====
    describe('Failure Cases', () => {
        it('should return error when variantId is missing', async () => {
            const response = await getVariantDetails('');

            expect(response.success).toBe(false);
            expect(response.variant).toBeNull();
            expect(response.message).toBe('Variant not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
            expect(response.error.message).toBe('variantId is required');
            expect(response.error.details).toContain('variantId parameter is missing');
        });

        it('should return error when variant does not exist', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const response = await getVariantDetails(nonExistentId.toString());

            expect(response.success).toBe(false);
            expect(response.variant).toBeNull();
            expect(response.message).toBe('Variant not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
            expect(response.error.message).toContain('Variant not found');
            expect(response.error.details[0]).toContain(nonExistentId.toString());
        });

        it('should throw error when variantId has invalid format', async () => {
            const invalidId = 'invalid_id_format';

            try {
                await getVariantDetails(invalidId);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
                expect(error.message).toContain('Cast to ObjectId failed');
            }
        });

        it('should throw error when variantId is null', async () => {
            try {
                await getVariantDetails(null);
                fail('Should have thrown an error');
            } catch (error) {
                // gRPC will handle null/undefined differently
                expect(error).toBeDefined();
            }
        });

        it('should throw error when variantId is undefined', async () => {
            try {
                await getVariantDetails(undefined);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        it('should throw error when variantId is too short', async () => {
            const shortId = '123';

            try {
                await getVariantDetails(shortId);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should throw error when variantId contains special characters', async () => {
            const specialCharId = '507f1f77bcf86cd799439@#$';

            try {
                await getVariantDetails(specialCharId);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
            }
        });

        it('should throw error when variantId is a valid ObjectId but too long string', async () => {
            const longId = '507f1f77bcf86cd799439011507f1f77bcf86cd799439011';

            try {
                await getVariantDetails(longId);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
            }
        });
    });

    // ===== EDGE CASES =====
    describe('Edge Cases', () => {
        it('should handle variant with empty SKU', async () => {
            const emptySKUVariant = await ProductVariant.create({
                productId: testProduct._id,
                options: new Map([['Color', 'Green']]),
                price: { amount: 300, currency: 'INR' },
                stock: 10,
                baseUnit: 'kg',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(emptySKUVariant._id.toString());

            expect(response.success).toBe(true);
            // SKU is auto-generated in pre-save hook, so it should exist
            expect(response.variant.sku).toBeDefined();
            expect(typeof response.variant.sku).toBe('string');
        });

        it('should handle variant with minimum price (0)', async () => {
            const minPriceVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'FREE-ITEM',
                options: new Map([['Price', 'Free']]),
                price: { amount: 0, currency: 'INR' },
                stock: 100,
                baseUnit: 'unit',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(minPriceVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.price.amount).toBe(0);
        });

        it('should handle variant with very large stock', async () => {
            const largeStockVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'LARGE-STOCK',
                options: new Map([['Stock', 'Large']]),
                price: { amount: 100, currency: 'INR' },
                stock: 999999,
                baseUnit: 'unit',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(largeStockVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.stock).toBe(999999);
        });

        it('should handle variant with very high price', async () => {
            const highPriceVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'EXPENSIVE',
                options: new Map([['Type', 'Premium']]),
                price: { amount: 999999.99, currency: 'USD' },
                stock: 1,
                baseUnit: 'piece',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(highPriceVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.price.amount).toBe(999999.99);
        });

        it('should handle variant with different currency', async () => {
            const eurVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'EUR-VARIANT',
                options: new Map([['Currency', 'EUR']]),
                price: { amount: 500, currency: 'EUR' },
                stock: 50,
                baseUnit: 'kg',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(eurVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.price.currency).toBe('EUR');
        });

        it('should handle variant with single option', async () => {
            const singleOptionVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SINGLE-OPT',
                options: new Map([['Size', 'One Size']]),
                price: { amount: 250, currency: 'INR' },
                stock: 30,
                baseUnit: 'piece',
                variantImages: [],
                isActive: true
            });

            const response = await getVariantDetails(singleOptionVariant._id.toString());

            expect(response.success).toBe(true);
            expect(Object.keys(response.variant.options)).toHaveLength(1);
            expect(response.variant.options.Size).toBe('One Size');
        });

        it('should handle variant with image without altText', async () => {
            const noAltTextVariant = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'NO-ALT',
                options: new Map([['Image', 'NoAlt']]),
                price: { amount: 400, currency: 'INR' },
                stock: 20,
                baseUnit: 'kg',
                variantImages: [
                    { fileId: 'img-1', url: 'https://cdn.example.com/img1.jpg' }
                ],
                isActive: true
            });

            const response = await getVariantDetails(noAltTextVariant._id.toString());

            expect(response.success).toBe(true);
            expect(response.variant.variantImages[0].altText).toBe('');
        });
    });

    // ===== RESPONSE STRUCTURE VALIDATION =====
    describe('Response Structure Validation', () => {
        it('should return response with all required fields on success', async () => {
            const response = await getVariantDetails(testVariant._id.toString());

            // Top-level response structure
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('variant');
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('error');

            // Variant structure
            expect(response.variant).toHaveProperty('id');
            expect(response.variant).toHaveProperty('productId');
            expect(response.variant).toHaveProperty('sku');
            expect(response.variant).toHaveProperty('options');
            expect(response.variant).toHaveProperty('price');
            expect(response.variant).toHaveProperty('stock');
            expect(response.variant).toHaveProperty('baseUnit');
            expect(response.variant).toHaveProperty('variantImages');
            expect(response.variant).toHaveProperty('isActive');

            // Price structure
            expect(response.variant.price).toHaveProperty('amount');
            expect(response.variant.price).toHaveProperty('currency');

            // Variant images array
            expect(Array.isArray(response.variant.variantImages)).toBe(true);
            if (response.variant.variantImages.length > 0) {
                expect(response.variant.variantImages[0]).toHaveProperty('url');
                expect(response.variant.variantImages[0]).toHaveProperty('altText');
                expect(response.variant.variantImages[0]).toHaveProperty('fileId');
            }
        });

        it('should return error response with proper structure on failure', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            const response = await getVariantDetails(nonExistentId.toString());

            expect(response).toHaveProperty('success', false);
            expect(response).toHaveProperty('variant', null);
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('error');

            // Check error structure
            expect(response.error).toHaveProperty('code');
            expect(response.error).toHaveProperty('message');
            expect(response.error).toHaveProperty('details');
            expect(Array.isArray(response.error.details)).toBe(true);
        });
    });
});

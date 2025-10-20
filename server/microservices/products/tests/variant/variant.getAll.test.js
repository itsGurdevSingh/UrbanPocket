import request from 'supertest';
import app from '../../src/app.js';
import mongoose from 'mongoose';
import ProductVariant from '../../src/models/variant.model.js';
import Product from '../../src/models/product.model.js';
import Category from '../../src/models/category.model.js';

describe('GET /api/variant/getAll', () => {
    let testCategory;
    let testProduct;
    let sellerId;

    beforeEach(async () => {
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
        await Category.deleteMany({});

        // Create test category
        testCategory = await Category.create({
            name: 'Electronics',
            description: 'Electronic items'
        });

        // Create seller ID
        sellerId = new mongoose.Types.ObjectId();

        // Create test product
        testProduct = await Product.create({
            name: 'Test Product',
            description: 'Test Description',
            categoryId: testCategory._id,
            sellerId: sellerId,
            brand: 'TestBrand',
            baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
            isActive: true
        });
    });

    afterEach(async () => {
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
        await Category.deleteMany({});
    });

    // ===== SUCCESS CASES =====
    describe('success cases', () => {
        it('returns all variants with default pagination', async () => {
            // Create 3 variants
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red', Size: 'M' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }],
                isActive: true
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Color: 'Blue', Size: 'L' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }],
                isActive: true
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-003',
                options: { Color: 'Green', Size: 'S' },
                price: { amount: 80, currency: 'INR' },
                stock: 15,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v3.jpg', fileId: 'v3' }],
                isActive: true
            });

            const res = await request(app)
                .get('/api/variant/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Variants fetched successfully');
            expect(res.body.data).toHaveProperty('variants');
            expect(res.body.data).toHaveProperty('meta');
            expect(res.body.data.variants).toHaveLength(3);
            expect(res.body.data.meta.total).toBe(3);
            expect(res.body.data.meta.page).toBe(1);
            expect(res.body.data.meta.limit).toBe(20);
        });

        it('returns empty array when no variants exist', async () => {
            const res = await request(app)
                .get('/api/variant/getAll')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.variants).toEqual([]);
            expect(res.body.data.meta.total).toBe(0);
        });

        it('returns variants sorted by createdAt descending (newest first)', async () => {
            const variant1 = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });
            await new Promise(resolve => setTimeout(resolve, 10));

            const variant2 = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });
            await new Promise(resolve => setTimeout(resolve, 10));

            const variant3 = await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-003',
                options: { Color: 'Green' },
                price: { amount: 80, currency: 'INR' },
                stock: 15,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v3.jpg', fileId: 'v3' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll')
                .expect(200);

            expect(res.body.data.variants[0].sku).toBe('SKU-003'); // Newest
            expect(res.body.data.variants[1].sku).toBe('SKU-002');
            expect(res.body.data.variants[2].sku).toBe('SKU-001'); // Oldest
        });

        it('handles pagination with page and limit', async () => {
            // Create 25 variants
            for (let i = 1; i <= 25; i++) {
                await ProductVariant.create({
                    productId: testProduct._id,
                    sku: `SKU-${String(i).padStart(3, '0')}`,
                    options: { Number: i },
                    price: { amount: 100 * i, currency: 'INR' },
                    stock: i * 2,
                    baseUnit: 'unit',
                    variantImages: [{ url: `http://example.com/v${i}.jpg`, fileId: `v${i}` }]
                });
            }

            const res = await request(app)
                .get('/api/variant/getAll?page=2&limit=10')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(10);
            expect(res.body.data.meta.page).toBe(2);
            expect(res.body.data.meta.limit).toBe(10);
            expect(res.body.data.meta.total).toBe(25);
            expect(res.body.data.meta.totalPages).toBe(3);
            expect(res.body.data.meta.hasNextPage).toBe(true);
            expect(res.body.data.meta.hasPrevPage).toBe(true);
        });

        it('filters variants by productId', async () => {
            const product2 = await Product.create({
                name: 'Product 2',
                description: 'Test',
                categoryId: testCategory._id,
                sellerId: sellerId,
                brand: 'TestBrand',
                baseImages: [{ url: 'http://example.com/image.jpg', fileId: 'file1' }],
                isActive: true
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: product2._id,
                sku: 'SKU-002',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            const res = await request(app)
                .get(`/api/variant/getAll?productId=${testProduct._id}`)
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].sku).toBe('SKU-001');
        });

        it('filters variants by SKU', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'UNIQUE-SKU',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'OTHER-SKU',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?sku=UNIQUE-SKU')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].sku).toBe('UNIQUE-SKU');
        });

        it('filters variants by isActive status', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }],
                isActive: true
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }],
                isActive: false
            });

            const res = await request(app)
                .get('/api/variant/getAll?isActive=true')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].isActive).toBe(true);
        });

        it('filters variants by price range', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 50, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-003',
                options: { Color: 'Green' },
                price: { amount: 300, currency: 'INR' },
                stock: 15,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v3.jpg', fileId: 'v3' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?priceMin=100&priceMax=200')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].price.amount).toBe(150);
        });

        it('filters variants by stock range', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 15,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-003',
                options: { Color: 'Green' },
                price: { amount: 200, currency: 'INR' },
                stock: 25,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v3.jpg', fileId: 'v3' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?stockMin=10&stockMax=20')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].stock).toBe(15);
        });

        it('searches variants by SKU with text search', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'PREMIUM-RED-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'STANDARD-BLUE-002',
                options: { Color: 'Blue' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?q=PREMIUM')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].sku).toContain('PREMIUM');
        });

        it('filters variants by currency', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Color: 'Blue' },
                price: { amount: 10, currency: 'USD' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?currency=USD')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].price.currency).toBe('USD');
        });

        it('filters variants by baseUnit', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Weight: '1kg' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'kg',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-002',
                options: { Weight: '1L' },
                price: { amount: 150, currency: 'INR' },
                stock: 5,
                baseUnit: 'liter',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?baseUnit=kg')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].baseUnit).toBe('kg');
        });

        it('returns proper response structure', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll')
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveProperty('variants');
            expect(res.body.data).toHaveProperty('meta');
            expect(res.body.data.meta).toHaveProperty('page');
            expect(res.body.data.meta).toHaveProperty('limit');
            expect(res.body.data.meta).toHaveProperty('total');
            expect(res.body.data.meta).toHaveProperty('totalPages');
            expect(res.body.data.meta).toHaveProperty('hasNextPage');
            expect(res.body.data.meta).toHaveProperty('hasPrevPage');
        });
    });

    // ===== EDGE CASES =====
    describe('edge cases', () => {
        it('handles large page numbers gracefully', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll?page=100')
                .expect(200);

            expect(res.body.data.variants).toEqual([]);
            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        it('returns correct totalPages calculation', async () => {
            // Create 23 variants
            for (let i = 1; i <= 23; i++) {
                await ProductVariant.create({
                    productId: testProduct._id,
                    sku: `SKU-${String(i).padStart(3, '0')}`,
                    options: { Number: i },
                    price: { amount: 100, currency: 'INR' },
                    stock: 10,
                    baseUnit: 'unit',
                    variantImages: [{ url: `http://example.com/v${i}.jpg`, fileId: `v${i}` }]
                });
            }

            const res = await request(app)
                .get('/api/variant/getAll?limit=10')
                .expect(200);

            expect(res.body.data.meta.totalPages).toBe(3); // 23 items / 10 per page = 3 pages
        });

        it('handles page at exact boundary', async () => {
            // Create 20 variants (exactly 2 pages with limit 10)
            for (let i = 1; i <= 20; i++) {
                await ProductVariant.create({
                    productId: testProduct._id,
                    sku: `SKU-${String(i).padStart(3, '0')}`,
                    options: { Number: i },
                    price: { amount: 100, currency: 'INR' },
                    stock: 10,
                    baseUnit: 'unit',
                    variantImages: [{ url: `http://example.com/v${i}.jpg`, fileId: `v${i}` }]
                });
            }

            const res = await request(app)
                .get('/api/variant/getAll?page=2&limit=10')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(10);
            expect(res.body.data.meta.totalPages).toBe(2);
            expect(res.body.data.meta.hasNextPage).toBe(false);
            expect(res.body.data.meta.hasPrevPage).toBe(true);
        });

        it('uses default values when pagination params not provided', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'SKU-001',
                options: { Color: 'Red' },
                price: { amount: 100, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }]
            });

            const res = await request(app)
                .get('/api/variant/getAll')
                .expect(200);

            expect(res.body.data.meta.page).toBe(1); // default page
            expect(res.body.data.meta.limit).toBe(20); // default limit
        });

        it('handles custom limit correctly', async () => {
            // Create 10 variants
            for (let i = 1; i <= 10; i++) {
                await ProductVariant.create({
                    productId: testProduct._id,
                    sku: `SKU-${String(i).padStart(3, '0')}`,
                    options: { Number: i },
                    price: { amount: 100, currency: 'INR' },
                    stock: 10,
                    baseUnit: 'unit',
                    variantImages: [{ url: `http://example.com/v${i}.jpg`, fileId: `v${i}` }]
                });
            }

            const res = await request(app)
                .get('/api/variant/getAll?limit=5')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(5);
            expect(res.body.data.meta.limit).toBe(5);
            expect(res.body.data.meta.totalPages).toBe(2); // 10 variants / 5 per page
        });

        it('returns hasNextPage=false on last page', async () => {
            // Create 5 variants
            for (let i = 1; i <= 5; i++) {
                await ProductVariant.create({
                    productId: testProduct._id,
                    sku: `SKU-${String(i).padStart(3, '0')}`,
                    options: { Number: i },
                    price: { amount: 100, currency: 'INR' },
                    stock: 10,
                    baseUnit: 'unit',
                    variantImages: [{ url: `http://example.com/v${i}.jpg`, fileId: `v${i}` }]
                });
            }

            const res = await request(app)
                .get('/api/variant/getAll?page=1&limit=10')
                .expect(200);

            expect(res.body.data.meta.hasNextPage).toBe(false);
        });

        it('returns hasPrevPage=false on first page', async () => {
            // Create 25 variants
            for (let i = 1; i <= 25; i++) {
                await ProductVariant.create({
                    productId: testProduct._id,
                    sku: `SKU-${String(i).padStart(3, '0')}`,
                    options: { Number: i },
                    price: { amount: 100, currency: 'INR' },
                    stock: 10,
                    baseUnit: 'unit',
                    variantImages: [{ url: `http://example.com/v${i}.jpg`, fileId: `v${i}` }]
                });
            }

            const res = await request(app)
                .get('/api/variant/getAll?page=1&limit=10')
                .expect(200);

            expect(res.body.data.meta.hasPrevPage).toBe(false);
        });

        it('handles multiple filters combined', async () => {
            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'PREMIUM-RED-001',
                options: { Color: 'Red', Size: 'M' },
                price: { amount: 150, currency: 'INR' },
                stock: 10,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v1.jpg', fileId: 'v1' }],
                isActive: true
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'PREMIUM-BLUE-002',
                options: { Color: 'Blue', Size: 'L' },
                price: { amount: 250, currency: 'INR' },
                stock: 5,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v2.jpg', fileId: 'v2' }],
                isActive: true
            });

            await ProductVariant.create({
                productId: testProduct._id,
                sku: 'STANDARD-RED-003',
                options: { Color: 'Red', Size: 'S' },
                price: { amount: 100, currency: 'INR' },
                stock: 3,
                baseUnit: 'unit',
                variantImages: [{ url: 'http://example.com/v3.jpg', fileId: 'v3' }],
                isActive: false
            });

            const res = await request(app)
                .get('/api/variant/getAll?isActive=true&priceMin=100&priceMax=200&q=PREMIUM')
                .expect(200);

            expect(res.body.data.variants).toHaveLength(1);
            expect(res.body.data.variants[0].sku).toBe('PREMIUM-RED-001');
        });
    });
});

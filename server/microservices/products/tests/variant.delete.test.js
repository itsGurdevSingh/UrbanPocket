import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import productModel from '../src/models/product.model.js';
import variantModel from '../src/models/variant.model.js';

// Mock upload service to observe deleteImages calls
jest.mock('../src/services/upload.service.js', () => ({
  __esModule: true,
  default: {
    uploadImagesToCloud: jest.fn(async () => []),
    executeWithUploadRollback: jest.fn(async (_images, action) => action(_images)),
    deleteImages: jest.fn(async () => true),
  }
}));
import uploadService from '../src/services/upload.service.js';

async function createProductForSeller(sellerId, overrides = {}) {
  const base = {
    name: `Product-${Math.random().toString(36).slice(2, 8)}`,
    description: 'Variant parent product',
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
    sku: 'SKU-ORIG',
    options: { Color: 'Red', Size: 'M' },
    price: 100,
    currency: 'INR',
    stock: 5,
    baseUnit: 'unit',
    variantImages: [
      { url: 'https://cdn.example.com/variant-a.jpg', fileId: 'ik-old-a' },
      { url: 'https://cdn.example.com/variant-b.jpg', fileId: 'ik-old-b' },
    ],
    isActive: true
  };
  return variantModel.create({ ...base, ...overrides });
}

describe('DELETE /api/variant/:id - delete variant', () => {
  let sellerId;
  beforeEach(async () => {
    sellerId = new mongoose.Types.ObjectId();
    if (global.setTestAuthRole) global.setTestAuthRole('seller');
    if (global.setTestAuthUserId) global.setTestAuthUserId(sellerId.toString());
    uploadService.deleteImages.mockClear();
  });

  test('success: seller owner deletes variant and images are queued for deletion', async () => {
    const product = await createProductForSeller(sellerId);
    const variant = await createVariant(product._id);
    const res = await request(app).delete(`/api/variant/${variant._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/i);
    expect(uploadService.deleteImages).toHaveBeenCalledTimes(1);
    const [fileIdsArg] = uploadService.deleteImages.mock.calls[0];
    expect(fileIdsArg).toEqual(['ik-old-a', 'ik-old-b']);
  });

  test('success: admin deletes variant', async () => {
    const product = await createProductForSeller(sellerId);
    const variant = await createVariant(product._id);
    if (global.setTestAuthRole) global.setTestAuthRole('admin');
    const res = await request(app).delete(`/api/variant/${variant._id}`);
    expect(res.status).toBe(200);
  });

  test('error: seller not owner', async () => {
    const otherSeller = new mongoose.Types.ObjectId();
    const product = await createProductForSeller(otherSeller);
    const variant = await createVariant(product._id);
    const res = await request(app).delete(`/api/variant/${variant._id}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_NOT_OWNER');
  });

  test('error: product inactive', async () => {
    const product = await createProductForSeller(sellerId, { isActive: false });
    const variant = await createVariant(product._id);
    const res = await request(app).delete(`/api/variant/${variant._id}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRODUCT_INACTIVE');
  });

  test('validation: invalid id', async () => {
    const res = await request(app).delete('/api/variant/not-a-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

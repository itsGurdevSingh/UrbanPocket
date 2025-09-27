import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

// PATCH /api/auth/updateAddress
describe('PATCH /api/auth/updateAddress', () => {
    let createdUser;
    let accessToken;
    let addressId;
    const initialAddress = { street: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '12345', country: 'USA' };

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        createdUser = await User.create({
            username: `updateAddressTest_${Date.now()}`,
            contactInfo: { email: `updateaddress${Date.now()}@example.com` },
            password: hashedPassword,
            addresses: [initialAddress],
        });
        // ensure addressId is a string (mongoose _id -> toString)
        addressId = createdUser.addresses[0]._id.toString();

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ identifier: createdUser.username, password: 'password123' });

        const accessCookie = loginResponse.headers['set-cookie']?.find(c => c.startsWith('accessToken='));
        accessToken = accessCookie?.split(';')[0].split('=')[1];
    });

    it('should update an existing address for an authenticated user', async () => {
        const updatedAddress = { street: '456 Oak Ave', city: 'Newtown', state: 'NY', zipCode: '67890', country: 'USA' };
        const res = await request(app)
            .patch('/api/auth/updateAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({ addressId, addressData: updatedAddress });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Address updated successfully');
        expect(res.body.address).toMatchObject(updatedAddress);

        // Verify in DB
        const updatedUser = await User.findById(createdUser._id);
        expect(updatedUser.addresses).toEqual(
            expect.arrayContaining([expect.objectContaining(updatedAddress)])
        );
    });

    it('should return 401 for an unauthenticated user', async () => {
        const res = await request(app)
            .patch('/api/auth/updateAddress')
            .set('Cookie', [`accessToken=invalidtoken`])
            .send({ addressId, addressData: { street: '456 Oak Ave', city: 'Newtown', state: 'NY', zipCode: '67890', country: 'USA' } });

        // The global error handler returns { status: 'error', error: message }
        expect(res.statusCode).toBe(401);
        expect(res.body).toHaveProperty('status', 'error');
        expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for a non-existent address', async () => {
        const fakeId = '64b64c4f4f4f4f4f4f4f4f4f';
        const res = await request(app)
            .patch('/api/auth/updateAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({ addressId: fakeId, addressData: { street: '456 Oak Ave', city: 'Newtown', state: 'NY', zipCode: '67890', country: 'USA' } });

        expect(res.statusCode).toBe(404);
        // Error handler exposes message under 'error'
        expect(res.body).toHaveProperty('status', 'error');
        expect(res.body.error).toMatch(/Address not found/i);
    });

    it('should return 400 for invalid address data (validation error)', async () => {
        // send addressData as object but with an empty required field
        const res = await request(app)
            .patch('/api/auth/updateAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({ addressId, addressData: { street: '', city: 'Newtown', state: 'NY', zipCode: '67890', country: 'USA' } });

        expect(res.statusCode).toBe(400);
        // validator returns { errors: [...] }
        expect(res.body).toHaveProperty('errors');
        expect(Array.isArray(res.body.errors)).toBe(true);
    });
});
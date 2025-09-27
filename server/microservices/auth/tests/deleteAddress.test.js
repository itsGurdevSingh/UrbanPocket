import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

// DELETE /api/auth/deleteAddress
describe('DELETE /api/auth/deleteAddress', () => {
    let createdUser;
    let accessToken;
    let addressId;
    const initialAddress = { street: '100 Elm St', city: 'Oldtown', state: 'TX', zipCode: '75001', country: 'USA' };

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        createdUser = await User.create({
            username: `deleteAddressTest_${Date.now()}`,
            contactInfo: { email: `deleteaddress${Date.now()}@example.com` },
            password: hashedPassword,
            addresses: [initialAddress],
        });

        addressId = createdUser.addresses[0]._id.toString();

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ identifier: createdUser.username, password: 'password123' });

        const accessCookie = loginResponse.headers['set-cookie']?.find(c => c.startsWith('accessToken='));
        accessToken = accessCookie?.split(';')[0].split('=')[1];
    });

    it('should delete an existing address for an authenticated user', async () => {
        const res = await request(app)
            .delete('/api/auth/deleteAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({ addressId });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message', 'Address deleted successfully');

        // Confirm address removed from DB
        const updatedUser = await User.findById(createdUser._id);
        expect(updatedUser.addresses.find(a => a._id.toString() === addressId)).toBeUndefined();
    });

    it('should return 401 for unauthenticated user', async () => {
        const res = await request(app)
            .delete('/api/auth/deleteAddress')
            .set('Cookie', [`accessToken=invalidtoken`])
            .send({ addressId });

        expect(res.statusCode).toBe(401);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toBe('Invalid or expired access token');
    });

    it('should return 404 for non-existent address', async () => {
        const fakeId = '64b64c4f4f4f4f4f4f4f4f4f';
        const res = await request(app)
            .delete('/api/auth/deleteAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({ addressId: fakeId });

        expect(res.statusCode).toBe(404);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toMatch(/Address not found/i);
    });

    it('should return 400 for missing addressId', async () => {
        const res = await request(app)
            .delete('/api/auth/deleteAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('errors');
        expect(Array.isArray(res.body.errors)).toBe(true);
    });
});

// tests/addAddress.test.js
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

describe('POST /api/auth/addAddress', () => {
    let createdUser;
    let accessToken;

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        createdUser = await User.create({
            username: `addressTest_${Date.now()}`,
            contactInfo: { email: `address${Date.now()}@example.com` },
            password: hashedPassword,
        });

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ identifier: createdUser.username, password: 'password123' });

        accessToken = loginResponse.headers['set-cookie']
            .find(c => c.startsWith('accessToken='))
            .split(';')[0]
            .split('=')[1];

    });



    it('should add a new address for an authenticated user', async () => {
        const newAddress = { street: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '12345', country: 'USA' };
        const res = await request(app)
            .post('/api/auth/addAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send(newAddress);

        expect(res.statusCode).toBe(201);
        expect(res.body.message).toBe('Address added successfully');
        expect(res.body.data).toMatchObject(newAddress);

        // Verify in DB
        const updatedUser = await User.findById(createdUser._id);
        expect(updatedUser.addresses).toEqual(
            expect.arrayContaining([expect.objectContaining(newAddress)])
        );
    });

    it('should return 401 for an unauthenticated user', async () => {
        const res = await request(app)
            .post('/api/auth/addAddress')
            .set('Cookie', [`accessToken=invalidtoken`])
            .send({ street: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '12345', country: 'USA' });

        expect(res.statusCode).toBe(401);
    });

    it('should return 400 for invalid address data', async () => {
        const res = await request(app)
            .post('/api/auth/addAddress')
            .set('Cookie', [`accessToken=${accessToken}`])
            .send({ street: '', city: 'Anytown', state: 'CA', zipCode: '12345', country: 'USA' });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toHaveProperty('details');
    });

});


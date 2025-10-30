import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

describe('Read routes: /api/auth/me, /api/auth/health, /api/auth/protected', () => {
    let createdUser;
    let accessToken;

    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        createdUser = await User.create({
            username: `profileTest_${Date.now()}`,
            contactInfo: { email: `profile${Date.now()}@example.com` },
            password: hashedPassword,
        });

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ identifier: createdUser.username, password: 'password123' });

        const accessCookie = loginResponse.headers['set-cookie']?.find(c => c.startsWith('accessToken='));
        accessToken = accessCookie?.split(';')[0].split('=')[1];
    });

    it('GET /api/auth/me should return profile for authenticated user', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', [`accessToken=${accessToken}`]);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('username', createdUser.username);
        expect(res.body.data).toHaveProperty('email', createdUser.contactInfo.email);
    });

    it('GET /api/auth/me should return 401 for unauthenticated user', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', ['accessToken=invalidtoken']);

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('GET /api/auth/health should return 200 OK', async () => {
        const res = await request(app).get('/api/auth/health');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'OK');
    });

    it('GET /api/auth/protected should return 200 for authenticated user', async () => {
        const res = await request(app)
            .get('/api/auth/protected')
            .set('Cookie', [`accessToken=${accessToken}`]);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('data');
    });

    it('GET /api/auth/protected should return 401 for unauthenticated user', async () => {
        const res = await request(app)
            .get('/api/auth/protected')
            .set('Cookie', ['accessToken=invalidtoken']);

        expect(res.statusCode).toBe(401);
    });
});
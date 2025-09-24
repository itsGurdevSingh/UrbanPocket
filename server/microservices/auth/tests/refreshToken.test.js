// tests/refreshToken.test.js
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import getConfig from '../src/config/config_keys.js';

describe('POST /api/auth/refresh-token', () => {
  let refreshToken;
  let createdUser;

  // Use beforeEach to ensure a clean state for every test
  beforeEach(async () => {
    // 1. Create a real user in the database to get a valid _id
    const hashedPassword = await bcrypt.hash('password123', 10);
    createdUser = await User.create({
      username: 'refreshtest',
      contactInfo: { email: 'refresh@example.com' },
      password: hashedPassword,
    });

    // 2. Log the user in to get a REAL refresh token from the server
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'refresh@example.com',
        password: 'password123',
      });

    // 3. Extract the real refresh token from the response cookies
    refreshToken = loginResponse.headers['set-cookie']
      .find(c => c.startsWith('refreshToken='))
      .split(';')[0]
      .split('=')[1];
  });

  it('should return new tokens for a valid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', [`refreshToken=${refreshToken}`]) // Use the real token
      .send();

    // Assert a successful response
    expect(res.statusCode).toBe(200);
    
    // Assert that new cookies are set
    const cookies = res.headers['set-cookie'];
    expect(cookies.some(c => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
  });

  it('should return 401 for an invalid (tampered) refresh token signature', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', [`refreshToken=${refreshToken}invalid`]) // Tamper the token
      .send();

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Could not refresh tokens');
  });

  it('should return 401 if no refresh token is provided', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send(); // Send no cookie

    // Your controller should handle a missing cookie with a 400
    expect(res.statusCode).toBe(400);
  });

  it('should return 401 if the refresh token is expired', async () => {
    // Sign an expired token using the REAL user ID
    const expiredToken = jwt.sign({ userId: createdUser._id }, getConfig('jwtRefreshSecret'), { expiresIn: '-1s' });
    
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', [`refreshToken=${expiredToken}`])
      .send();

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Could not refresh tokens');
  });
});
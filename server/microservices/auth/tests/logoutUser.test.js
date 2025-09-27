// tests/logoutUser.test.js
import request from 'supertest';
import bcrypt from 'bcryptjs';
import Redis from 'ioredis'; // use mocked class
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import { tokenHash } from '../src/utils/auth.utils.js';

const redisClient = new Redis(); // shared mock store instance

describe('POST /api/auth/logout', () => {
  const testUserCredentials = {
    username: 'logoutuser',
    email: 'logout@example.com',
    password: 'password123',
  };
  let accessToken = '';
  let refreshToken = '';

  // Before each test, ensure a clean state and then log in a user.
  beforeEach(async () => {
    // 1. Create a user with a hashed password.
    const hashedPassword = await bcrypt.hash(testUserCredentials.password, 10);
    await User.create({
      username: testUserCredentials.username,
      contactInfo: { email: testUserCredentials.email },
      password: hashedPassword,
    });

    // 2. Log in to get fresh tokens for the test.
    const loginResponse = await request(app).post('/api/auth/login').send({
      identifier: testUserCredentials.email,
      password: testUserCredentials.password,
    });

    // 3. Extract tokens from the response cookies.
    const cookies = loginResponse.headers['set-cookie'];
    accessToken = cookies.find(c => c.startsWith('accessToken=')).split(';')[0].split('=')[1];
    refreshToken = cookies.find(c => c.startsWith('refreshToken=')).split(';')[0].split('=')[1];
  });

  it('should successfully log out, clear cookies, and blacklist tokens', async () => {
    // Action: Perform the logout request.
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`accessToken=${accessToken}`, `refreshToken=${refreshToken}`]);

    // Assert: Check the HTTP response.
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Logged out successfully');

    // Assert: Check that cookies are cleared.
    const responseCookies = response.headers['set-cookie'];
    expect(responseCookies.some(c => c.startsWith('accessToken=;') && c.includes('Max-Age=0'))).toBe(true);
    expect(responseCookies.some(c => c.startsWith('refreshToken=;') && c.includes('Max-Age=0'))).toBe(true);

    //implement sha 256 hashing here for token before checking in redis
    const hashedAccessToken = tokenHash(accessToken);
    const hashedRefreshToken = tokenHash(refreshToken);
    
    // Assert: Check that tokens are blacklisted in Redis.
    const isAccessBlacklisted = await redisClient.get(`bl_${hashedAccessToken}`);
    const isRefreshBlacklisted = await redisClient.get(`bl_${hashedRefreshToken}`);
    expect(isAccessBlacklisted).toBe('true');
    expect(isRefreshBlacklisted).toBe('true');
  });

  it('should prevent a logged-out user from accessing protected routes', async () => {
    // Action: Log the user out to invalidate their tokens.
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`accessToken=${accessToken}`, `refreshToken=${refreshToken}`]);

    // Action: Attempt to access a protected route with the old token.
    const protectedResponse = await request(app)
      .get('/api/auth/protected')
      .set('Cookie', [`accessToken=${accessToken}`]);

    // Assert: The request should be unauthorized.
    expect(protectedResponse.statusCode).toBe(401);
  });
});
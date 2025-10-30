// tests/loginUser.test.js
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import getConfig from '../src/config/config_keys.js';

describe('POST /api/auth/login', () => {

  const testUserCredentials = {
    username: 'loginuser',
    email: 'login@example.com',
    password: 'password123'
  };
  let createdUser;

  // Before each test, create a fresh user with a hashed password
  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash(testUserCredentials.password, 10);
    createdUser = await User.create({
      username: testUserCredentials.username,
      contactInfo: { email: testUserCredentials.email },
      password: hashedPassword
    });
  });

  it('should log in successfully and set accessToken and refreshToken cookies', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUserCredentials.email,
        password: testUserCredentials.password
      });

    // 1. Check for a successful response
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Logged in successfully');

    // 2. Verify that the cookies were set in the response headers
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.length).toBe(2); // Expecting both accessToken and refreshToken

    // 3. Check for the accessToken specifically
    const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toContain('HttpOnly'); // Security check
    expect(accessTokenCookie).toContain('Max-Age='); // Check for expiration

    // 4. Check for the refreshToken specifically
    const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain('HttpOnly'); // Security check
    expect(refreshTokenCookie).toContain('Max-Age=');
  });

  it('should return an accessToken containing the correct user payload', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUserCredentials.username,
        password: testUserCredentials.password
      });

    // 1. Extract the accessToken value from the cookie
    const cookies = response.headers['set-cookie'];
    const accessTokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
    const token = accessTokenCookie.split(';')[0].split('=')[1];

    // 2. Decode the JWT and verify its payload
    const decodedToken = jwt.verify(token, getConfig('jwtSecret'));

    // 3. Assert that the payload contains the correct user information
    expect(decodedToken).toBeDefined();
    expect(decodedToken.userId).toBe(createdUser._id.toString());
    expect(decodedToken.email).toBe(createdUser.contactInfo.email);
  });

  // Test Case 3: Unauthorized - Invalid Credentials (401 Unauthorized)
  it('should return a 401 status for invalid credentials (wrong password)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUserCredentials.email,
        password: 'wrongpassword'
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid credentials');
  });

  // Test Case 4: Bad Request - Missing Credentials (400 Bad Request)
  it('should return a 400 status if the password is missing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testUserCredentials.email
      });

    expect(response.statusCode).toBe(400);
  });

});
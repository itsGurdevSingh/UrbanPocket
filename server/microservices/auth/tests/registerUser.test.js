// tests/registerUser.test.js
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

describe('POST /api/auth/register', () => {

  // Test Case 1: Successful Registration
  it('should register a new user successfully and return a 201 status', async () => {
    const newUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };
    const response = await request(app).post('/api/auth/register').send(newUser);
    expect(response.statusCode).toBe(201);
    expect(response.body.user.email).toBe(newUser.email);
  });

  // Test Case 2: Bad Request
  it('should return a 400 status if the password is too short', async () => {
    const invalidUser = {
      username: 'baduser',
      email: 'bad@example.com',
      password: '123'
    };
    const response = await request(app).post('/api/auth/register').send(invalidUser);
    expect(response.statusCode).toBe(400);
  });

  // Test Case 3: Conflict
  it('should return a 409 status if the email already exists', async () => {
    const existingUser = {
      username: 'existinguser',
      email: 'exists@example.com',
      password: 'password123'
    };
    await User.create({
      username:existingUser.username,
      contactInfo: { email: existingUser.email },
      password: existingUser.password
    });

    const response = await request(app).post('/api/auth/register').send({
      username: 'anotheruser',
      email: 'exists@example.com',
      password: 'anotherpassword'
    });
    expect(response.statusCode).toBe(409);
  });

});
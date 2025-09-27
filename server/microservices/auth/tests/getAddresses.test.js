// tests/getAddresses.test.js
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/userModel.js';

describe('GET /api/auth/getAddresses', () => {

  // Context 1: Testing an unauthenticated user
  describe('when the user is not authenticated', () => {
    it('should return 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/auth/getAddresses')
        .set('Cookie', [`accessToken=invalidtoken`]);
      expect(res.statusCode).toBe(401);
    });
  });

  // Context 2: Grouping all tests for an authenticated user
  describe('when the user is authenticated', () => {
    let accessToken;
    let createdUser;

    // Context 2a: User has addresses
    describe('and has existing addresses', () => {
      const addresses = [
        { street: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '12345', country: 'USA' },
        { street: '456 Oak Ave', city: 'Othertown', state: 'TX', zipCode: '67890', country: 'USA' },
      ];

      beforeEach(async () => {
        // Setup: Create a user WITH addresses
        const hashedPassword = await bcrypt.hash('password123', 10);
        createdUser = await User.create({
          username: `userWithAddress_${Date.now()}`,
          contactInfo: { email: `withaddress${Date.now()}@example.com` },
          password: hashedPassword,
          addresses: addresses,
        });
        
        // Log in to get the token for this specific user
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ identifier: createdUser.username, password: 'password123' });
        accessToken = loginResponse.headers['set-cookie'].find(c => c.startsWith('accessToken=')).split(';')[0].split('=')[1];
      });

      it('should retrieve all addresses and return 200 OK', async () => {
        const res = await request(app)
          .get('/api/auth/getAddresses')
          .set('Cookie', [`accessToken=${accessToken}`]);

        expect(res.statusCode).toBe(200);
        expect(res.body.address.length).toBe(2);
        // Use toEqual because the returned objects will have _id, which toMatchObject ignores
        expect(res.body.address).toEqual(
          expect.arrayContaining([
            expect.objectContaining(addresses[0]),
            expect.objectContaining(addresses[1])
          ])
        );
      });
    });

    // Context 2b: User has NO addresses
    describe('and has no addresses', () => {
      beforeEach(async () => {
        // Setup: Create a user WITHOUT addresses
        const hashedPassword = await bcrypt.hash('password123', 10);
        createdUser = await User.create({
          username: `userWithoutAddress_${Date.now()}`,
          contactInfo: { email: `withoutaddress${Date.now()}@example.com` },
          password: hashedPassword,
        });

        // Log in to get the token for this specific user
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ identifier: createdUser.username, password: 'password123' });
        accessToken = loginResponse.headers['set-cookie'].find(c => c.startsWith('accessToken=')).split(';')[0].split('=')[1];
      });

      it('should return an empty array and 200 OK', async () => {
        const res = await request(app)
          .get('/api/auth/getAddresses')
          .set('Cookie', [`accessToken=${accessToken}`]);
          
        expect(res.statusCode).toBe(200);
        expect(res.body.address).toEqual([]);
      });
    });
  });
});
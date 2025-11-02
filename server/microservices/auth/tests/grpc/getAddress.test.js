// tests/grpc/getAddress.test.js
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../../src/models/userModel.js';
import { startGrpcServer, stopGrpcServer } from '../../src/grpc/server/index.js';
import bcrypt from 'bcryptjs';

// Get proto path relative to project root
const PROTO_PATH = path.join(process.cwd(), 'protos', 'auth.proto');

describe('gRPC GetAddress', () => {
    let client;
    let testUser;
    let testAddressId;
    const GRPC_PORT = '50099'; // Use different port for testing

    // Setup: Start gRPC server and create test client
    beforeAll(async () => {
        // Start gRPC server on test port
        await startGrpcServer(GRPC_PORT);

        // Load proto and create client
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });

        const authProto = grpc.loadPackageDefinition(packageDefinition).auth;
        client = new authProto.AuthService(
            `localhost:${GRPC_PORT}`,
            grpc.credentials.createInsecure()
        );
    });

    // Cleanup: Stop gRPC server
    afterAll(async () => {
        if (client) {
            client.close();
        }
        await stopGrpcServer();
    });

    // Create test user with address before each test
    beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('testpassword123', 10);

        testUser = await User.create({
            username: 'grpc_test_user',
            password: hashedPassword,
            contactInfo: {
                email: 'grpctest@example.com',
                contactNumber: ['1234567890']
            },
            personalInfo: {
                fullName: {
                    firstname: 'Test',
                    lastname: 'User'
                }
            },
            addresses: [
                {
                    street: '123 Test Street',
                    city: 'Test City',
                    state: 'Test State',
                    country: 'Test Country',
                    zipCode: '12345'
                },
                {
                    street: '456 Another St',
                    city: 'Another City',
                    state: 'Another State',
                    country: 'Another Country',
                    zipCode: '67890'
                }
            ]
        });

        // Store first address ID for testing
        testAddressId = testUser.addresses[0]._id.toString();
    });

    // Helper function to promisify gRPC calls
    const getAddress = (userId, addressId) => {
        return new Promise((resolve, reject) => {
            client.GetAddress({ userId, addressId }, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    };

    describe('Success Cases', () => {
        it('should retrieve address successfully with valid userId and addressId', async () => {
            const response = await getAddress(testUser._id.toString(), testAddressId);

            expect(response.success).toBe(true);
            expect(response.message).toBe('Address retrieved successfully');
            expect(response.error).toBeNull();

            expect(response.address).toBeDefined();
            expect(response.address.id).toBe(testAddressId);
            expect(response.address.street).toBe('123 Test Street');
            expect(response.address.city).toBe('Test City');
            expect(response.address.state).toBe('Test State');
            expect(response.address.country).toBe('Test Country');
            expect(response.address.zipCode).toBe('12345');
        });

        it('should retrieve second address when valid addressId is provided', async () => {
            const secondAddressId = testUser.addresses[1]._id.toString();
            const response = await getAddress(testUser._id.toString(), secondAddressId);

            expect(response.success).toBe(true);
            expect(response.address.id).toBe(secondAddressId);
            expect(response.address.street).toBe('456 Another St');
            expect(response.address.city).toBe('Another City');
            expect(response.address.state).toBe('Another State');
        });
    });

    describe('Failure Cases', () => {
        it('should return error when userId is missing', async () => {
            const response = await getAddress('', testAddressId);

            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.message).toBe('Address not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should return error when addressId is missing', async () => {
            const response = await getAddress(testUser._id.toString(), '');

            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.message).toBe('Address not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should return error when both userId and addressId are missing', async () => {
            const response = await getAddress('', '');

            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should return error when user does not exist', async () => {
            const nonExistentUserId = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectId format
            const response = await getAddress(nonExistentUserId, testAddressId);

            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.message).toBe('Address not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should return error when address does not exist for user', async () => {
            const nonExistentAddressId = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectId format
            const response = await getAddress(testUser._id.toString(), nonExistentAddressId);

            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.message).toBe('Address not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should return error when userId has invalid format', async () => {
            const invalidUserId = 'invalid_id_format';

            try {
                await getAddress(invalidUserId, testAddressId);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
                expect(error.message).toContain('Cast to ObjectId failed');
            }
        });

        it('should return error when addressId has invalid format', async () => {
            const invalidAddressId = 'invalid_address_format';

            const response = await getAddress(testUser._id.toString(), invalidAddressId);

            // Invalid address ID gets caught by mongoose and returns NOT_FOUND
            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });

        it('should return error when user has no addresses', async () => {
            // Create user without addresses
            const userWithoutAddress = await User.create({
                username: 'no_address_user',
                password: await bcrypt.hash('password123', 10),
                contactInfo: {
                    email: 'noaddress@example.com'
                },
                addresses: []
            });

            const response = await getAddress(
                userWithoutAddress._id.toString(),
                testAddressId // Some address ID
            );

            expect(response.success).toBe(false);
            expect(response.address).toBeNull();
            expect(response.message).toBe('Address not found');
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe('NOT_FOUND');
        });
    });

    describe('Edge Cases', () => {
        it('should handle address with empty/null fields', async () => {
            // Create user with minimal address data
            const userWithMinimalAddress = await User.create({
                username: 'minimal_address_user',
                password: await bcrypt.hash('password123', 10),
                contactInfo: {
                    email: 'minimal@example.com'
                },
                addresses: [
                    {
                        street: '',
                        city: null,
                        state: '',
                        country: null,
                        zipCode: ''
                    }
                ]
            });

            const minimalAddressId = userWithMinimalAddress.addresses[0]._id.toString();
            const response = await getAddress(
                userWithMinimalAddress._id.toString(),
                minimalAddressId
            );

            expect(response.success).toBe(true);
            expect(response.address).toBeDefined();
            expect(response.address.id).toBe(minimalAddressId);
            expect(response.address.street).toBe('');
            expect(response.address.city).toBe('');
            expect(response.address.state).toBe('');
            expect(response.address.country).toBe('');
            expect(response.address.zipCode).toBe('');
        });

        it('should handle user with maximum number of addresses', async () => {
            // Create user with multiple addresses
            const addresses = [];
            for (let i = 1; i <= 10; i++) {
                addresses.push({
                    street: `${i * 100} Street ${i}`,
                    city: `City ${i}`,
                    state: `State ${i}`,
                    country: 'Test Country',
                    zipCode: `${10000 + i}`
                });
            }

            const userWithManyAddresses = await User.create({
                username: 'many_addresses_user',
                password: await bcrypt.hash('password123', 10),
                contactInfo: {
                    email: 'manyaddresses@example.com'
                },
                addresses
            });

            // Test retrieving the last address
            const lastAddressId = userWithManyAddresses.addresses[9]._id.toString();
            const response = await getAddress(
                userWithManyAddresses._id.toString(),
                lastAddressId
            );

            expect(response.success).toBe(true);
            expect(response.address.id).toBe(lastAddressId);
            expect(response.address.street).toBe('1000 Street 10');
            expect(response.address.city).toBe('City 10');
        });
    });

    describe('Response Structure Validation', () => {
        it('should return response with all required fields', async () => {
            const response = await getAddress(testUser._id.toString(), testAddressId);

            // Check response structure
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('address');
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('error');

            // Check address structure
            expect(response.address).toHaveProperty('id');
            expect(response.address).toHaveProperty('street');
            expect(response.address).toHaveProperty('city');
            expect(response.address).toHaveProperty('state');
            expect(response.address).toHaveProperty('country');
            expect(response.address).toHaveProperty('zipCode');
        });

        it('should return error response with proper structure on failure', async () => {
            // Use non-existent user instead of invalid format to get response object
            const nonExistentUserId = new mongoose.Types.ObjectId().toString();
            const response = await getAddress(nonExistentUserId, testAddressId);

            expect(response).toHaveProperty('success');
            expect(response.success).toBe(false);
            expect(response).toHaveProperty('address');
            expect(response.address).toBeNull();
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('error');

            // Check error structure
            expect(response.error).toHaveProperty('code');
            expect(response.error).toHaveProperty('message');
            expect(response.error).toHaveProperty('details');
            expect(Array.isArray(response.error.details)).toBe(true);
        });
    });
});

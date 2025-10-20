// tests/sample.test.js
import request from 'supertest';
import app from '../src/app.js';

describe('Sample Test Suite', () => {
    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('ok');
            expect(response.body.data).toHaveProperty('timestamp');
            expect(response.body.data).toHaveProperty('service', 'microservice-boilerplate');
        });
    });

    describe('GET /non-existent-route', () => {
        it('should return 404 for non-existent routes', async () => {
            const response = await request(app)
                .get('/non-existent-route')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
        });
    });

    // TODO: Add more test cases for your specific endpoints
    // Example:
    // describe('POST /api/v1/sample', () => {
    //     it('should create a new sample', async () => {
    //         const sampleData = {
    //             name: 'Test Sample',
    //             email: 'test@example.com'
    //         };

    //         const response = await request(app)
    //             .post('/api/v1/sample')
    //             .send(sampleData)
    //             .expect(201);

    //         expect(response.body).toHaveProperty('status', 'success');
    //         expect(response.body.data).toHaveProperty('name', sampleData.name);
    //     });
    // });
});
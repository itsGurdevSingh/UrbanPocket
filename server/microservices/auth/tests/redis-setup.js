import Redis from 'ioredis';

// This line is the key: it tells Jest that whenever any file tries to
// import 'ioredis', it should receive our mock class instead.
jest.mock('ioredis', () => {
  const RedisMock = require('./mocks/redis.mock.js').default;
   return {
    __esModule: true, // This property helps with module interoperability
    default: RedisMock,
  };
});

console.log('Mocked ioredis with RedisMock for tests.', Redis);

// Before each test, clear the mock Redis database
beforeEach(async () => {
  const redisClient = new Redis(); // This will create an instance of our mock
  await redisClient.flushall();
  redisClient.disconnect();
});
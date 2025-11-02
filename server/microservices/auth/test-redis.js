/**
 * Redis Connection Test
 * Quick diagnostic to check if Redis is reachable
 */

import dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

console.log('\n🔍 Testing Redis Connection...\n');
console.log('Configuration:');
console.log(`  Host: ${REDIS_HOST}`);
console.log(`  Port: ${REDIS_PORT}`);
console.log(`  Password: ${REDIS_PASSWORD ? '***set***' : 'not set'}\n`);

const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    retryStrategy: () => null, // Don't retry, fail fast for testing
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
});

redis.on('error', (err) => {
    console.error('❌ Redis Connection Error:');
    console.error(`   Error Code: ${err.code}`);
    console.error(`   Error Message: ${err.message}`);
    console.error(`   Error Errno: ${err.errno}\n`);

    if (err.code === 'ENOTFOUND') {
        console.log('💡 DNS lookup failed - cannot resolve hostname');
        console.log('   Possible causes:');
        console.log('   - No internet connection');
        console.log('   - Redis Cloud instance deleted or hostname changed');
        console.log('   - DNS resolver issue\n');
    } else if (err.code === 'ECONNREFUSED') {
        console.log('💡 Connection refused - Redis not running on that host/port');
        console.log('   Possible causes:');
        console.log('   - Redis server is down');
        console.log('   - Firewall blocking connection');
        console.log('   - Wrong port number\n');
    } else if (err.code === 'ETIMEDOUT') {
        console.log('💡 Connection timeout - host unreachable');
        console.log('   Possible causes:');
        console.log('   - Firewall blocking connection');
        console.log('   - Network connectivity issue\n');
    }

    redis.disconnect();
    process.exit(1);
});

redis.on('connect', () => {
    console.log('✅ Successfully connected to Redis!');
});

redis.on('ready', async () => {
    console.log('✅ Redis is ready!\n');

    try {
        // Test basic operations
        console.log('Testing PING...');
        const pong = await redis.ping();
        console.log(`  Response: ${pong}\n`);

        console.log('Testing SET/GET...');
        await redis.set('test_key', 'test_value', 'EX', 10);
        const value = await redis.get('test_key');
        console.log(`  Stored: "test_value"`);
        console.log(`  Retrieved: "${value}"\n`);

        console.log('✨ All tests passed! Redis is working correctly.\n');
    } catch (err) {
        console.error('❌ Error during Redis operations:', err.message);
    } finally {
        redis.disconnect();
        process.exit(0);
    }
});

// Attempt connection
console.log('Connecting...\n');
redis.connect().catch((err) => {
    console.error('❌ Failed to connect:', err.message);
    process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error('❌ Connection timeout (10s)');
    redis.disconnect();
    process.exit(1);
}, 10000);

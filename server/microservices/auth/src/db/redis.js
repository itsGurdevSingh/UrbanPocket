import  Redis  from 'ioredis';
import getConfig from '../config/config_keys.js';

const redis = new Redis({
    host: getConfig('REDIS_HOST'),
    port: getConfig('REDIS_PORT'),
    password: getConfig('REDIS_PASSWORD'),
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

export default redis;
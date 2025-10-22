import Redis from 'ioredis';
import getConfig from '../config/config_keys.js';
import logger from '../utils/logger.js';

const redis = new Redis({
    host: getConfig('REDIS_HOST'),
    port: getConfig('REDIS_PORT'),
    password: getConfig('REDIS_PASSWORD'),
});

redis.on('connect', () => {
    logger.info('Connected to Redis');
});

redis.on('error', (err) => {
    logger.error('Redis connection error:', { err });
});

export default redis;
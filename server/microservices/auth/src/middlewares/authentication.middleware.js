import jwt from 'jsonwebtoken';
import redisClient from '../db/redis.js';
import getConfig from '../config/config_keys.js';
import { tokenHash } from '../utils/auth.utils.js';
import { ApiError } from '../utils/errors.js';

const authenticateUser = async (req, res, next) => {

    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
        return next(new ApiError('Access token missing', { statusCode: 401, code: 'AUTH_MISSING' }));
    };

    try {
        // check if token is blacklisted (compare hashed token keys)
        const key = tokenHash(accessToken);
        const isBlacklisted = key ? await redisClient.get(`bl_${key}`) : null;
        if (isBlacklisted) {
            return next(new ApiError('Token is blacklisted. Please log in again.', { statusCode: 401, code: 'TOKEN_BLACKLISTED' }));
        };

        // verify token
        let decoded;
        try {
            decoded = jwt.verify(accessToken, getConfig('jwtSecret'));
        } catch (err) {
            return next(new ApiError('Invalid or expired access token', { statusCode: 401, code: 'INVALID_TOKEN' }));
        }

        if (!decoded || !decoded.userId) {
            return next(new ApiError('Invalid access token payload', { statusCode: 401, code: 'INVALID_TOKEN_PAYLOAD' }));
        }

        req.user = {
            id: decoded.userId,
            username: decoded.username,
            email: decoded.email,
        };
        next();
    } catch (error) {
        // convert unknown errors to ApiError upstream via the handler
        return next(error);
    }

};

export {
    authenticateUser
};
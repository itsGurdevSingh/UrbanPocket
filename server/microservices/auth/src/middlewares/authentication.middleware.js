import jwt from 'jsonwebtoken';
import redisClient from '../db/redis.js';
import getConfig from '../config/config_keys.js';

const authenticateUser = async (req, res, next) => {

    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
        const error = new Error('Access token missing');
        error.statusCode = 401; // Unauthorized
        return next(error);
    };

    try {
        // check if token is blacklisted
        const isBlacklisted = await redisClient.get(`bl_${accessToken}`);
        if (isBlacklisted) {
            const error = new Error('Token is blacklisted. Please log in again.');
            error.statusCode = 401; // Unauthorized
            return next(error);
        };
        // verify token
        const decoded = jwt.verify(accessToken, getConfig('jwtSecret'));
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            email: decoded.email,
        };
        next();
    } catch (error) {
        error.statusCode = 401; // Unauthorized
        return next(error);
    }

};

export {
    authenticateUser
};